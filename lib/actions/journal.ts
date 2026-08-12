'use server';

import { revalidatePath } from 'next/cache';
import { schemaEntree, schemaPesee, schemaSuppressionEntree } from '@/lib/validations';
import { creerClientServeur } from '@/lib/supabase/server';
import { aujourdhuiIso } from '@/lib/dates-app';
import type { DateIso } from '@/lib/calcul';
import { recalculerDepuis } from './recalcul';

export type Resultat =
  | { ok: true }
  | { ok: false; erreur: string; champs?: Record<string, string[]> };

/**
 * Toutes les mutations passent par ici, jamais par le client.
 *
 * La validation Zod côté navigateur sert au confort de saisie ; celle-ci
 * est la seule qui protège quoi que ce soit. Un appel direct à l'API
 * rencontre ce chemin, puis la RLS, puis les triggers.
 */
async function contexte() {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/**
 * Garantit qu'une `journee` existe pour la date, et la renvoie.
 *
 * `upsert` sur `(user_id, date)` plutôt que « lire puis insérer » : deux
 * saisies simultanées depuis deux appareils créeraient sinon deux
 * journées pour le même jour, et l'unicité échouerait sur la seconde.
 */
async function journeePour(
  supabase: Awaited<ReturnType<typeof creerClientServeur>>,
  userId: string,
  date: DateIso,
): Promise<string | null> {
  const { data: existante } = await supabase
    .from('journee')
    .select('id')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  if (existante !== null) return existante.id;

  const { data: programme } = await supabase
    .from('programme')
    .select('id')
    .eq('user_id', userId)
    .eq('actif', true)
    .maybeSingle();

  const { data: creee, error } = await supabase
    .from('journee')
    .upsert(
      { user_id: userId, date, programme_id: programme?.id ?? null },
      { onConflict: 'user_id,date' },
    )
    .select('id')
    .single();

  if (error !== null) return null;
  return creee.id;
}

/** Enregistre une entrée alimentaire. Idempotent sur l'UUID client. */
export async function enregistrerEntree(donnees: unknown): Promise<Resultat> {
  const analyse = schemaEntree.safeParse(donnees);
  if (!analyse.success) {
    return {
      ok: false,
      erreur: 'Saisie invalide.',
      champs: analyse.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { supabase, user } = await contexte();
  if (user === null) return { ok: false, erreur: 'Session expirée.' };

  const saisie = analyse.data;
  const journeeId = await journeePour(supabase, user.id, saisie.date);
  if (journeeId === null) {
    return { ok: false, erreur: 'Impossible d’ouvrir la journée.' };
  }

  const { error } = await supabase.from('entree').upsert(
    {
      id: saisie.id,
      user_id: user.id,
      journee_id: journeeId,
      aliment_id: saisie.alimentId ?? null,
      aliment_utilisateur_id: saisie.alimentUtilisateurId ?? null,
      recette_id: saisie.recetteId ?? null,
      libelle: saisie.libelle,
      repas: saisie.repas,
      quantite: saisie.quantite,
      unite: saisie.unite,
      quantite_g: saisie.quantiteG ?? null,
      // Valeurs figées à la saisie : elles ne seront jamais relues
      // depuis le catalogue, même si celui-ci est corrigé plus tard.
      kcal: saisie.kcal,
      proteines_g: saisie.proteinesG ?? null,
      glucides_g: saisie.glucidesG ?? null,
      lipides_g: saisie.lipidesG ?? null,
      source: saisie.source,
      supprime_le: null,
    },
    { onConflict: 'id' },
  );

  if (error !== null) return { ok: false, erreur: error.message };

  await recalculerDepuis({ dateImpactee: saisie.date, aujourdhui: aujourdhuiIso() });
  revalidatePath('/aujourdhui');
  revalidatePath('/bilan');

  return { ok: true };
}

/**
 * Supprime une entrée — logiquement.
 *
 * Un `delete` la ferait réapparaître au prochain vidage de la file
 * d'attente d'un autre appareil, qui ignore encore la suppression.
 */
export async function supprimerEntree(donnees: unknown): Promise<Resultat> {
  const analyse = schemaSuppressionEntree.safeParse(donnees);
  if (!analyse.success) return { ok: false, erreur: 'Identifiant invalide.' };

  const { supabase, user } = await contexte();
  if (user === null) return { ok: false, erreur: 'Session expirée.' };

  const { data: entree } = await supabase
    .from('entree')
    .select('journee_id')
    .eq('id', analyse.data.id)
    .maybeSingle();

  if (entree === null) return { ok: false, erreur: 'Entrée introuvable.' };

  const { data: journee } = await supabase
    .from('journee')
    .select('date')
    .eq('id', entree.journee_id)
    .maybeSingle();

  const { error } = await supabase
    .from('entree')
    .update({ supprime_le: new Date().toISOString() })
    .eq('id', analyse.data.id);

  if (error !== null) return { ok: false, erreur: error.message };

  if (journee !== null) {
    await recalculerDepuis({ dateImpactee: journee.date, aujourdhui: aujourdhuiIso() });
  }
  revalidatePath('/aujourdhui');

  return { ok: true };
}

/**
 * Enregistre une pesée.
 *
 * La moyenne mobile et le marquage d'aberration sont posés par le
 * recalcul, pas ici : insérer une pesée rétroactive change le lissage
 * de tous les jours suivants.
 */
export async function enregistrerPesee(donnees: unknown): Promise<Resultat> {
  const analyse = schemaPesee.safeParse(donnees);
  if (!analyse.success) {
    return {
      ok: false,
      erreur: 'Saisie invalide.',
      champs: analyse.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { supabase, user } = await contexte();
  if (user === null) return { ok: false, erreur: 'Session expirée.' };

  const saisie = analyse.data;

  const { error } = await supabase.from('pesee').upsert(
    {
      id: saisie.id,
      user_id: user.id,
      date: saisie.date,
      poids_kg: saisie.poidsKg,
      confirmee: saisie.confirmee,
      source: saisie.source,
      moyenne_mobile_7j_kg: null,
      aberrante: false,
      supprime_le: null,
    },
    { onConflict: 'user_id,date' },
  );

  if (error !== null) return { ok: false, erreur: error.message };

  await recalculerDepuis({ dateImpactee: saisie.date, aujourdhui: aujourdhuiIso() });
  revalidatePath('/aujourdhui');
  revalidatePath('/bilan');
  // Sans ça, la liste « Dernières pesées » ne se rafraîchissait pas :
  // la seule preuve visible qu'un enregistrement a marché sur cette
  // page, puisque `etat.ok` vaut déjà `true` avant tout envoi.
  revalidatePath('/pesee');

  return { ok: true };
}

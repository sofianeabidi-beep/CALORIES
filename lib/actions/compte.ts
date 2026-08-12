'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { schemaConsentements, schemaProfil, schemaProgramme } from '@/lib/validations';
import { creerClientServeur } from '@/lib/supabase/server';
import { aujourdhuiIso } from '@/lib/dates-app';
import type { Resultat } from './journal';
import { recalculerDepuis } from './recalcul';

const schemaIdentifiants = z.object({
  email: z.email({ message: 'Adresse électronique invalide.' }),
  motDePasse: z
    .string()
    .min(8, { message: 'Le mot de passe doit faire au moins 8 caractères.' }),
});

/**
 * Uniquement pour l'inscription : `seConnecter` n'a pas de confirmation
 * à vérifier, ce serait une contrainte sans objet à la connexion.
 */
const schemaInscriptionIdentifiants = schemaIdentifiants
  .extend({ confirmationMotDePasse: z.string() })
  .superRefine((valeurs, ctx) => {
    if (valeurs.confirmationMotDePasse !== valeurs.motDePasse) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmationMotDePasse'],
        message: 'Les deux mots de passe ne correspondent pas.',
      });
    }
  });

function champsDe(erreur: z.ZodError): Record<string, string[]> {
  return erreur.flatten().fieldErrors as Record<string, string[]>;
}

export async function seConnecter(donnees: unknown): Promise<Resultat> {
  const analyse = schemaIdentifiants.safeParse(donnees);
  if (!analyse.success) {
    return { ok: false, erreur: 'Saisie invalide.', champs: champsDe(analyse.error) };
  }

  const supabase = await creerClientServeur();
  const { error } = await supabase.auth.signInWithPassword({
    email: analyse.data.email,
    password: analyse.data.motDePasse,
  });

  if (error !== null) {
    // Message volontairement indifférencié : préciser « ce compte
    // n'existe pas » révélerait qui est inscrit sur une application de
    // suivi de poids.
    return { ok: false, erreur: 'Adresse ou mot de passe incorrect.' };
  }

  redirect('/aujourdhui');
}

/**
 * Inscription.
 *
 * Trois choses se jouent ici, dans cet ordre : le contrôle des 18 ans,
 * les deux consentements horodatés séparément, et la création du profil.
 * Aucune n'est optionnelle.
 *
 * La taille n'est pas demandée ici : elle arrive à la création du
 * programme, l'étape suivante.
 */
export async function sInscrire(donnees: unknown): Promise<Resultat> {
  const brut = donnees as Record<string, unknown>;

  const identifiants = schemaInscriptionIdentifiants.safeParse(brut);
  if (!identifiants.success) {
    return { ok: false, erreur: 'Saisie invalide.', champs: champsDe(identifiants.error) };
  }

  const consentements = schemaConsentements.safeParse(brut);
  if (!consentements.success) {
    return {
      ok: false,
      erreur: 'Consentements incomplets.',
      champs: champsDe(consentements.error),
    };
  }

  const aujourdhui = aujourdhuiIso();
  const profil = schemaProfil(aujourdhui).safeParse(brut);
  if (!profil.success) {
    return { ok: false, erreur: 'Profil invalide.', champs: champsDe(profil.error) };
  }

  const supabase = await creerClientServeur();
  const { data, error } = await supabase.auth.signUp({
    email: identifiants.data.email,
    password: identifiants.data.motDePasse,
  });

  if (error !== null) return { ok: false, erreur: error.message };
  if (data.user === null) return { ok: false, erreur: 'Inscription impossible.' };

  const horodatage = new Date().toISOString();
  const { error: erreurProfil } = await supabase.from('profil').insert({
    user_id: data.user.id,
    sexe: profil.data.sexe,
    date_naissance: profil.data.dateNaissance,
    niveau_activite: profil.data.niveauActivite,
    mode_jours_manquants: profil.data.modeJoursManquants,
    unite_poids: profil.data.unitePoids,
    mode_discret: profil.data.modeDiscret,
    // Horodatés distinctement : c'est la trace qui démontre que le
    // consentement santé a bien été recueilli à part (RGPD art. 9).
    consentement_sante_le: horodatage,
    cgu_acceptees_le: horodatage,
  });

  if (erreurProfil !== null) return { ok: false, erreur: erreurProfil.message };

  redirect('/reglages/programme');
}

export async function seDeconnecter(): Promise<void> {
  const supabase = await creerClientServeur();
  await supabase.auth.signOut();
  redirect('/connexion');
}

/**
 * Crée ou remplace le programme actif.
 *
 * Les garde-fous sont vérifiés ici avec les mêmes fonctions que le
 * moteur, puis à nouveau par les triggers SQL. La redondance est le but :
 * une seule couche laisserait passer ce qui contourne l'autre.
 */
export async function enregistrerProgramme(donnees: unknown): Promise<Resultat> {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return { ok: false, erreur: 'Session expirée.' };

  const { data: profil } = await supabase
    .from('profil')
    .select('sexe')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profil === null) {
    return { ok: false, erreur: 'Renseignez votre profil avant de créer un programme.' };
  }

  const analyse = schemaProgramme({ sexe: profil.sexe }).safeParse(donnees);

  if (!analyse.success) {
    return { ok: false, erreur: 'Programme invalide.', champs: champsDe(analyse.error) };
  }

  const saisie = analyse.data;

  // La taille rejoint le profil ici, pas à l'inscription. Doit être
  // écrite avant l'insertion du programme : le trigger de garde-fous la
  // relit depuis `profil` pour vérifier l'IMC cible.
  const { error: erreurTaille } = await supabase
    .from('profil')
    .update({ taille_cm: saisie.tailleCm })
    .eq('user_id', user.id);

  if (erreurTaille !== null) return { ok: false, erreur: erreurTaille.message };

  // Un seul programme actif à la fois : l'index unique partiel refuserait
  // le second, il faut clore le précédent d'abord.
  await supabase
    .from('programme')
    .update({ actif: false })
    .eq('user_id', user.id)
    .eq('actif', true);

  const { error } = await supabase.from('programme').insert({
    user_id: user.id,
    libelle: saisie.libelle ?? null,
    type: saisie.type,
    date_debut: saisie.dateDebut,
    date_fin: saisie.dateFin ?? null,
    poids_depart_kg: saisie.poidsDepartKg,
    poids_cible_kg: saisie.poidsCibleKg ?? null,
    allure_cible_kg_semaine: saisie.allureCibleKgSemaine ?? null,
    objectif_kcal: saisie.objectifKcal ?? null,
    actif: true,
  });

  if (error !== null) return { ok: false, erreur: error.message };

  await recalculerDepuis({
    dateImpactee: saisie.dateDebut,
    aujourdhui: aujourdhuiIso(),
  });
  revalidatePath('/aujourdhui');
  revalidatePath('/reglages');

  return { ok: true };
}

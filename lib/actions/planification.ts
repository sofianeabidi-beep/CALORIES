'use server';

import { revalidatePath } from 'next/cache';
import { schemaBasculerArticleCourse, schemaGenererPlanification } from '@/lib/validations';
import { creerClientServeur } from '@/lib/supabase/server';
import { genererPlanification } from '@/lib/ia/planification';
import type { Planification } from '@/lib/ia/analyse-planification';
import { aujourdhuiIso } from '@/lib/dates-app';
import { lundiDeLaSemaine } from '@/lib/calcul';

export type ResultatGeneration =
  | { ok: true; donnees: Planification }
  | { ok: false; erreur: string };

/**
 * Génère (ou régénère) le plan de la semaine en cours.
 *
 * Une régénération écrase le plan existant de la semaine (`upsert` sur
 * `user_id, semaine_debut`) et réinitialise les cases cochées de la
 * liste de courses — cohérent : une nouvelle liste n'a plus de rapport
 * avec les courses déjà faites sur l'ancienne.
 */
export async function genererPlanificationAction(donnees: unknown): Promise<ResultatGeneration> {
  const analyse = schemaGenererPlanification.safeParse(donnees);
  if (!analyse.success) return { ok: false, erreur: 'Requête invalide.' };

  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return { ok: false, erreur: 'Session expirée.' };

  const resultat = await genererPlanification(analyse.data);
  if (!resultat.succes) return { ok: false, erreur: resultat.erreur };

  const semaineDebut = lundiDeLaSemaine(aujourdhuiIso());

  const { error } = await supabase.from('planification_semaine').upsert(
    {
      user_id: user.id,
      semaine_debut: semaineDebut,
      nb_repas_jour: analyse.data.nbRepasJour,
      objectif_kcal_jour: analyse.data.objectifKcalJour,
      contrainte_temps: analyse.data.contrainteTemps,
      plan: { jours: resultat.donnees.jours },
      liste_courses: resultat.donnees.listeCourses,
      courses_cochees: {},
    },
    { onConflict: 'user_id,semaine_debut' },
  );

  if (error !== null) return { ok: false, erreur: error.message };

  revalidatePath('/planification');
  return { ok: true, donnees: resultat.donnees };
}

/** Coche ou décoche un article de la liste de courses, persisté immédiatement. */
export async function basculerArticleCourseAction(donnees: unknown): Promise<{ ok: boolean }> {
  const analyse = schemaBasculerArticleCourse.safeParse(donnees);
  if (!analyse.success) return { ok: false };

  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return { ok: false };

  const { data: ligne } = await supabase
    .from('planification_semaine')
    .select('courses_cochees')
    .eq('user_id', user.id)
    .eq('semaine_debut', analyse.data.semaineDebut)
    .maybeSingle();
  if (ligne === null) return { ok: false };

  const cochees = { ...(ligne.courses_cochees as Record<string, true>) };
  if (analyse.data.coche) {
    cochees[analyse.data.cle] = true;
  } else {
    delete cochees[analyse.data.cle];
  }

  const { error } = await supabase
    .from('planification_semaine')
    .update({ courses_cochees: cochees })
    .eq('user_id', user.id)
    .eq('semaine_debut', analyse.data.semaineDebut);

  return { ok: error === null };
}

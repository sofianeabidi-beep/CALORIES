import 'server-only';

import {
  calculerBilan,
  lisserPesees,
  type ApportJournalier,
  type Bilan,
  type DateIso,
  type ProfilCalcul,
  type ProgrammeCalcul,
} from '@/lib/calcul';
import { creerClientServeur } from '@/lib/supabase/server';
import type { LigneEntree, LigneProfil, LigneProgramme } from '@/lib/supabase/types';

export interface VueJournee {
  readonly date: DateIso;
  readonly profil: LigneProfil;
  readonly programme: LigneProgramme;
  readonly entrees: readonly LigneEntree[];
  readonly bilan: Bilan;
  readonly objectifKcal: number | null;
}

/**
 * Lecture de l'écran Aujourd'hui.
 *
 * Le bilan est recalculé à la lecture plutôt que lu depuis
 * `instantane_calcul` : c'est plus lent, mais l'instantané peut avoir
 * pris du retard si un recalcul a été interrompu, et un chiffre
 * légèrement lent vaut mieux qu'un chiffre légèrement faux.
 *
 * L'optimisation — lire l'instantané et ne recalculer qu'en cas
 * d'incohérence — attend d'avoir une base pour être mesurée.
 */
export async function lireJournee(date: DateIso): Promise<VueJournee | null> {
  const supabase = await creerClientServeur();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return null;

  const [profilReponse, programmeReponse] = await Promise.all([
    supabase.from('profil').select('*').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('programme')
      .select('*')
      .eq('user_id', user.id)
      .eq('actif', true)
      .maybeSingle(),
  ]);

  const profilLigne = profilReponse.data;
  const programmeLigne = programmeReponse.data;
  if (profilLigne === null || programmeLigne === null) return null;

  // Garanti par le trigger `verifier_gardefous_programme` : un programme
  // ne peut pas exister tant que la taille n'est pas renseignée. Dès
  // qu'on tient un programme, la taille est donc non nulle.
  if (profilLigne.taille_cm === null) return null;

  const [journeesReponse, peseesReponse] = await Promise.all([
    supabase
      .from('journee')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', programmeLigne.date_debut)
      .lte('date', date),
    supabase
      .from('pesee')
      .select('*')
      .eq('user_id', user.id)
      .is('supprime_le', null)
      .order('date', { ascending: true }),
  ]);

  const journees = journeesReponse.data ?? [];
  const journeeDuJour = journees.find((j) => j.date === date);

  const entreesReponse =
    journeeDuJour === undefined
      ? { data: [] }
      : await supabase
          .from('entree')
          .select('*')
          .eq('journee_id', journeeDuJour.id)
          .is('supprime_le', null)
          .order('saisi_le', { ascending: true });

  const profil: ProfilCalcul = {
    sexe: profilLigne.sexe,
    dateNaissance: profilLigne.date_naissance,
    tailleCm: profilLigne.taille_cm,
    niveauActivite: profilLigne.niveau_activite,
  };

  const programme: ProgrammeCalcul = {
    dateDebut: programmeLigne.date_debut,
    poidsDepartKg: Number(programmeLigne.poids_depart_kg),
    poidsCibleKg:
      programmeLigne.poids_cible_kg === null ? null : Number(programmeLigne.poids_cible_kg),
    modeJoursManquants: profilLigne.mode_jours_manquants,
  };

  const apports: ApportJournalier[] = journees.map((j) => ({
    date: j.date,
    // `statut === 'manquant'` distingue le jour non saisi du jour à
    // zéro. Un `apport_kcal` de 0 sur un jour renseigné est une donnée.
    apportKcal: j.statut === 'manquant' ? null : Number(j.apport_kcal),
  }));

  const pesees = lisserPesees(
    (peseesReponse.data ?? []).map((p) => ({
      date: p.date,
      poidsKg: Number(p.poids_kg),
    })),
  );

  return {
    date,
    profil: profilLigne,
    programme: programmeLigne,
    entrees: entreesReponse.data ?? [],
    bilan: calculerBilan({ date, profil, programme, apports, pesees }),
    objectifKcal: programmeLigne.objectif_kcal,
  };
}

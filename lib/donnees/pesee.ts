import 'server-only';

import { lisserPesees, plageDates, type DateIso, type JourneeCalculee } from '@/lib/calcul';
import { creerClientServeur } from '@/lib/supabase/server';
import { aujourdhuiIso } from '@/lib/dates-app';
import type { PeseeLissee } from '@/lib/calcul';

export interface VueHistoriquePoids {
  readonly pesees: readonly PeseeLissee[];
  readonly journees: readonly JourneeCalculee[];
}

/**
 * Historique pour l'écran Pesée : pesées lissées + série de journées.
 *
 * Volontairement indépendant de `lireJournee` / d'un programme actif —
 * se peser a du sens même avant d'avoir terminé l'installation d'un
 * programme, contrairement au tableau de bord d'Aujourd'hui.
 *
 * Une ligne `journee` n'existe en base que pour un jour où au moins un
 * aliment a été saisi un jour donné (`journeePour` dans
 * `lib/actions/journal.ts` ne crée jamais de ligne pour un autre jour).
 * Les jours sans ligne sont donc comblés ici en `manquant` sur toute la
 * plage observée, plutôt que silencieusement absents du tableau — sans
 * ça, un calcul de complétude sur une plage éparse mentirait par omission.
 */
export async function lireHistoriquePoids(): Promise<VueHistoriquePoids | null> {
  const supabase = await creerClientServeur();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return null;

  const [peseesReponse, journeesReponse] = await Promise.all([
    supabase
      .from('pesee')
      .select('*')
      .eq('user_id', user.id)
      .is('supprime_le', null)
      .order('date', { ascending: true }),
    supabase
      .from('journee')
      .select('date, statut, apport_kcal, deficit_kcal, depense_retenue_kcal')
      .eq('user_id', user.id)
      .order('date', { ascending: true }),
  ]);

  const pesees = lisserPesees(
    (peseesReponse.data ?? []).map((p) => ({ date: p.date, poidsKg: Number(p.poids_kg) })),
  );

  const lignesJournee = journeesReponse.data ?? [];

  const premieresDates = [pesees[0]?.date, lignesJournee[0]?.date].filter(
    (d): d is DateIso => d !== undefined,
  );

  if (premieresDates.length === 0) {
    return { pesees, journees: [] };
  }

  const dateDebut = premieresDates.reduce((min, d) => (d < min ? d : min));
  const aujourdhui = aujourdhuiIso();

  const parDate = new Map(lignesJournee.map((j) => [j.date, j] as const));

  const journees: JourneeCalculee[] = plageDates(dateDebut, aujourdhui).map((date) => {
    const ligne = parDate.get(date);
    if (ligne === undefined) {
      return { date, statut: 'manquant', apportRetenuKcal: null, depenseRetenueKcal: 0, deficitKcal: null };
    }
    return {
      date,
      statut: ligne.statut,
      apportRetenuKcal: ligne.statut === 'manquant' ? null : Number(ligne.apport_kcal),
      depenseRetenueKcal: Number(ligne.depense_retenue_kcal ?? 0),
      deficitKcal: ligne.deficit_kcal === null ? null : Number(ligne.deficit_kcal),
    };
  });

  return { pesees, journees };
}

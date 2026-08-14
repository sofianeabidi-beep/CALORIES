import {
  FENETRE_TENDANCE_JOURS,
  SEUIL_ECART_NOTABLE_KCAL,
  SEUIL_JOURS_MIN_TENDANCE,
} from './constantes';
import { ajouterJours } from './dates';
import type { DateIso, JourneeCalculee } from './types';

export type TonTendance = 'positif' | 'attention' | 'neutre';

export interface TendanceRecente {
  readonly ton: TonTendance;
  readonly fenetreJours: number;
  readonly joursRenseignesFenetre: number;
  /** `deficitKcal` d'hier si ce jour est renseigné, `null` sinon. */
  readonly ecartHierKcal: number | null;
  /**
   * Moyenne du déficit sur les jours renseignés de la fenêtre (aujourd'hui
   * exclu). `null` si sous `SEUIL_JOURS_MIN_TENDANCE`.
   */
  readonly ecartMoyenFenetreKcal: number | null;
}

/**
 * Tendance des derniers jours, pour l'écran Aujourd'hui.
 *
 * Ne regarde jamais aujourd'hui — une journée en cours est incomplète par
 * nature, l'inclure fausserait aussi bien la moyenne que la lecture
 * d'hier. Ne compte que les jours `renseigne` : même règle que
 * `calculerCompletude`, un jour `estime` repose sur une hypothèse, pas sur
 * une saisie, et ne doit pas nourrir un message qui a l'air d'un constat.
 *
 * Priorité à hier : un écart notable la veille prime sur une bonne
 * moyenne de fenêtre, parce que c'est l'information la plus récente et la
 * plus actionnable.
 */
export function analyserTendanceRecente(
  journees: readonly JourneeCalculee[],
  date: DateIso,
  fenetreJours: number = FENETRE_TENDANCE_JOURS,
): TendanceRecente {
  const parDate = new Map(journees.map((j) => [j.date, j] as const));

  const dateHier = ajouterJours(date, -1);
  const journeeHier = parDate.get(dateHier);
  const ecartHierKcal = journeeHier?.statut === 'renseigne' ? journeeHier.deficitKcal : null;

  const fenetre: JourneeCalculee[] = [];
  for (let i = 1; i <= fenetreJours; i += 1) {
    const journee = parDate.get(ajouterJours(date, -i));
    if (journee?.statut === 'renseigne') fenetre.push(journee);
  }

  const joursRenseignesFenetre = fenetre.length;

  if (joursRenseignesFenetre < SEUIL_JOURS_MIN_TENDANCE) {
    return {
      ton: 'neutre',
      fenetreJours,
      joursRenseignesFenetre,
      ecartHierKcal,
      ecartMoyenFenetreKcal: null,
    };
  }

  const ecartMoyenFenetreKcal =
    fenetre.reduce((somme, j) => somme + (j.deficitKcal as number), 0) / fenetre.length;

  if (ecartHierKcal !== null && ecartHierKcal < -SEUIL_ECART_NOTABLE_KCAL) {
    return {
      ton: 'attention',
      fenetreJours,
      joursRenseignesFenetre,
      ecartHierKcal,
      ecartMoyenFenetreKcal,
    };
  }

  return {
    ton: ecartMoyenFenetreKcal >= 0 ? 'positif' : 'neutre',
    fenetreJours,
    joursRenseignesFenetre,
    ecartHierKcal,
    ecartMoyenFenetreKcal,
  };
}

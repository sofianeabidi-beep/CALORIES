import {
  RATIO_PROTEINES_G_PAR_KG,
  SEUIL_PROCHE_OBJECTIF_KCAL,
  SEUIL_PROTEINES_SUFFISANT,
} from './constantes';

export type StatutKcal = 'dans_objectif' | 'proche_objectif' | 'depasse';
export type StatutProteines = 'suffisant' | 'insuffisant' | 'inconnu';

export interface StatutJour {
  readonly statutKcal: StatutKcal;
  readonly statutProteines: StatutProteines;
}

/**
 * Statut du jour en cours, pour l'écran Aujourd'hui — distinct de
 * `analyserTendanceRecente` : ici on regarde uniquement l'apport déjà
 * enregistré aujourd'hui contre l'objectif du jour, pas l'historique.
 *
 * `objectifProteinesG` est fourni par l'appelant (voir
 * `objectifProteinesRepere`) plutôt que recalculé ici : cette fonction ne
 * fait que comparer, elle ne décide pas du repère.
 */
export function evaluerStatutJour(entree: {
  apportKcal: number;
  objectifKcal: number;
  proteinesG: number;
  objectifProteinesG: number | null;
}): StatutJour {
  const statutKcal: StatutKcal =
    entree.apportKcal > entree.objectifKcal
      ? 'depasse'
      : entree.apportKcal >= entree.objectifKcal * SEUIL_PROCHE_OBJECTIF_KCAL
        ? 'proche_objectif'
        : 'dans_objectif';

  const statutProteines: StatutProteines =
    entree.objectifProteinesG === null
      ? 'inconnu'
      : entree.proteinesG < entree.objectifProteinesG * SEUIL_PROTEINES_SUFFISANT
        ? 'insuffisant'
        : 'suffisant';

  return { statutKcal, statutProteines };
}

/**
 * Repère de protéines à partir d'un poids — voir `RATIO_PROTEINES_G_PAR_KG`
 * pour ce que ce chiffre est et n'est pas.
 */
export function objectifProteinesRepere(
  poidsKg: number,
  ratioGParKg: number = RATIO_PROTEINES_G_PAR_KG,
): number {
  return poidsKg * ratioGParKg;
}

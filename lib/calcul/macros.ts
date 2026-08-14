import {
  KCAL_PAR_G_GLUCIDES,
  KCAL_PAR_G_LIPIDES,
  KCAL_PAR_G_PROTEINES,
  RATIO_LIPIDES_KCAL_OBJECTIF,
} from './constantes';

export interface RepartitionMacros {
  readonly proteinesG: number;
  readonly glucidesG: number;
  readonly lipidesG: number;
}

/**
 * Dérive des objectifs de macronutriments en grammes à partir de
 * l'objectif calorique du jour et du repère de protéines déjà décidé
 * (voir `objectifProteinesRepere`).
 *
 * Ordre de priorité : les protéines sont couvertes en premier par leur
 * repère, puis une part fixe de l'objectif calorique va aux lipides
 * (`RATIO_LIPIDES_KCAL_OBJECTIF`), et les glucides prennent ce qu'il
 * reste. Si le repère de protéines et la part de lipides dépassent déjà
 * l'objectif calorique (objectif très bas, repère élevé), les glucides
 * sont ramenés à zéro plutôt que de devenir négatifs.
 */
export function repartirMacrosObjectif(entree: {
  objectifKcal: number;
  objectifProteinesG: number;
}): RepartitionMacros {
  const kcalProteines = entree.objectifProteinesG * KCAL_PAR_G_PROTEINES;
  const kcalLipides = entree.objectifKcal * RATIO_LIPIDES_KCAL_OBJECTIF;
  const kcalGlucides = Math.max(0, entree.objectifKcal - kcalProteines - kcalLipides);

  return {
    proteinesG: entree.objectifProteinesG,
    glucidesG: kcalGlucides / KCAL_PAR_G_GLUCIDES,
    lipidesG: kcalLipides / KCAL_PAR_G_LIPIDES,
  };
}

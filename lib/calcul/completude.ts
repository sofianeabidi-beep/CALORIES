import { nombreJoursInclus } from './dates';
import type { DateIso, JourneeCalculee } from './types';

export interface Completude {
  /** Entre 0 et 1. */
  readonly taux: number;
  readonly joursRenseignes: number;
  readonly joursEstimes: number;
  readonly joursManquants: number;
  readonly joursTotal: number;
}

/**
 * Taux de complétude d'une plage (spec §6.5).
 *
 * **C'est la donnée qui conditionne la validité de tout le reste.** Elle
 * s'affiche en permanence à côté de tout indicateur cumulé — un déficit
 * calculé sur 40 % des jours ne vaut rien, et l'utilisateur doit le voir.
 * Cette règle ne se négocie pas au moment de l'intégration graphique
 * (spec §6.5 et critère d'acceptation §14).
 *
 * Les jours estimés ne comptent **pas** comme renseignés : ils reposent
 * sur une hypothèse, pas sur une saisie. Les compter gonflerait
 * artificiellement la confiance que l'utilisateur accorde au cumul.
 */
export function calculerCompletude(journees: readonly JourneeCalculee[]): Completude {
  let joursRenseignes = 0;
  let joursEstimes = 0;
  let joursManquants = 0;

  for (const journee of journees) {
    if (journee.statut === 'renseigne') joursRenseignes += 1;
    else if (journee.statut === 'estime') joursEstimes += 1;
    else joursManquants += 1;
  }

  const joursTotal = journees.length;

  return {
    taux: joursTotal === 0 ? 0 : joursRenseignes / joursTotal,
    joursRenseignes,
    joursEstimes,
    joursManquants,
    joursTotal,
  };
}

/**
 * Complétude d'un programme jusqu'à une date, à partir des seuls jours
 * effectivement saisis. Utile quand on n'a pas résolu la plage complète.
 */
export function completudeSurPlage(entree: {
  dateDebut: DateIso;
  dateFin: DateIso;
  datesRenseignees: readonly DateIso[];
}): Completude {
  const joursTotal = nombreJoursInclus(entree.dateDebut, entree.dateFin);
  const uniques = new Set(entree.datesRenseignees);
  const joursRenseignes = uniques.size;

  return {
    taux: joursTotal <= 0 ? 0 : joursRenseignes / joursTotal,
    joursRenseignes,
    joursEstimes: 0,
    joursManquants: Math.max(0, joursTotal - joursRenseignes),
    joursTotal: Math.max(0, joursTotal),
  };
}

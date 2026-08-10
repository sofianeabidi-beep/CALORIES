import {
  AGE_MINIMUM,
  ALLURE_MAX_FRACTION_POIDS,
  IMC_MINIMUM,
  PLANCHER_KCAL,
} from './constantes';
import { calculerAge } from './dates';
import { calculerImc } from './poids';
import type { DateIso, Sexe } from './types';

/**
 * Garde-fous de la spec §9.
 *
 * Ces règles ne relèvent pas de la prudence excessive : une application
 * de suivi calorique mal conçue peut faire du mal, et ces bornes
 * conditionnent aussi la validation par les stores.
 *
 * **Chaque règle est appliquée à trois niveaux** — en base par trigger,
 * ici pour la validation partagée, et dans l'interface. Une seule des
 * trois couches ne suffit pas : ce module couvre la couche du milieu, il
 * ne dispense pas des deux autres.
 *
 * Aucune fonction de ce fichier ne bloque brutalement : elles signalent.
 * Le ton des messages destinés à l'utilisateur est mesuré, jamais
 * moralisateur, et ces textes doivent être relus par un professionnel de
 * santé avant mise en production.
 */

/** Plancher calorique applicable, en kcal (spec §9). */
export function plancherCalorique(sexe: Sexe): number {
  return PLANCHER_KCAL[sexe];
}

export interface VerificationObjectifKcal {
  readonly conforme: boolean;
  /** Objectif effectivement retenu : plafonné au plancher si besoin. */
  readonly objectifRetenuKcal: number;
  readonly plancherKcal: number;
  /** Vrai quand la valeur demandée a dû être relevée. */
  readonly plafonne: boolean;
}

/**
 * Objectif calorique jamais inférieur à 1 200 kcal (femme) ou
 * 1 500 kcal (homme). Sous le plancher, la valeur est **relevée** et
 * l'utilisateur invité à consulter un professionnel de santé — on ne
 * refuse pas l'enregistrement, on corrige et on explique.
 */
export function verifierObjectifKcal(entree: {
  sexe: Sexe;
  objectifKcal: number;
}): VerificationObjectifKcal {
  const plancher = plancherCalorique(entree.sexe);
  const sousPlancher = entree.objectifKcal < plancher;

  return {
    conforme: !sousPlancher,
    objectifRetenuKcal: sousPlancher ? plancher : entree.objectifKcal,
    plancherKcal: plancher,
    plafonne: sousPlancher,
  };
}

export interface VerificationPoidsCible {
  readonly conforme: boolean;
  readonly imcCible: number;
  readonly imcMinimum: number;
  /** Poids le plus bas acceptable pour cette taille, en kg. */
  readonly poidsMinimumKg: number;
}

/** Aucun poids cible ne peut conduire à un IMC inférieur à 18,5 (spec §9). */
export function verifierPoidsCible(entree: {
  poidsCibleKg: number;
  tailleCm: number;
}): VerificationPoidsCible {
  const imcCible = calculerImc(entree.poidsCibleKg, entree.tailleCm);
  const tailleM = entree.tailleCm / 100;

  return {
    conforme: imcCible >= IMC_MINIMUM,
    imcCible,
    imcMinimum: IMC_MINIMUM,
    poidsMinimumKg: IMC_MINIMUM * tailleM * tailleM,
  };
}

export interface VerificationAllure {
  readonly conforme: boolean;
  readonly allureMaxKgSemaine: number;
  readonly allureRetenueKgSemaine: number;
}

/**
 * Allure limitée à 1 % du poids corporel par semaine (spec §9).
 *
 * La limite porte sur la valeur absolue : une prise de masse trop rapide
 * est bornée comme une perte trop rapide. Le surplus n'est pas un mode
 * dégradé du déficit.
 */
export function verifierAllure(entree: {
  allureKgSemaine: number;
  poidsActuelKg: number;
}): VerificationAllure {
  const max = ALLURE_MAX_FRACTION_POIDS * entree.poidsActuelKg;
  const ampleur = Math.abs(entree.allureKgSemaine);
  const conforme = ampleur <= max;
  const signe = entree.allureKgSemaine < 0 ? -1 : 1;

  return {
    conforme,
    allureMaxKgSemaine: max,
    allureRetenueKgSemaine: conforme ? entree.allureKgSemaine : signe * max,
  };
}

/** Âge minimum de 18 ans, contrôlé à l'inscription (spec §9). */
export function verifierAge(entree: {
  dateNaissance: DateIso;
  dateReference: DateIso;
}): { conforme: boolean; age: number; ageMinimum: number } {
  const age = calculerAge(entree.dateNaissance, entree.dateReference);
  return { conforme: age >= AGE_MINIMUM, age, ageMinimum: AGE_MINIMUM };
}

export type SignalAlerte =
  | 'restriction_severe_prolongee'
  | 'jours_a_zero_repetes'
  | 'objectif_a_la_limite';

/**
 * Signaux d'alerte de la spec §9.
 *
 * Détectés ici, restitués ailleurs. La réponse attendue est un message
 * de soutien mesuré et une orientation vers des ressources — **jamais**
 * un blocage brutal, jamais un ton moralisateur, jamais une mécanique
 * punitive. Les libellés associés sont provisoires tant qu'un
 * professionnel de santé ne les a pas relus.
 */
export function detecterSignaux(entree: {
  sexe: Sexe;
  objectifKcal: number;
  /** Apports des derniers jours, `null` pour un jour non renseigné. */
  apportsRecents: readonly (number | null)[];
  /** Nombre de jours consécutifs sous le plancher qui déclenche le signal. */
  seuilJoursRestriction?: number;
}): SignalAlerte[] {
  const plancher = plancherCalorique(entree.sexe);
  const seuilJours = entree.seuilJoursRestriction ?? 7;
  const signaux: SignalAlerte[] = [];

  const renseignes = entree.apportsRecents.filter((a): a is number => a !== null);

  const joursSousPlancher = renseignes.filter((a) => a > 0 && a < plancher).length;
  if (joursSousPlancher >= seuilJours) {
    signaux.push('restriction_severe_prolongee');
  }

  const joursAZero = renseignes.filter((a) => a === 0).length;
  if (joursAZero >= 2) {
    signaux.push('jours_a_zero_repetes');
  }

  if (entree.objectifKcal <= plancher) {
    signaux.push('objectif_a_la_limite');
  }

  return signaux;
}

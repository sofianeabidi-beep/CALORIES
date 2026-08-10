/**
 * Types du domaine, partagés par tout le moteur de calcul.
 *
 * Les unités sont dans le nom des champs. Une valeur numérique sans
 * unité est un bug en puissance : le moteur mélange des kcal, des kg,
 * des grammes et des jours.
 */

/** Date au format `YYYY-MM-DD`. Jamais un `Date` : ni fuseau, ni locale. */
export type DateIso = string;

export type Sexe = 'h' | 'f';

export type NiveauActivite = 'sedentaire' | 'leger' | 'modere' | 'soutenu' | 'tres_soutenu';

/** Traitement des jours non renseignés dans les cumuls (spec §6.5). */
export type ModeJoursManquants = 'neutre' | 'estime' | 'strict';

export type StatutJournee = 'renseigne' | 'estime' | 'manquant';

export type TypeProgramme = 'deficit' | 'surplus' | 'maintien';

/** Profil réduit à ce dont le moteur a besoin. */
export interface ProfilCalcul {
  readonly sexe: Sexe;
  readonly dateNaissance: DateIso;
  readonly tailleCm: number;
  readonly niveauActivite: NiveauActivite;
}

/** Apport d'une journée. `apportKcal` vaut `null` si le jour n'est pas renseigné. */
export interface ApportJournalier {
  readonly date: DateIso;
  readonly apportKcal: number | null;
}

/** Pesée brute, telle que saisie. */
export interface PeseeBrute {
  readonly date: DateIso;
  readonly poidsKg: number;
}

/** Pesée après passage de la moyenne mobile et du contrôle d'aberration. */
export interface PeseeLissee extends PeseeBrute {
  /** `null` tant qu'aucune moyenne n'est calculable (première pesée). */
  readonly moyenneMobile7jKg: number | null;
  /** Enregistrée mais exclue de la moyenne, l'utilisateur doit confirmer. */
  readonly aberrante: boolean;
}

/** Journée après résolution du mode de jours manquants et du déficit. */
export interface JourneeCalculee {
  readonly date: DateIso;
  readonly statut: StatutJournee;
  /** Apport retenu pour le calcul, estimé le cas échéant. `null` si le jour est exclu. */
  readonly apportRetenuKcal: number | null;
  readonly depenseRetenueKcal: number;
  /** `null` quand le jour est exclu du cumul (mode `neutre`). */
  readonly deficitKcal: number | null;
}

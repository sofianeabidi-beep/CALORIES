import {
  FACTEURS_ACTIVITE,
  FENETRE_DEPENSE_REELLE_JOURS,
  KCAL_PAR_KG,
  LISSAGE_DEPENSE_MAX,
  MIN_ECART_PESEES_JOURS,
  MIN_JOURS_RENSEIGNES_DEPENSE,
  MIN_PESEES_DEPENSE,
  SEUIL_FIABILITE_DEPENSE_REELLE,
} from './constantes';
import { ajouterJours, differenceJours, estDansPlage } from './dates';
import type { ApportJournalier, DateIso, NiveauActivite, PeseeLissee, Sexe } from './types';

/**
 * Métabolisme de base par Mifflin-St Jeor (spec §6.1).
 *
 * Retenue plutôt que Harris-Benedict, plus précise sur les populations
 * actuelles.
 */
export function metabolismeDeBase(entree: {
  sexe: Sexe;
  poidsKg: number;
  tailleCm: number;
  ageAns: number;
}): number {
  const { sexe, poidsKg, tailleCm, ageAns } = entree;
  const base = 10 * poidsKg + 6.25 * tailleCm - 5 * ageAns;
  return sexe === 'h' ? base + 5 : base - 161;
}

/**
 * Dépense totale estimée (spec §6.2).
 *
 * C'est un **point de départ**, à afficher comme tel. Jamais présentée
 * comme une vérité : c'est précisément l'écart entre cette formule et la
 * réalité que le produit existe pour mesurer.
 */
export function depenseEstimee(entree: {
  sexe: Sexe;
  poidsKg: number;
  tailleCm: number;
  ageAns: number;
  niveauActivite: NiveauActivite;
}): number {
  return metabolismeDeBase(entree) * FACTEURS_ACTIVITE[entree.niveauActivite];
}

/** Pourquoi la dépense réelle n'est pas calculable. */
export type RaisonDepenseReelleIndisponible =
  | 'jours_renseignes_insuffisants'
  | 'pesees_insuffisantes'
  | 'pesees_trop_rapprochees';

export interface ResultatDepenseReelle {
  readonly depenseReelleKcal: number | null;
  /** Jours renseignés rapportés à la fenêtre. Exposée à l'interface (spec §6.3). */
  readonly fiabilite: number;
  readonly joursRenseignes: number;
  readonly joursFenetre: number;
  readonly raisonIndisponible: RaisonDepenseReelleIndisponible | null;
}

/**
 * Dépense réelle recalculée par bilan énergétique inverse (spec §6.3).
 * C'est la fonction différenciante du produit : l'application apprend le
 * métabolisme réel de l'utilisateur au lieu de lui imposer une formule.
 *
 * ```
 * dépense_réelle = apport_moyen − (variation_poids × 7700 / nb_jours)
 * ```
 *
 * **Sur le signe.** La spec §6.3 et le brief §3.2 écrivent `+ (Δ poids
 * × 7700 / n)`. Cette écriture n'est juste que si `Δ` désigne la *perte*
 * (positive quand on maigrit). Ici `variationKg = poidsFin − poidsDébut`
 * est négatif quand on maigrit, donc le signe est `−`. Vérification :
 * 2 000 kcal/j et 1 kg perdu en 28 j donnent
 * `2000 − (−1 × 7700 / 28) = 2275` kcal/j de dépense réelle. Une dépense
 * supérieure à l'apport, ce qui est bien la définition d'une perte.
 *
 * La variation est mesurée sur la **moyenne mobile**, pas sur les pesées
 * brutes : un kilo d'eau un matin fausserait toute la dépense.
 */
export function depenseReelle(entree: {
  dateFin: DateIso;
  apports: readonly ApportJournalier[];
  pesees: readonly PeseeLissee[];
  joursFenetre?: number;
}): ResultatDepenseReelle {
  const joursFenetre = entree.joursFenetre ?? FENETRE_DEPENSE_REELLE_JOURS;
  const dateDebut = ajouterJours(entree.dateFin, -(joursFenetre - 1));

  const apportsFenetre = entree.apports
    .filter((a) => estDansPlage(a.date, dateDebut, entree.dateFin))
    .map((a) => a.apportKcal)
    .filter((kcal): kcal is number => kcal !== null);
  const joursRenseignes = apportsFenetre.length;
  const fiabilite = joursRenseignes / joursFenetre;

  const indisponible = (
    raison: RaisonDepenseReelleIndisponible,
  ): ResultatDepenseReelle => ({
    depenseReelleKcal: null,
    fiabilite,
    joursRenseignes,
    joursFenetre,
    raisonIndisponible: raison,
  });

  if (joursRenseignes < MIN_JOURS_RENSEIGNES_DEPENSE) {
    return indisponible('jours_renseignes_insuffisants');
  }

  // Les pesées aberrantes sont exclues : elles sont conservées en base
  // mais ne doivent pas peser sur un indicateur de cette importance.
  const peseesFenetre = entree.pesees
    .filter((p) => !p.aberrante && p.moyenneMobile7jKg !== null)
    .filter((p) => estDansPlage(p.date, dateDebut, entree.dateFin))
    .slice()
    .sort((a, b) => differenceJours(b.date, a.date));

  if (peseesFenetre.length < MIN_PESEES_DEPENSE) {
    return indisponible('pesees_insuffisantes');
  }

  const premiere = peseesFenetre[0];
  const derniere = peseesFenetre[peseesFenetre.length - 1];
  /* c8 ignore next 3 -- longueur >= 2 garantie ci-dessus, garde de typage */
  if (premiere === undefined || derniere === undefined) {
    return indisponible('pesees_insuffisantes');
  }

  const ecartJours = differenceJours(premiere.date, derniere.date);
  if (ecartJours < MIN_ECART_PESEES_JOURS) {
    return indisponible('pesees_trop_rapprochees');
  }

  const apportMoyen =
    apportsFenetre.reduce((somme, kcal) => somme + kcal, 0) / joursRenseignes;

  // `moyenneMobile7jKg` est non nul, le filtre l'a garanti.
  const variationKg =
    (derniere.moyenneMobile7jKg as number) - (premiere.moyenneMobile7jKg as number);

  return {
    depenseReelleKcal: apportMoyen - (variationKg * KCAL_PAR_KG) / ecartJours,
    fiabilite,
    joursRenseignes,
    joursFenetre,
    raisonIndisponible: null,
  };
}

export interface ResultatDepenseRetenue {
  readonly depenseRetenueKcal: number;
  /** `true` dès que la dépense réelle a remplacé l'estimation. */
  readonly issueDuReel: boolean;
  /** `true` si le lissage a bridé la variation du jour. */
  readonly lissee: boolean;
}

/**
 * Dépense finalement retenue pour les calculs du jour (spec §6.3).
 *
 * Dès que `fiabilite ≥ 0,6`, la dépense réelle **remplace** l'estimation.
 * Le basculement doit être signalé explicitement à l'utilisateur : un
 * chiffre qui change sans explication détruit la confiance.
 *
 * Le lissage borne ensuite la variation à 5 % par jour, pour éviter des
 * sauts d'indicateurs déroutants. Il s'applique aussi au basculement
 * lui-même, qui serait sinon la plus brutale des marches.
 */
export function depenseRetenue(entree: {
  depenseEstimeeKcal: number;
  depenseReelleKcal: number | null;
  fiabilite: number;
  /** Dépense retenue la veille. `null` le premier jour du programme. */
  depenseRetenueVeilleKcal: number | null;
}): ResultatDepenseRetenue {
  const utiliseReel =
    entree.depenseReelleKcal !== null && entree.fiabilite >= SEUIL_FIABILITE_DEPENSE_REELLE;
  const cible = utiliseReel
    ? (entree.depenseReelleKcal as number)
    : entree.depenseEstimeeKcal;

  const veille = entree.depenseRetenueVeilleKcal;
  if (veille === null || veille <= 0) {
    return { depenseRetenueKcal: cible, issueDuReel: utiliseReel, lissee: false };
  }

  const plancher = veille * (1 - LISSAGE_DEPENSE_MAX);
  const plafond = veille * (1 + LISSAGE_DEPENSE_MAX);
  const borne = Math.min(plafond, Math.max(plancher, cible));

  return {
    depenseRetenueKcal: borne,
    issueDuReel: utiliseReel,
    lissee: borne !== cible,
  };
}

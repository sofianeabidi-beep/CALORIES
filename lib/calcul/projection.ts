import {
  HORIZON_PROJECTION_JOURS,
  MARGE_PROJECTION,
  MIN_JOURS_PROJECTION,
  RYTHME_MINIMUM_PROJECTION_KG_SEMAINE,
} from './constantes';
import { ajouterJours } from './dates';
import type { DateIso } from './types';

export type RaisonProjectionMasquee =
  | 'donnees_insuffisantes'
  | 'objectif_atteint'
  | 'rythme_trop_faible'
  | 'rythme_oppose_a_objectif'
  | 'horizon_trop_lointain';

export interface Projection {
  readonly affichable: boolean;
  readonly raisonMasquee: RaisonProjectionMasquee | null;
  readonly rythmeKgParSemaine: number | null;
  /** Borne haute du rythme : atteinte la plus rapide. */
  readonly dateOptimiste: DateIso | null;
  readonly dateMediane: DateIso | null;
  readonly datePrudente: DateIso | null;
}

const MASQUEE = (raison: RaisonProjectionMasquee): Projection => ({
  affichable: false,
  raisonMasquee: raison,
  rythmeKgParSemaine: null,
  dateOptimiste: null,
  dateMediane: null,
  datePrudente: null,
});

/**
 * Date estimée d'atteinte de l'objectif (spec §6.7).
 *
 * Calculée sur le **rythme réel des 28 derniers jours**, jamais sur
 * l'objectif théorique : projeter l'objectif reviendrait à afficher à
 * l'utilisateur ce qu'il a demandé plutôt que ce qui se passe.
 *
 * Restituée en fourchette, et **masquée** dès que les données ne la
 * portent pas : moins de 21 jours, rythme quasi nul, rythme allant à
 * l'opposé de l'objectif, ou échéance au-delà de deux ans. Mieux vaut
 * n'afficher aucune date qu'une date fausse.
 */
export function projeterAtteinteObjectif(entree: {
  dateReference: DateIso;
  poidsActuelKg: number;
  poidsCibleKg: number;
  /** Rythme observé, négatif en perte. Voir `tendancePoids`. */
  rythmeKgParSemaine: number | null;
  /** Nombre de jours de données disponibles sur la fenêtre observée. */
  joursDonnees: number;
}): Projection {
  if (entree.joursDonnees < MIN_JOURS_PROJECTION) {
    return MASQUEE('donnees_insuffisantes');
  }

  const rythme = entree.rythmeKgParSemaine;
  if (rythme === null) return MASQUEE('donnees_insuffisantes');

  const ecartKg = entree.poidsCibleKg - entree.poidsActuelKg;
  if (ecartKg === 0) return MASQUEE('objectif_atteint');

  if (Math.abs(rythme) < RYTHME_MINIMUM_PROJECTION_KG_SEMAINE) {
    return MASQUEE('rythme_trop_faible');
  }

  // Le rythme doit aller dans le sens de l'objectif : perdre quand la
  // cible est plus basse, prendre quand elle est plus haute.
  if (Math.sign(ecartKg) !== Math.sign(rythme)) {
    return MASQUEE('rythme_oppose_a_objectif');
  }

  const joursPour = (rythmeApplique: number): number =>
    Math.ceil((ecartKg / rythmeApplique) * 7);

  const jourMediane = joursPour(rythme);
  const jourOptimiste = joursPour(rythme * (1 + MARGE_PROJECTION));
  const jourPrudente = joursPour(rythme * (1 - MARGE_PROJECTION));

  if (jourPrudente > HORIZON_PROJECTION_JOURS) {
    return MASQUEE('horizon_trop_lointain');
  }

  return {
    affichable: true,
    raisonMasquee: null,
    rythmeKgParSemaine: rythme,
    dateOptimiste: ajouterJours(entree.dateReference, jourOptimiste),
    dateMediane: ajouterJours(entree.dateReference, jourMediane),
    datePrudente: ajouterJours(entree.dateReference, jourPrudente),
  };
}

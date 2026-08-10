import { ECART_ABERRANT_KG, FENETRE_MOYENNE_MOBILE_JOURS } from './constantes';
import { ajouterJours, differenceJours, estDansPlage } from './dates';
import type { DateIso, PeseeBrute, PeseeLissee } from './types';

function moyenne(valeurs: readonly number[]): number | null {
  if (valeurs.length === 0) return null;
  return valeurs.reduce((somme, v) => somme + v, 0) / valeurs.length;
}

/**
 * Moyenne mobile 7 jours et détection des pesées aberrantes (spec §6.6).
 *
 * Le poids d'un matin ne veut rien dire : eau, sel, transit et cycle
 * hormonal font varier la balance de plus d'un kilo sans qu'un gramme de
 * masse grasse ait bougé. C'est la moyenne mobile qui est affichée par
 * défaut ; les pesées brutes restent accessibles à la demande.
 *
 * Une pesée s'écartant de plus de 2 kg de la moyenne des jours
 * précédents est **enregistrée**, marquée `aberrante` et exclue de la
 * moyenne — jamais rejetée ni écrasée. L'utilisateur est invité à
 * confirmer : c'est peut-être une vraie valeur, c'est peut-être une
 * faute de frappe, et le produit n'a pas à trancher à sa place.
 *
 * La fenêtre est calendaire, pas un nombre de pesées : quelqu'un qui se
 * pèse deux fois par semaine obtient une moyenne sur ses deux valeurs de
 * la semaine, pas sur trois semaines et demie d'historique.
 */
export function lisserPesees(pesees: readonly PeseeBrute[]): PeseeLissee[] {
  const chronologiques = pesees
    .slice()
    .sort((a, b) => differenceJours(b.date, a.date));

  const retenues: PeseeBrute[] = [];

  return chronologiques.map((pesee) => {
    const debutFenetre = ajouterJours(pesee.date, -(FENETRE_MOYENNE_MOBILE_JOURS - 1));
    const veille = ajouterJours(pesee.date, -1);

    // Référence : uniquement les jours *précédents*. Inclure la pesée
    // du jour dans sa propre référence la tirerait vers elle et
    // empêcherait de détecter une valeur franchement fausse.
    const reference = moyenne(
      retenues
        .filter((p) => estDansPlage(p.date, debutFenetre, veille))
        .map((p) => p.poidsKg),
    );

    const aberrante =
      reference !== null && Math.abs(pesee.poidsKg - reference) > ECART_ABERRANT_KG;

    if (!aberrante) retenues.push(pesee);

    const moyenneMobile7jKg = moyenne(
      retenues
        .filter((p) => estDansPlage(p.date, debutFenetre, pesee.date))
        .map((p) => p.poidsKg),
    );

    return { ...pesee, moyenneMobile7jKg, aberrante };
  });
}

export interface TendancePoids {
  readonly kgParSemaine: number;
  /** Rapportée au poids corporel : 0,5 kg n'a pas le même sens à 55 et à 110 kg. */
  readonly pourcentPoidsParSemaine: number;
  readonly joursObserves: number;
  readonly poidsDebutKg: number;
  readonly poidsFinKg: number;
}

/**
 * Tendance en kg/semaine et en pourcentage du poids corporel (spec §6.6).
 *
 * Calculée sur les extrémités de la moyenne mobile plutôt que par
 * régression : le résultat doit rester recalculable à la main depuis
 * l'export (critère d'acceptation §14).
 */
export function tendancePoids(entree: {
  pesees: readonly PeseeLissee[];
  dateFin: DateIso;
  joursFenetre: number;
}): TendancePoids | null {
  const debut = ajouterJours(entree.dateFin, -(entree.joursFenetre - 1));

  const utilisables = entree.pesees
    .filter((p) => !p.aberrante && p.moyenneMobile7jKg !== null)
    .filter((p) => estDansPlage(p.date, debut, entree.dateFin))
    .slice()
    .sort((a, b) => differenceJours(b.date, a.date));

  if (utilisables.length < 2) return null;
  const premiere = utilisables[0];
  const derniere = utilisables[utilisables.length - 1];
  /* c8 ignore next -- longueur >= 2 vérifiée juste au-dessus, garde de typage */
  if (premiere === undefined || derniere === undefined) return null;

  const joursObserves = differenceJours(premiere.date, derniere.date);
  // Une seule pesée, ou plusieurs le même jour : aucune tendance.
  if (joursObserves <= 0) return null;

  const poidsDebutKg = premiere.moyenneMobile7jKg as number;
  const poidsFinKg = derniere.moyenneMobile7jKg as number;
  const kgParSemaine = ((poidsFinKg - poidsDebutKg) / joursObserves) * 7;

  return {
    kgParSemaine,
    pourcentPoidsParSemaine: (kgParSemaine / poidsDebutKg) * 100,
    joursObserves,
    poidsDebutKg,
    poidsFinKg,
  };
}

/**
 * Poids retenu à une date : la moyenne mobile la plus récente qui ne lui
 * soit pas postérieure. À défaut de toute pesée utilisable, le poids par
 * défaut — le poids de départ du programme, en pratique.
 *
 * Le moteur ne doit jamais raisonner sur une pesée brute : c'est la
 * moyenne mobile qui alimente la dépense réelle et l'écart théorie/réel.
 */
export function poidsALaDate(entree: {
  pesees: readonly PeseeLissee[];
  date: DateIso;
  poidsDefautKg: number;
}): number {
  const anterieures = entree.pesees
    .filter((p) => !p.aberrante && p.moyenneMobile7jKg !== null)
    .filter((p) => differenceJours(p.date, entree.date) >= 0)
    .slice()
    .sort((a, b) => differenceJours(b.date, a.date));

  const derniere = anterieures[anterieures.length - 1];
  return derniere === undefined
    ? entree.poidsDefautKg
    : (derniere.moyenneMobile7jKg as number);
}

/** Indice de masse corporelle. Sert aux garde-fous, jamais affiché comme un verdict. */
export function calculerImc(poidsKg: number, tailleCm: number): number {
  if (tailleCm <= 0) {
    throw new RangeError('La taille doit être strictement positive.');
  }
  const tailleM = tailleCm / 100;
  return poidsKg / (tailleM * tailleM);
}

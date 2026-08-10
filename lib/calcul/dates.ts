import type { DateIso } from './types';

/**
 * Arithmétique de dates sur des chaînes `YYYY-MM-DD`.
 *
 * Tout passe par UTC. Un `new Date('2026-03-29')` interprété en heure
 * locale décale d'un jour selon le fuseau et selon le passage à l'heure
 * d'été — c'est exactement le genre de bug qui décale un déficit cumulé
 * d'une journée entière sans que personne ne le voie.
 */

const MOTIF_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PAR_JOUR = 86_400_000;

/** Vrai si la chaîne est une date `YYYY-MM-DD` réellement existante. */
export function estDateIso(valeur: string): boolean {
  if (!MOTIF_DATE.test(valeur)) return false;
  const annee = Number(valeur.slice(0, 4));
  const mois = Number(valeur.slice(5, 7));
  const jour = Number(valeur.slice(8, 10));
  if (mois < 1 || mois > 12 || jour < 1 || jour > 31) return false;
  const d = new Date(Date.UTC(annee, mois - 1, jour));
  // Rejette le 31 février, que `Date.UTC` reporterait silencieusement
  // sur le 2 ou le 3 mars.
  return (
    d.getUTCFullYear() === annee && d.getUTCMonth() === mois - 1 && d.getUTCDate() === jour
  );
}

/**
 * Convertit en horodatage UTC. Échoue bruyamment sur une date invalide :
 * une date silencieusement fausse fausse tous les cumuls en aval.
 */
function versHorodatage(date: DateIso): number {
  if (!estDateIso(date)) {
    throw new RangeError(`Date invalide, format YYYY-MM-DD attendu : « ${date} »`);
  }
  return Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  );
}

function versDateIso(horodatage: number): DateIso {
  return new Date(horodatage).toISOString().slice(0, 10);
}

/** Décale une date d'un nombre de jours, positif ou négatif. */
export function ajouterJours(date: DateIso, jours: number): DateIso {
  return versDateIso(versHorodatage(date) + jours * MS_PAR_JOUR);
}

/**
 * Nombre de jours de `depuis` vers `jusqu`. Positif si `jusqu` est
 * postérieure. `differenceJours('2026-01-01', '2026-01-03')` vaut 2.
 */
export function differenceJours(depuis: DateIso, jusqu: DateIso): number {
  return Math.round((versHorodatage(jusqu) - versHorodatage(depuis)) / MS_PAR_JOUR);
}

/** Nombre de jours d'une plage bornes comprises. Vaut 1 si `debut === fin`. */
export function nombreJoursInclus(debut: DateIso, fin: DateIso): number {
  return differenceJours(debut, fin) + 1;
}

/** Toutes les dates de `debut` à `fin`, bornes comprises. Vide si `fin < debut`. */
export function plageDates(debut: DateIso, fin: DateIso): DateIso[] {
  const total = differenceJours(debut, fin);
  if (total < 0) return [];
  const dates: DateIso[] = [];
  for (let i = 0; i <= total; i += 1) {
    dates.push(ajouterJours(debut, i));
  }
  return dates;
}

/** Vrai si `date` est comprise entre `debut` et `fin`, bornes comprises. */
export function estDansPlage(date: DateIso, debut: DateIso, fin: DateIso): boolean {
  const t = versHorodatage(date);
  return t >= versHorodatage(debut) && t <= versHorodatage(fin);
}

/**
 * Âge en années révolues à la date de référence.
 *
 * Sert au métabolisme de base **et** au contrôle des 18 ans : il ne peut
 * pas dépendre de l'horloge de la machine, d'où la date de référence
 * explicite.
 */
export function calculerAge(dateNaissance: DateIso, dateReference: DateIso): number {
  const naissance = versHorodatage(dateNaissance);
  const reference = versHorodatage(dateReference);
  if (reference < naissance) {
    throw new RangeError('La date de référence précède la date de naissance.');
  }
  const anneeN = Number(dateNaissance.slice(0, 4));
  const anneeR = Number(dateReference.slice(0, 4));
  let age = anneeR - anneeN;
  const anneeRef = String(anneeR).padStart(4, '0');
  const candidat = `${anneeRef}${dateNaissance.slice(4)}`;
  // Né un 29 février, l'année de référence n'étant pas bissextile :
  // l'anniversaire est réputé tomber le 1er mars (convention française).
  const anniversaire = estDateIso(candidat) ? candidat : `${anneeRef}-03-01`;
  if (versHorodatage(anniversaire) > reference) {
    age -= 1;
  }
  return age;
}

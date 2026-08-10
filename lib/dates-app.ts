import type { DateIso } from '@/lib/calcul';

/**
 * Date du jour, côté application.
 *
 * Le moteur de calcul ne lit jamais l'horloge : c'est ici, et seulement
 * ici, que « aujourd'hui » se décide. Toute fonction du moteur reçoit
 * ensuite cette date en paramètre.
 *
 * La locale `sv-SE` produit nativement le format `YYYY-MM-DD`, ce qui
 * évite de recomposer la chaîne à la main.
 */
export const FUSEAU_PAR_DEFAUT = 'Europe/Paris';

export function aujourdhuiIso(fuseau: string = FUSEAU_PAR_DEFAUT): DateIso {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: fuseau }).format(new Date());
}

/**
 * Formatage lisible d'une date `YYYY-MM-DD`.
 *
 * Passe par UTC : `new Date('2026-03-15')` interprété en heure locale
 * affiche le 14 mars dans tout fuseau négatif.
 */
export function formaterDate(
  date: DateIso,
  options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' },
): string {
  return new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

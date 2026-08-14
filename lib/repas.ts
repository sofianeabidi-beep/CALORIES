import type { Repas } from '@/lib/supabase/types';

/**
 * Vocabulaire des repas — un seul endroit plutôt que trois copies
 * (saisie, alimentation du jour, suggestion) qui auraient fini par
 * diverger sur un libellé ou un ordre.
 */
export const LIBELLES_REPAS: Record<Repas, string> = {
  petit_dejeuner: 'Petit-déjeuner',
  dejeuner: 'Déjeuner',
  diner: 'Dîner',
  collation: 'Collation',
};

export const ORDRE_REPAS: readonly Repas[] = ['petit_dejeuner', 'dejeuner', 'diner', 'collation'];

export const OPTIONS_REPAS = ORDRE_REPAS.map((valeur) => ({
  valeur,
  texte: LIBELLES_REPAS[valeur],
}));

/** Repas le plus probable compte tenu de l'heure — un point de départ, jamais imposé. */
export function repasParDefaut(): Repas {
  const heure = new Date().getHours();
  if (heure < 11) return 'petit_dejeuner';
  if (heure < 15) return 'dejeuner';
  if (heure < 21) return 'diner';
  return 'collation';
}

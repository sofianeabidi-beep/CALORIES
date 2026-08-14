import type { CSSProperties } from 'react';

/**
 * Délai croissant pour la cascade d'entrée des cartes — voir `.entree-douce`
 * dans globals.css.
 *
 * Séparé de `primitives.tsx` : c'est une fonction pure appelée depuis des
 * pages serveur (Aujourd'hui, Bilan). Si elle vivait dans `primitives.tsx`
 * (`'use client'`), l'appel échouerait — un module client ne peut être
 * qu'importé comme composant ou passé en prop depuis un composant serveur,
 * jamais invoqué directement comme fonction.
 */
export function delaiEntree(rang: number): CSSProperties {
  return { '--delai-entree': `${rang * 60}ms` } as CSSProperties;
}

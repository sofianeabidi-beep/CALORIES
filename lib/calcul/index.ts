/**
 * Moteur de calcul — surface publique.
 *
 * Bibliothèque **pure** : aucun accès base, aucun réseau, aucun
 * `Date.now()`, aucune dépendance à la locale. Toute date entre sous
 * forme de chaîne `YYYY-MM-DD` et la date du jour est toujours un
 * paramètre.
 *
 * Elle tourne indifféremment sur le serveur et dans le navigateur : c'est
 * ce qui permet aux indicateurs de rester justes hors ligne, sur les
 * données locales, avant confirmation par le serveur (spec §8).
 *
 * Couverture de tests exigée à 100 %, seuil imposé par `vitest.config.ts`.
 * Une erreur ici est invisible et grave : elle se propage à tous les
 * chiffres du produit.
 */

export * from './constantes';
export * from './types';
export * from './dates';
export * from './depense';
export * from './deficit';
export * from './poids';
export * from './completude';
export * from './projection';
export * from './gardefous';
export * from './bilan';
export * from './tendance';
export * from './statutJour';
export * from './macros';

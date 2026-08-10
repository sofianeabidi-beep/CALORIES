/**
 * Schémas Zod partagés client et serveur.
 *
 * Ils constituent la **deuxième** des trois couches de garde-fous
 * (spec §9), entre les triggers SQL et l'interface. Ils s'appuient sur
 * les fonctions de `lib/calcul/` plutôt que de redéfinir les bornes :
 * une règle réécrite ici finirait par diverger de la base.
 *
 * Toute Server Action valide ses entrées avec ces schémas. La validation
 * côté client sert au confort de saisie, jamais de barrière.
 */

export * from './commun';
export * from './profil';
export * from './programme';
export * from './journal';

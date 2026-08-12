/**
 * Lecture des variables d'environnement Supabase.
 *
 * Isolée pour une raison : c'est le seul endroit où une confusion entre
 * clé publique et `service_role` est possible. Une clé de service qui
 * fuit vers le client donne un accès complet à toutes les données de
 * santé de tous les utilisateurs, RLS contournée.
 */

/**
 * URL et clé publiques du projet `caloryes` (région eu-west-3).
 *
 * Ce ne sont **pas des secrets** : la clé anonyme est conçue pour finir
 * dans le bundle du navigateur, elle est bornée par la RLS. Les garder
 * ici en repli évite qu'une variable mal collée dans l'interface d'un
 * hébergeur — un caractère invisible copié par erreur, par exemple —
 * ne rende l'application injoignable.
 */
const URL_PAR_DEFAUT = 'https://mwwndxahugyloylsmdkw.supabase.co';
const CLE_ANON_PAR_DEFAUT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13d25keGFodWd5bG95bHNtZGt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNzM2NTYsImV4cCI6MjEwMTk0OTY1Nn0.LIJlCQQNVsbwNB-kR-nOxltLaNgPQECqCrxyA2J6x7M';

/**
 * Filtre les caractères hors de la plage ASCII imprimable.
 *
 * C'est exactement ce qui a cassé l'inscription en production : une
 * puce « • » (U+2022) glissée dans la valeur collée sur Vercel a fait
 * échouer la construction de l'en-tête HTTP porté par le client
 * Supabase (`ByteString` exige des codes ≤ 255, et l'erreur n'apparaît
 * qu'à l'usage, jamais au build). Nettoyer la valeur à la lecture rend
 * ce genre de faute de frappe sans conséquence.
 */
function nettoyer(valeur: string): string {
  return valeur.replace(/[^\x20-\x7E]/g, '');
}

function resoudre(nom: string, valeur: string | undefined, parDefaut: string): string {
  const nettoyee = valeur === undefined ? '' : nettoyer(valeur);
  if (nettoyee === '') {
    if (parDefaut === '') {
      throw new Error(
        `Variable d'environnement manquante : ${nom}. Voir .env.example.`,
      );
    }
    return parDefaut;
  }
  return nettoyee;
}

/** Configuration publique, utilisable dans le navigateur. */
export function configPublique(): { url: string; cleAnon: string } {
  return {
    url: resoudre('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL, URL_PAR_DEFAUT),
    cleAnon: resoudre(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      CLE_ANON_PAR_DEFAUT,
    ),
  };
}

/**
 * Clé de service. **Serveur uniquement.**
 *
 * Le garde-fou n'est pas décoratif : `typeof window` est défini dès que
 * ce module est évalué dans un bundle client, ce qui arrive au premier
 * import distrait depuis un composant marqué `'use client'`.
 */
export function cleServiceRole(): string {
  if (typeof window !== 'undefined') {
    throw new Error(
      'La clé service_role ne doit jamais être lue côté client : elle contourne la RLS.',
    );
  }
  // Pas de repli ici, volontairement : c'est un vrai secret, il n'a pas
  // sa place dans le code source. Une valeur manquante doit bloquer,
  // pas être devinée.
  const valeur = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (valeur === undefined || nettoyer(valeur) === '') {
    throw new Error(
      "Variable d'environnement manquante : SUPABASE_SERVICE_ROLE_KEY. Voir .env.example.",
    );
  }
  return nettoyer(valeur);
}

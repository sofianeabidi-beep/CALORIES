/**
 * Lecture des variables d'environnement Supabase.
 *
 * Isolée pour une raison : c'est le seul endroit où une confusion entre
 * clé publique et `service_role` est possible. Une clé de service qui
 * fuit vers le client donne un accès complet à toutes les données de
 * santé de tous les utilisateurs, RLS contournée.
 */

function exiger(nom: string, valeur: string | undefined): string {
  if (valeur === undefined || valeur === '') {
    throw new Error(
      `Variable d'environnement manquante : ${nom}. Voir .env.example.`,
    );
  }
  return valeur;
}

/** Configuration publique, utilisable dans le navigateur. */
export function configPublique(): { url: string; cleAnon: string } {
  return {
    url: exiger('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
    cleAnon: exiger(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
  return exiger('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);
}

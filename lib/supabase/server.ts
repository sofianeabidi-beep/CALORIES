import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cleServiceRole, configPublique } from './env';
import type { Database } from './types';

/**
 * Client serveur, portant la session de l'utilisateur par cookie.
 *
 * C'est celui qu'utilisent les Server Components et les Server Actions.
 * La RLS s'applique : il ne voit que les données de l'utilisateur
 * connecté, ce qui est exactement la garantie voulue.
 */
export async function creerClientServeur() {
  const magasin = await cookies();
  const { url, cleAnon } = configPublique();

  return createServerClient<Database>(url, cleAnon, {
    cookies: {
      getAll() {
        return magasin.getAll();
      },
      setAll(cookiesAEcrire) {
        try {
          for (const { name, value, options } of cookiesAEcrire) {
            magasin.set(name, value, options);
          }
        } catch {
          // Appelé depuis un Server Component : l'écriture de cookies y
          // est interdite. Sans conséquence, le middleware rafraîchit
          // déjà la session à chaque requête.
        }
      },
    },
  });
}

/**
 * Client administrateur. **Contourne la RLS.**
 *
 * Réservé aux opérations qui ne peuvent pas s'exécuter sous l'identité
 * de l'utilisateur : alimentation du catalogue `aliment` depuis Open
 * Food Facts, purge de compte, tâches planifiées.
 *
 * À n'appeler que depuis un Route Handler ou une Server Action, jamais
 * depuis un composant. Chaque usage doit filtrer explicitement sur
 * `user_id` — c'est la seule protection qui reste une fois la RLS hors
 * jeu.
 */
export function creerClientAdmin() {
  const { url } = configPublique();

  return createServerClient<Database>(url, cleServiceRole(), {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        // Aucune session : ce client n'agit au nom de personne.
      },
    },
  });
}

/** Utilisateur connecté, ou `null`. Vérifié auprès du serveur d'auth. */
export async function utilisateurCourant() {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

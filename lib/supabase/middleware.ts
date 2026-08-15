import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { configPublique } from './env';
import type { Database } from './types';

/**
 * Routes accessibles sans session.
 *
 * `/` en exact seulement : la vérification plus bas ajoute un `/` avant
 * `startsWith`, donc `/` comme préfixe donnerait `//`, que plus aucune
 * route ne commence — sans quoi tout chemin (qui commence forcément par
 * `/`) deviendrait public par accident.
 *
 * `/api/cron` : les tâches planifiées (Vercel Cron) appellent ces routes
 * sans cookie de session — elles portent leur propre secret
 * (`CRON_SECRET`, vérifié dans chaque route). Sans cette exception, la
 * redirection vers `/connexion` s'appliquerait avant même que la route
 * ne reçoive la requête, et le cron ne se déclencherait jamais.
 */
const PUBLIQUES = ['/', '/connexion', '/inscription', '/auth', '/api/cron'];

/**
 * Rafraîchit la session à chaque requête et garde les routes privées.
 *
 * `getUser()` et non `getSession()` : `getSession()` lit le cookie sans
 * le valider auprès du serveur d'authentification. Sur des données de
 * santé, un jeton falsifié ne doit pas suffire à franchir la porte —
 * même si la RLS reste la barrière qui compte vraiment.
 */
export async function actualiserSession(requete: NextRequest) {
  let reponse = NextResponse.next({ request: requete });

  const { url, cleAnon } = configPublique();

  const supabase = createServerClient<Database>(url, cleAnon, {
    cookies: {
      getAll() {
        return requete.cookies.getAll();
      },
      setAll(cookiesAEcrire) {
        for (const { name, value } of cookiesAEcrire) {
          requete.cookies.set(name, value);
        }
        reponse = NextResponse.next({ request: requete });
        for (const { name, value, options } of cookiesAEcrire) {
          reponse.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const chemin = requete.nextUrl.pathname;
  const estPublique = PUBLIQUES.some(
    (prefixe) => chemin === prefixe || chemin.startsWith(`${prefixe}/`),
  );

  if (user === null && !estPublique) {
    const destination = requete.nextUrl.clone();
    destination.pathname = '/connexion';
    // Pour revenir où l'utilisateur allait après connexion.
    destination.searchParams.set('suite', chemin);
    return NextResponse.redirect(destination);
  }

  if (user !== null && estPublique) {
    const destination = requete.nextUrl.clone();
    destination.pathname = '/aujourdhui';
    destination.search = '';
    return NextResponse.redirect(destination);
  }

  return reponse;
}

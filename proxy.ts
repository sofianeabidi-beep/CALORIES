import type { NextRequest } from 'next/server';
import { actualiserSession } from '@/lib/supabase/middleware';

export async function proxy(requete: NextRequest) {
  return actualiserSession(requete);
}

export const config = {
  matcher: [
    /*
     * Tout sauf les fichiers statiques et les images. Le service worker
     * et le manifeste sont exclus explicitement : les faire passer par
     * une redirection d'authentification casserait l'installation de la
     * PWA.
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};

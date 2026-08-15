import 'server-only';

/**
 * Clé de l'API Resend. **Serveur uniquement**, jamais un secret
 * `NEXT_PUBLIC_`, jamais lue depuis un composant client.
 *
 * Même filet que `lib/ia/env.ts`/`lib/supabase/env.ts` : nettoyage des
 * caractères hors ASCII imprimable puis vérification de la forme, pas
 * seulement « non vide » — voir l'incident du 2026-08-12 dans CLAUDE.md,
 * une variable mal collée dans l'interface d'un hébergeur peut rester
 * non vide tout en étant inutilisable.
 */
export function cleResend(): string {
  const brute = process.env.RESEND_API_KEY;
  const nettoyee = (brute ?? '').replace(/[^\x20-\x7E]/g, '').trim();

  if (!/^re_[A-Za-z0-9_]{10,}$/.test(nettoyee)) {
    throw new Error(
      "Variable d'environnement manquante ou mal formée : RESEND_API_KEY. Voir .env.example.",
    );
  }

  return nettoyee;
}

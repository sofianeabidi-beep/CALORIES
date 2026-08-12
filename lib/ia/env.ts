import 'server-only';

/**
 * Clé de l'API Anthropic. **Serveur uniquement** — jamais un secret
 * `NEXT_PUBLIC_`, jamais lue depuis un composant client.
 *
 * Même filet de sécurité que `lib/supabase/env.ts` : un incident réel en
 * production (2026-08-12) a montré qu'une variable collée dans
 * l'interface d'un hébergeur peut embarquer un caractère invisible ou se
 * retrouver tronquée sans que rien ne le signale. On nettoie et on
 * vérifie la forme plutôt que de faire confiance à « non vide ».
 */
export function cleAnthropic(): string {
  const brute = process.env.ANTHROPIC_API_KEY;
  const nettoyee = (brute ?? '').replace(/[^\x20-\x7E]/g, '').trim();

  if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(nettoyee)) {
    throw new Error(
      "Variable d'environnement manquante ou mal formée : ANTHROPIC_API_KEY. Voir .env.example.",
    );
  }

  return nettoyee;
}

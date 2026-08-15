import 'server-only';

import { cleResend } from './env';

export type ResultatEnvoiEmail = { ok: true } | { ok: false; erreur: string };

/**
 * Envoi d'un email via l'API Resend, en appel HTTP brut plutôt qu'avec
 * son SDK — même choix que `lib/ia/*.ts` pour l'API Anthropic, pas de
 * nouvelle dépendance npm pour un seul appel `fetch`.
 *
 * `onboarding@resend.dev` en repli : l'adresse de test fournie par
 * Resend, utilisable sans domaine vérifié — pas une valeur inventée,
 * documentée par Resend lui-même. `RESEND_FROM_EMAIL` prend le relais
 * dès qu'un domaine d'expédition réel est vérifié.
 */
export async function envoyerEmail(entree: {
  destinataire: string;
  sujet: string;
  html: string;
}): Promise<ResultatEnvoiEmail> {
  let cle: string;
  try {
    cle = cleResend();
  } catch (erreur) {
    return { ok: false, erreur: (erreur as Error).message };
  }

  const expediteur = process.env.RESEND_FROM_EMAIL ?? 'Symbio <onboarding@resend.dev>';

  try {
    const reponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${cle}`,
      },
      body: JSON.stringify({
        from: expediteur,
        to: [entree.destinataire],
        subject: entree.sujet,
        html: entree.html,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!reponse.ok) {
      const corps: unknown = await reponse.json().catch(() => null);
      const message =
        corps !== null && typeof corps === 'object' && 'message' in corps
          ? String((corps as { message: unknown }).message)
          : `Échec de l'envoi (HTTP ${reponse.status}).`;
      return { ok: false, erreur: message };
    }

    return { ok: true };
  } catch {
    return { ok: false, erreur: 'Service de mail indisponible pour le moment.' };
  }
}

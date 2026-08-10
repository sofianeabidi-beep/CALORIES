'use client';

import { createBrowserClient } from '@supabase/ssr';
import { configPublique } from './env';
import type { Database } from './types';

/**
 * Client navigateur. Ne voit que ce que la RLS laisse passer.
 *
 * Sert à la lecture et à l'authentification. Les **mutations passent par
 * des Server Actions** : la validation Zod côté serveur est la seule qui
 * compte, celle du client n'est qu'un confort de saisie.
 */
export function creerClientNavigateur() {
  const { url, cleAnon } = configPublique();
  return createBrowserClient<Database>(url, cleAnon);
}

'use server';

import { estimerAliment, type ResultatEstimation } from '@/lib/ia/estimation';

/**
 * Point d'entrée client de l'estimation par IA.
 *
 * Appelée directement depuis le formulaire de saisie, pas via un
 * `<form action>` : elle ne mute rien, elle renseigne juste des champs
 * que l'utilisateur reste libre de corriger avant d'enregistrer.
 */
export async function estimerRepasDecrit(description: unknown): Promise<ResultatEstimation> {
  if (typeof description !== 'string') {
    return { succes: false, erreur: 'Description invalide.' };
  }
  return estimerAliment(description);
}

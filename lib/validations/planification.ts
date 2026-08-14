import { z } from 'zod';
import { dateIso } from './commun';

/**
 * Génération d'un plan de semaine.
 *
 * `objectifKcalJour` arrive du client (déjà calculé côté serveur puis
 * transmis au composant, comme `restantKcal` pour la suggestion de
 * repas) — les bornes ci-dessous sont un garde-fou de défense en
 * profondeur, pas la source de vérité du calcul.
 */
export const schemaGenererPlanification = z.object({
  objectifKcalJour: z.number().min(800).max(6000),
  nbRepasJour: z.union([z.literal(3), z.literal(4)]),
  contrainteTemps: z.enum(['rapide', 'elabore']),
});

export const schemaBasculerArticleCourse = z.object({
  semaineDebut: dateIso,
  cle: z.string().trim().min(1).max(200),
  coche: z.boolean(),
});

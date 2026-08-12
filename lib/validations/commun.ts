import { z } from 'zod';
import { estDateIso } from '@/lib/calcul';

/**
 * Briques partagées par tous les schémas.
 *
 * Ces schémas sont utilisés **des deux côtés** : par l'interface pour
 * afficher une erreur avant l'envoi, et par les Server Actions pour
 * valider ce qui arrive réellement. Le client n'est jamais la seule
 * barrière — un appel direct à l'API le contourne.
 */

/** Date `YYYY-MM-DD`, validée par la même fonction que le moteur. */
export const dateIso = z
  .string()
  .refine(estDateIso, { message: 'Date attendue au format AAAA-MM-JJ.' });

/** Identifiant généré par le client, pour une synchronisation idempotente. */
export const uuid = z.uuid({ message: 'Identifiant invalide.' });

export const sexe = z.enum(['h', 'f'], { message: 'Sexe attendu : h ou f.' });

export const niveauActivite = z.enum(
  ['sedentaire', 'leger', 'modere', 'soutenu', 'tres_soutenu'],
  { message: 'Niveau d’activité inconnu.' },
);

export const modeJoursManquants = z.enum(['neutre', 'estime', 'strict'], {
  message: 'Mode de jours manquants inconnu.',
});

export const repas = z.enum(['petit_dejeuner', 'dejeuner', 'diner', 'collation'], {
  message: 'Repas inconnu.',
});

export const sourceEntree = z.enum(
  ['off', 'ciqual', 'utilisateur', 'recette', 'rapide', 'estimation_ia'],
  { message: 'Source d’entrée inconnue.' },
);

/**
 * Bornes de poids. Volontairement larges : le rôle de ce schéma est
 * d'écarter une faute de frappe ou une valeur en livres saisie comme des
 * kilos, pas de juger une corpulence.
 */
export const poidsKg = z
  .number()
  .min(30, { message: 'Poids attendu entre 30 et 400 kg.' })
  .max(400, { message: 'Poids attendu entre 30 et 400 kg.' });

export const tailleCm = z
  .number()
  .int()
  .min(100, { message: 'Taille attendue entre 100 et 250 cm.' })
  .max(250, { message: 'Taille attendue entre 100 et 250 cm.' });

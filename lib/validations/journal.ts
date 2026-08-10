import { z } from 'zod';
import { dateIso, poidsKg, repas, sourceEntree, uuid } from './commun';

/**
 * Saisie d'une entrée alimentaire.
 *
 * Les valeurs nutritionnelles sont transmises par le client et **figées**
 * telles quelles : elles ne sont pas relues depuis le catalogue au
 * moment de l'écriture. C'est ce qui garantit qu'une correction du
 * catalogue six mois plus tard ne réécrit pas l'historique.
 */
export const schemaEntree = z
  .object({
    // Généré par le client : rejouer l'écriture après une coupure réseau
    // doit produire un upsert, jamais un doublon.
    id: uuid,
    date: dateIso,
    libelle: z.string().trim().min(1, { message: 'Un libellé est nécessaire.' }).max(200),
    repas,
    quantite: z.number().positive({ message: 'La quantité doit être positive.' }),
    unite: z.string().trim().min(1).max(20).default('g'),
    quantiteG: z.number().positive().nullish(),
    kcal: z
      .number()
      .min(0, { message: 'Les calories ne peuvent pas être négatives.' })
      .max(20000, { message: 'Valeur trop élevée : vérifiez la quantité.' }),
    proteinesG: z.number().min(0).max(2000).nullish(),
    glucidesG: z.number().min(0).max(2000).nullish(),
    lipidesG: z.number().min(0).max(2000).nullish(),
    source: sourceEntree.default('rapide'),
    alimentId: uuid.nullish(),
    alimentUtilisateurId: uuid.nullish(),
    recetteId: uuid.nullish(),
  })
  .superRefine((valeurs, ctx) => {
    // Une entrée rattachée à plusieurs référentiels à la fois est
    // ambiguë : on ne saurait pas quoi rejouer ni quoi corriger.
    const references = [
      valeurs.alimentId,
      valeurs.alimentUtilisateurId,
      valeurs.recetteId,
    ].filter((r) => r !== null && r !== undefined);

    if (references.length > 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['alimentId'],
        message: 'Une entrée ne peut référencer qu’une seule source à la fois.',
      });
    }
  });

export type SaisieEntree = z.infer<typeof schemaEntree>;

/** Suppression logique d'une entrée : jamais un `delete`. */
export const schemaSuppressionEntree = z.object({
  id: uuid,
});

/**
 * Saisie d'une pesée.
 *
 * `confirmee` permet à l'utilisateur de valider une valeur que le moteur
 * a marquée aberrante. On ne lui demande pas de corriger : c'est
 * peut-être une vraie valeur.
 */
export const schemaPesee = z.object({
  id: uuid,
  date: dateIso,
  poidsKg,
  confirmee: z.boolean().default(false),
  source: z.enum(['manuelle', 'import']).default('manuelle'),
});

export type SaisiePesee = z.infer<typeof schemaPesee>;

export const schemaMesure = z.object({
  id: uuid,
  date: dateIso,
  type: z.string().trim().min(1).max(40),
  valeurCm: z.number().positive().max(400),
});

/** Activité déclarée : enregistrée et affichée, mais hors calcul du déficit. */
export const schemaActiviteJournee = z.object({
  date: dateIso,
  activiteKcal: z.number().min(0).max(10000),
});

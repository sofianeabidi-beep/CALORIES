import { z } from 'zod';
import {
  differenceJours,
  verifierAllure,
  verifierObjectifKcal,
  verifierPoidsCible,
  type Sexe,
} from '@/lib/calcul';
import { dateIso, poidsKg, tailleCm } from './commun';

/**
 * Programme de régime.
 *
 * Deuxième des trois couches de garde-fous (spec §9). Elle s'appuie sur
 * les **mêmes fonctions** que le moteur et que les triggers SQL : trois
 * couches, une seule définition des bornes. Une règle réécrite ici
 * finirait par diverger de la base, et le produit afficherait une chose
 * en refusant l'autre.
 *
 * **La taille se saisit ici, pas à l'inscription.** `libelle` sert de
 * pseudo dans l'interface — c'est un nom d'affichage facultatif, pas un
 * identifiant technique.
 */

export const schemaProgrammeBase = z.object({
  libelle: z.string().trim().max(120).optional(),
  type: z.enum(['deficit', 'surplus', 'maintien'], {
    message: 'Type de programme inconnu.',
  }),
  dateDebut: dateIso,
  dateFin: dateIso.nullish(),
  tailleCm,
  poidsDepartKg: poidsKg,
  poidsCibleKg: poidsKg.nullish(),
  allureCibleKgSemaine: z.number().nullish(),
  objectifKcal: z.number().int().positive().nullish(),
});

export interface ContexteGardefous {
  readonly sexe: Sexe;
}

/**
 * Schéma complet, dépendant du profil : le plancher calorique varie
 * selon le sexe. La taille, elle, fait désormais partie de la saisie
 * elle-même — inutile de la faire transiter par le contexte.
 */
export function schemaProgramme(contexte: ContexteGardefous) {
  return schemaProgrammeBase.superRefine((valeurs, ctx) => {
    if (
      valeurs.dateFin !== null &&
      valeurs.dateFin !== undefined &&
      differenceJours(valeurs.dateDebut, valeurs.dateFin) < 0
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['dateFin'],
        message: 'La date de fin ne peut pas précéder la date de début.',
      });
    }

    if (valeurs.objectifKcal !== null && valeurs.objectifKcal !== undefined) {
      const controle = verifierObjectifKcal({
        sexe: contexte.sexe,
        objectifKcal: valeurs.objectifKcal,
      });

      if (!controle.conforme) {
        ctx.addIssue({
          code: 'custom',
          path: ['objectifKcal'],
          // Ton mesuré, jamais moralisateur. Libellé provisoire : à faire
          // relire par un professionnel de santé avant production.
          message: `L’objectif ne descend pas sous ${controle.plancherKcal} kcal par jour. Si vous visez plus bas, parlez-en à un professionnel de santé.`,
        });
      }
    }

    if (valeurs.poidsCibleKg !== null && valeurs.poidsCibleKg !== undefined) {
      const controle = verifierPoidsCible({
        poidsCibleKg: valeurs.poidsCibleKg,
        tailleCm: valeurs.tailleCm,
      });

      if (!controle.conforme) {
        ctx.addIssue({
          code: 'custom',
          path: ['poidsCibleKg'],
          message: `Pour votre taille, le poids cible le plus bas accepté est de ${controle.poidsMinimumKg.toFixed(1)} kg.`,
        });
      }
    }

    if (
      valeurs.allureCibleKgSemaine !== null &&
      valeurs.allureCibleKgSemaine !== undefined
    ) {
      const controle = verifierAllure({
        allureKgSemaine: valeurs.allureCibleKgSemaine,
        poidsActuelKg: valeurs.poidsDepartKg,
      });

      if (!controle.conforme) {
        ctx.addIssue({
          code: 'custom',
          path: ['allureCibleKgSemaine'],
          message: `L’allure maximale est de ${controle.allureMaxKgSemaine.toFixed(2)} kg par semaine pour votre poids.`,
        });
      }
    }
  });
}

export type SaisieProgramme = z.infer<typeof schemaProgrammeBase>;

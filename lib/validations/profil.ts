import { z } from 'zod';
import { AGE_MINIMUM, verifierAge } from '@/lib/calcul';
import {
  dateIso,
  modeJoursManquants,
  niveauActivite,
  sexe,
  tailleCm,
} from './commun';

/**
 * Profil utilisateur.
 *
 * Le contrôle des 18 ans dépend de la date du jour : elle est passée en
 * paramètre plutôt que lue par le schéma, pour la même raison que dans
 * le moteur — un schéma qui lit l'horloge n'est pas testable.
 */
export const schemaProfilBase = z.object({
  sexe,
  dateNaissance: dateIso,
  tailleCm,
  niveauActivite,
  modeJoursManquants: modeJoursManquants.default('neutre'),
  unitePoids: z.enum(['kg', 'lb']).default('kg'),
  modeDiscret: z.boolean().default(false),
});

export function schemaProfil(dateReference: string) {
  return schemaProfilBase.superRefine((valeurs, ctx) => {
    const controle = verifierAge({
      dateNaissance: valeurs.dateNaissance,
      dateReference,
    });

    if (!controle.conforme) {
      ctx.addIssue({
        code: 'custom',
        path: ['dateNaissance'],
        message: `L’application est réservée aux ${AGE_MINIMUM} ans et plus.`,
      });
    }
  });
}

export type SaisieProfil = z.infer<typeof schemaProfilBase>;

/**
 * Consentements recueillis à l'inscription.
 *
 * Le consentement au traitement de données de santé est **distinct** de
 * l'acceptation des CGU : les fondre en une seule case invaliderait le
 * consentement au sens de l'article 9 du RGPD.
 */
export const schemaConsentements = z.object({
  cguAcceptees: z.literal(true, {
    message: 'L’acceptation des conditions générales est nécessaire.',
  }),
  consentementSante: z.literal(true, {
    message:
      'Le suivi du poids et de l’alimentation relève des données de santé : votre consentement explicite est nécessaire.',
  }),
});

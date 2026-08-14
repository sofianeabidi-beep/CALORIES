import { z } from 'zod';

/**
 * Partie pure de l'analyse de période : schéma, définition de l'outil
 * envoyé à l'API, extraction et validation de la réponse.
 *
 * Même séparation que `analyse.ts` / `estimation.ts` et
 * `analyse-recommandation.ts` / `recommandation.ts`, pour la même
 * raison : rester testable sans clé ni réseau.
 */

export const MODELE_ANALYSE_PERIODE = 'claude-sonnet-5';

export const NOM_OUTIL_ANALYSE_PERIODE = 'analyser_periode';

export const SCHEMA_OUTIL_ANALYSE_PERIODE = {
  name: NOM_OUTIL_ANALYSE_PERIODE,
  description: "Enregistre une analyse en langage naturel d'une période de suivi.",
  input_schema: {
    type: 'object' as const,
    properties: {
      resume: {
        type: 'string',
        description: 'Une ou deux phrases résumant la période, factuelles et neutres.',
      },
      constats: {
        type: 'array',
        description: 'Deux à quatre observations factuelles tirées des chiffres fournis.',
        items: { type: 'string' },
      },
      axesAmelioration: {
        type: 'array',
        description:
          'Deux à quatre pistes concrètes, présentées comme des options à considérer, jamais des ordres.',
        items: { type: 'string' },
      },
    },
    required: ['resume', 'constats', 'axesAmelioration'],
  },
};

export const INSTRUCTIONS_ANALYSE_PERIODE = `Tu analyses une période de suivi de poids et d'alimentation pour un utilisateur, à
partir d'un résumé chiffré déjà calculé — jamais de données brutes. Réponds uniquement en
appelant l'outil fourni.

Reste factuel et neutre, jamais culpabilisant : décris ce que montrent les chiffres, ne
juge pas la personne. Si le taux de jours renseignés est faible, dis-le explicitement et
qualifie ton analyse en conséquence plutôt que de parler avec assurance de données
incomplètes. Les axes d'amélioration sont des options à considérer, jamais des ordres — tu
n'es pas un professionnel de santé : pas de conseil médical, pas de nouvelle recommandation
calorique ou nutritionnelle chiffrée au-delà de ce que les données fournies montrent déjà.`;

const schemaAnalysePeriode = z.object({
  resume: z.string().trim().min(1).max(500),
  constats: z.array(z.string().trim().min(1).max(300)).min(1).max(6),
  axesAmelioration: z.array(z.string().trim().min(1).max(300)).min(1).max(6),
});

export type AnalysePeriode = z.infer<typeof schemaAnalysePeriode>;

export type ResultatAnalysePeriode =
  | { succes: true; donnees: AnalysePeriode }
  | { succes: false; erreur: string };

interface BlocContenu {
  readonly type: string;
  readonly name?: string;
  readonly input?: unknown;
}

interface ReponseMessages {
  readonly content?: readonly BlocContenu[];
  readonly error?: { readonly message?: string };
}

/**
 * Extrait et valide l'analyse depuis la réponse brute de l'API Messages.
 * Copie conforme d'`analyserReponseRecommandation` : mêmes cas traités,
 * même refus des valeurs hors bornes plutôt que de les propager à
 * l'écran.
 */
export function analyserReponsePeriode(reponse: unknown): ResultatAnalysePeriode {
  const corps = reponse as ReponseMessages;

  if (corps.error?.message !== undefined) {
    return { succes: false, erreur: corps.error.message };
  }

  const blocOutil = (corps.content ?? []).find(
    (bloc): bloc is BlocContenu & { input: unknown } =>
      bloc.type === 'tool_use' && bloc.name === NOM_OUTIL_ANALYSE_PERIODE,
  );

  if (blocOutil === undefined) {
    return {
      succes: false,
      erreur: 'Réponse inattendue du service d’analyse : aucune valeur exploitable.',
    };
  }

  const analyse = schemaAnalysePeriode.safeParse(blocOutil.input);
  if (!analyse.success) {
    return {
      succes: false,
      erreur: 'Réponse inattendue du service d’analyse : valeurs hors bornes.',
    };
  }

  return { succes: true, donnees: analyse.data };
}

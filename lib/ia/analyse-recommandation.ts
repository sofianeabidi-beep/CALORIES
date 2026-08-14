import { z } from 'zod';

/**
 * Partie pure de la suggestion de repas : schéma, définition de l'outil
 * envoyé à l'API, extraction et validation de la réponse.
 *
 * Même séparation que `analyse.ts` / `estimation.ts`, pour la même
 * raison : rester testable sans clé ni réseau, `recommandation.ts`
 * important `server-only`.
 */

export const MODELE_RECOMMANDATION = 'claude-sonnet-5';

export const NOM_OUTIL_RECOMMANDATION = 'proposer_repas';

export const SCHEMA_OUTIL_RECOMMANDATION = {
  name: NOM_OUTIL_RECOMMANDATION,
  description:
    'Enregistre une liste de suggestions de repas adaptées au restant calorique du jour.',
  input_schema: {
    type: 'object' as const,
    properties: {
      suggestions: {
        type: 'array',
        description: 'Deux à quatre idées de repas, variées et réalistes.',
        items: {
          type: 'object',
          properties: {
            libelle: {
              type: 'string',
              description: 'Nom clair et concis du plat suggéré, en français.',
            },
            kcalEstime: {
              type: 'number',
              description: 'Calories totales estimées pour la portion suggérée.',
            },
            raison: {
              type: 'string',
              description:
                'Une phrase courte reliant explicitement la suggestion à ce que l’utilisateur a déjà mangé aujourd’hui (ex. « peu de protéines jusqu’ici, celui-ci en apporte », « pour varier après le riz de midi »), pas juste une remarque générique sur les calories.',
            },
          },
          required: ['libelle', 'kcalEstime', 'raison'],
        },
      },
    },
    required: ['suggestions'],
  },
};

export const INSTRUCTIONS_RECOMMANDATION = `Tu suggères des idées de repas à un utilisateur qui suit son alimentation en
français. Réponds uniquement en appelant l'outil fourni, avec 2 à 4 suggestions.

Reste dans le restant calorique donné — ne propose rien qui le dépasse largement, sauf à
le dire explicitement dans la raison. Chaque raison doit s'appuyer sur ce que l'utilisateur a
déjà mangé aujourd'hui (équilibre entre protéines/glucides/lipides, variété par rapport aux
repas précédents) — jamais une remarque générique qui ignorerait cette information si elle
est fournie. Adapte aussi les suggestions au repas visé (petit-déjeuner, déjeuner, dîner ou
collation) et à la contrainte de temps donnée : rapide veut dire peu d'ingrédients et peu
d'étapes, élaboré autorise des préparations plus longues. Ton neutre, factuel : ce sont des
idées, pas des prescriptions ni des jugements sur ce qui a déjà été mangé.`;

const schemaRecommandation = z.object({
  suggestions: z
    .array(
      z.object({
        libelle: z.string().trim().min(1).max(200),
        kcalEstime: z.number().min(0).max(20000),
        raison: z.string().trim().min(1).max(300),
      }),
    )
    .min(1)
    .max(5),
});

export type Recommandation = z.infer<typeof schemaRecommandation>;

export type ResultatRecommandation =
  | { succes: true; donnees: Recommandation }
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
 * Extrait et valide la recommandation depuis la réponse brute de l'API
 * Messages. Copie conforme d'`analyserReponseEstimation` : mêmes cas
 * traités, même refus des valeurs hors bornes plutôt que de les
 * propager à l'écran.
 */
export function analyserReponseRecommandation(reponse: unknown): ResultatRecommandation {
  const corps = reponse as ReponseMessages;

  if (corps.error?.message !== undefined) {
    return { succes: false, erreur: corps.error.message };
  }

  const blocOutil = (corps.content ?? []).find(
    (bloc): bloc is BlocContenu & { input: unknown } =>
      bloc.type === 'tool_use' && bloc.name === NOM_OUTIL_RECOMMANDATION,
  );

  if (blocOutil === undefined) {
    return {
      succes: false,
      erreur: 'Réponse inattendue du service de suggestion : aucune valeur exploitable.',
    };
  }

  const analyse = schemaRecommandation.safeParse(blocOutil.input);
  if (!analyse.success) {
    return {
      succes: false,
      erreur: 'Réponse inattendue du service de suggestion : valeurs hors bornes.',
    };
  }

  return { succes: true, donnees: analyse.data };
}

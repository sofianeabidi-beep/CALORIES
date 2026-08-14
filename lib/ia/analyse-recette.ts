import { z } from 'zod';

/**
 * Partie pure de la recette détaillée : schéma, définition de l'outil
 * envoyé à l'API, extraction et validation de la réponse.
 *
 * Même séparation que `analyse-recommandation.ts` / `recommandation.ts`,
 * pour la même raison : rester testable sans clé ni réseau,
 * `recette.ts` important `server-only`.
 */

export const MODELE_RECETTE = 'claude-sonnet-5';

export const NOM_OUTIL_RECETTE = 'proposer_recette';

export const SCHEMA_OUTIL_RECETTE = {
  name: NOM_OUTIL_RECETTE,
  description: 'Enregistre la recette détaillée d’un plat déjà suggéré.',
  input_schema: {
    type: 'object' as const,
    properties: {
      portions: {
        type: 'number',
        description: 'Nombre de portions couvertes par les quantités données.',
      },
      ingredients: {
        type: 'array',
        description: 'Liste des ingrédients avec leur quantité, réaliste pour la portion.',
        items: {
          type: 'object',
          properties: {
            item: { type: 'string', description: 'Nom de l’ingrédient.' },
            quantite: {
              type: 'string',
              description: 'Quantité en unité courante, ex. « 150 g », « 1 cuillère à soupe ».',
            },
          },
          required: ['item', 'quantite'],
        },
      },
      etapes: {
        type: 'array',
        description: 'Étapes de préparation dans l’ordre, une phrase courte et actionnable chacune.',
        items: { type: 'string' },
      },
    },
    required: ['ingredients', 'etapes'],
  },
};

export const INSTRUCTIONS_RECETTE = `Tu donnes la recette détaillée d'un plat déjà suggéré à un
utilisateur qui suit son alimentation en français. Réponds uniquement en appelant l'outil fourni.

Reste cohérent avec le nom du plat et les calories déjà annoncées — ne change pas le plat, détaille-le.
Adapte la recette à la contrainte de temps donnée : rapide veut dire peu d'ingrédients et peu d'étapes,
élaboré autorise une préparation plus longue et plus d'ingrédients. Étapes courtes et actionnables,
quantités réalistes pour une portion. Ton neutre, factuel : une recette, pas un jugement sur ce qui a
déjà été mangé.`;

const schemaRecette = z.object({
  portions: z.number().min(1).max(20).optional(),
  ingredients: z
    .array(
      z.object({
        item: z.string().trim().min(1).max(200),
        quantite: z.string().trim().min(1).max(100),
      }),
    )
    .min(1)
    .max(30),
  etapes: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
});

export type Recette = z.infer<typeof schemaRecette>;

export type ResultatRecette =
  | { succes: true; donnees: Recette }
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
 * Extrait et valide la recette depuis la réponse brute de l'API
 * Messages. Copie conforme d'`analyserReponseRecommandation` : mêmes cas
 * traités, même refus des valeurs hors bornes plutôt que de les
 * propager à l'écran.
 */
export function analyserReponseRecette(reponse: unknown): ResultatRecette {
  const corps = reponse as ReponseMessages;

  if (corps.error?.message !== undefined) {
    return { succes: false, erreur: corps.error.message };
  }

  const blocOutil = (corps.content ?? []).find(
    (bloc): bloc is BlocContenu & { input: unknown } =>
      bloc.type === 'tool_use' && bloc.name === NOM_OUTIL_RECETTE,
  );

  if (blocOutil === undefined) {
    return {
      succes: false,
      erreur: 'Réponse inattendue du service de recette : aucune valeur exploitable.',
    };
  }

  const analyse = schemaRecette.safeParse(blocOutil.input);
  if (!analyse.success) {
    return {
      succes: false,
      erreur: 'Réponse inattendue du service de recette : valeurs hors bornes.',
    };
  }

  return { succes: true, donnees: analyse.data };
}

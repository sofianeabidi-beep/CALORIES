import { z } from 'zod';

/**
 * Partie pure de l'estimation nutritionnelle : schéma, définition de
 * l'outil envoyé à l'API, extraction et validation de la réponse.
 *
 * Séparée de `estimation.ts` pour rester testable sans clé ni réseau —
 * `estimation.ts` importe `server-only`, qui interrompt tout import,
 * même transitif, hors d'un contexte serveur Next.js. Même principe de
 * séparation qu'entre `lib/calcul/` et `lib/supabase/`.
 */

export const MODELE_ESTIMATION = 'claude-sonnet-5';

export const NOM_OUTIL_ESTIMATION = 'enregistrer_estimation';

export const SCHEMA_OUTIL_ESTIMATION = {
  name: NOM_OUTIL_ESTIMATION,
  description:
    "Enregistre l'estimation nutritionnelle d'un ou plusieurs aliments décrits en langage libre.",
  input_schema: {
    type: 'object' as const,
    properties: {
      aliments: {
        type: 'array',
        description:
          "Un élément par aliment ou plat distinct. Un plat composé (« pâtes à la bolognaise », « un sandwich jambon-beurre ») reste un seul élément — ne jamais le décomposer en ingrédients. Mais plusieurs aliments distincts mangés côte à côte sans former un plat unique (« des sardines et des crevettes », « une pomme et un yaourt ») donnent un élément par aliment, chacun avec ses propres valeurs, jamais additionnées ensemble.",
        items: {
          type: 'object',
          properties: {
            libelle: {
              type: 'string',
              description: 'Nom clair et concis de cet aliment ou plat précis, en français.',
            },
            quantiteG: {
              type: 'number',
              description: 'Quantité estimée en grammes pour cet aliment.',
            },
            kcal: {
              type: 'number',
              description: 'Calories totales pour cet aliment et cette quantité, pas pour 100 g.',
            },
            proteinesG: {
              type: 'number',
              description: 'Protéines en grammes, pour cet aliment.',
            },
            glucidesG: {
              type: 'number',
              description: 'Glucides en grammes, pour cet aliment.',
            },
            lipidesG: {
              type: 'number',
              description: 'Lipides en grammes, pour cet aliment.',
            },
          },
          required: ['libelle', 'quantiteG', 'kcal', 'proteinesG', 'glucidesG', 'lipidesG'],
        },
      },
    },
    required: ['aliments'],
  },
};

export const INSTRUCTIONS_ESTIMATION = `Tu estimes les valeurs nutritionnelles de ce qu'un utilisateur décrit avoir mangé, en
français. Réponds uniquement en appelant l'outil fourni.

Distingue deux cas :
- Un plat composé, préparé comme un tout (« pâtes à la bolognaise », « un sandwich
  jambon-beurre », « une pizza margherita ») : un seul élément dans "aliments", avec le
  total pour le plat entier. Ne décompose jamais un plat en ses ingrédients.
- Plusieurs aliments distincts mentionnés ensemble mais mangés séparément (« des sardines
  et des crevettes », « une pomme et un yaourt ») : un élément par aliment, chacun avec ses
  propres valeurs. Ne les additionne jamais en un seul total — leurs profils nutritionnels
  sont différents et l'utilisateur doit pouvoir corriger chacun indépendamment.

Sois réaliste plutôt que prudent : donne la meilleure estimation pour la portion décrite,
pas une fourchette basse. Si une quantité n'est pas précisée, retiens une portion usuelle en
France pour ce plat. Les nombres portent sur la quantité entière décrite, jamais sur 100 g.`;

const schemaAliment = z.object({
  libelle: z.string().trim().min(1).max(200),
  quantiteG: z.number().positive().max(5000),
  kcal: z.number().min(0).max(20000),
  proteinesG: z.number().min(0).max(2000),
  glucidesG: z.number().min(0).max(2000),
  lipidesG: z.number().min(0).max(2000),
});

const schemaEstimation = z.object({
  aliments: z.array(schemaAliment).min(1).max(10),
});

export type EstimationAliment = z.infer<typeof schemaAliment>;

export type ResultatEstimation =
  | { succes: true; donnees: readonly EstimationAliment[] }
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
 * Extrait et valide l'estimation depuis la réponse brute de l'API
 * Messages. C'est ici que se jouent les cas qui comptent — outil
 * absent, valeurs hors bornes, JSON inattendu — jamais une valeur
 * invraisemblable ne doit atteindre le formulaire sans passer par ce
 * contrôle.
 */
export function analyserReponseEstimation(reponse: unknown): ResultatEstimation {
  const corps = reponse as ReponseMessages;

  if (corps.error?.message !== undefined) {
    return { succes: false, erreur: corps.error.message };
  }

  const blocOutil = (corps.content ?? []).find(
    (bloc): bloc is BlocContenu & { input: unknown } =>
      bloc.type === 'tool_use' && bloc.name === NOM_OUTIL_ESTIMATION,
  );

  if (blocOutil === undefined) {
    return {
      succes: false,
      erreur: 'Réponse inattendue du service d’estimation : aucune valeur exploitable.',
    };
  }

  const analyse = schemaEstimation.safeParse(blocOutil.input);
  if (!analyse.success) {
    return {
      succes: false,
      erreur: 'Réponse inattendue du service d’estimation : valeurs hors bornes.',
    };
  }

  return { succes: true, donnees: analyse.data.aliments };
}

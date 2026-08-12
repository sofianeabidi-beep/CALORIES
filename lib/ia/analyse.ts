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
    "Enregistre l'estimation nutritionnelle d'un aliment ou d'un plat décrit en langage libre.",
  input_schema: {
    type: 'object' as const,
    properties: {
      libelle: {
        type: 'string',
        description: 'Nom clair et concis du plat ou de l’aliment, en français.',
      },
      quantiteG: {
        type: 'number',
        description: 'Quantité estimée en grammes pour la portion décrite.',
      },
      kcal: {
        type: 'number',
        description: 'Calories totales estimées pour cette quantité précise, pas pour 100 g.',
      },
      proteinesG: { type: 'number', description: 'Protéines en grammes, pour cette quantité.' },
      glucidesG: { type: 'number', description: 'Glucides en grammes, pour cette quantité.' },
      lipidesG: { type: 'number', description: 'Lipides en grammes, pour cette quantité.' },
    },
    required: ['libelle', 'quantiteG', 'kcal', 'proteinesG', 'glucidesG', 'lipidesG'],
  },
};

export const INSTRUCTIONS_ESTIMATION = `Tu estimes les valeurs nutritionnelles d'un repas décrit en français par
un utilisateur qui suit son alimentation. Réponds uniquement en appelant l'outil fourni.

Sois réaliste plutôt que prudent : donne la meilleure estimation pour la portion décrite,
pas une fourchette basse. Si la quantité n'est pas précisée, retiens une portion usuelle en
France pour ce plat. Les nombres portent sur la quantité entière décrite, jamais sur 100 g.`;

const schemaEstimation = z.object({
  libelle: z.string().trim().min(1).max(200),
  quantiteG: z.number().positive().max(5000),
  kcal: z.number().min(0).max(20000),
  proteinesG: z.number().min(0).max(2000),
  glucidesG: z.number().min(0).max(2000),
  lipidesG: z.number().min(0).max(2000),
});

export type EstimationAliment = z.infer<typeof schemaEstimation>;

export type ResultatEstimation =
  | { succes: true; donnees: EstimationAliment }
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

  return { succes: true, donnees: analyse.data };
}

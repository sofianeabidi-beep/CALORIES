import { z } from 'zod';

/**
 * Partie pure de la planification hebdomadaire : schéma, définition de
 * l'outil envoyé à l'API, extraction et validation de la réponse.
 *
 * Même séparation que `analyse-recette.ts` / `recette.ts`, pour la même
 * raison : rester testable sans clé ni réseau, `planification.ts`
 * important `server-only`.
 */

export const MODELE_PLANIFICATION = 'claude-sonnet-5';

export const NOM_OUTIL_PLANIFICATION = 'planifier_semaine';

export const SCHEMA_OUTIL_PLANIFICATION = {
  name: NOM_OUTIL_PLANIFICATION,
  description:
    'Enregistre un plan de repas pour la semaine (lundi à dimanche) et la liste de courses correspondante.',
  input_schema: {
    type: 'object' as const,
    properties: {
      jours: {
        type: 'array',
        description: 'Les 7 jours de la semaine, dans l’ordre, du lundi au dimanche.',
        items: {
          type: 'object',
          properties: {
            jour: { type: 'string', description: 'Nom du jour en français, ex. « Lundi ».' },
            repas: {
              type: 'array',
              description: 'Les repas du jour, dans l’ordre chronologique.',
              items: {
                type: 'object',
                properties: {
                  repas: {
                    type: 'string',
                    enum: ['petit_dejeuner', 'dejeuner', 'diner', 'collation'],
                  },
                  libelle: { type: 'string', description: 'Nom clair et concis du plat.' },
                  kcalEstime: { type: 'number', description: 'Calories estimées de ce repas.' },
                },
                required: ['repas', 'libelle', 'kcalEstime'],
              },
            },
          },
          required: ['jour', 'repas'],
        },
      },
      listeCourses: {
        type: 'array',
        description:
          'Liste de courses consolidée pour toute la semaine, quantités regroupées par ingrédient — pas une liste par jour.',
        items: {
          type: 'object',
          properties: {
            categorie: {
              type: 'string',
              description: 'Rayon ou famille, ex. « Fruits et légumes », « Épicerie ».',
            },
            item: { type: 'string', description: 'Nom de l’article.' },
            quantite: {
              type: 'string',
              description: 'Quantité totale pour la semaine, ex. « 800 g », « 6 unités ».',
            },
          },
          required: ['categorie', 'item', 'quantite'],
        },
      },
    },
    required: ['jours', 'listeCourses'],
  },
};

export const INSTRUCTIONS_PLANIFICATION = `Tu planifies une semaine de repas pour un utilisateur qui suit son
alimentation en français. Réponds uniquement en appelant l'outil fourni, pour les 7 jours de la
semaine (lundi à dimanche), avec le nombre de repas par jour demandé.

Vise l'objectif calorique quotidien donné pour la somme des repas de chaque jour (à 10 % près),
sans jamais le présenter comme une contrainte stricte au gramme près. Varie les plats sur la
semaine — ne répète pas un même plat plus de deux fois. Adapte les recettes à la contrainte de
temps donnée : rapide veut dire peu d'ingrédients et peu d'étapes, élaboré autorise des
préparations plus longues.

La liste de courses doit être **consolidée pour toute la semaine** : regroupe les quantités d'un
même ingrédient utilisé dans plusieurs repas plutôt que de le répéter, et organise-la par rayon
(fruits et légumes, féculents, protéines, produits laitiers, épicerie, etc.). Ton neutre,
factuel : c'est une proposition à ajuster, pas une prescription.`;

const schemaRepasPlanifie = z.object({
  repas: z.enum(['petit_dejeuner', 'dejeuner', 'diner', 'collation']),
  libelle: z.string().trim().min(1).max(200),
  kcalEstime: z.number().min(0).max(20000),
});

const schemaJourPlanifie = z.object({
  jour: z.string().trim().min(1).max(20),
  repas: z.array(schemaRepasPlanifie).min(1).max(6),
});

const schemaArticleCourse = z.object({
  categorie: z.string().trim().min(1).max(60),
  item: z.string().trim().min(1).max(120),
  quantite: z.string().trim().min(1).max(60),
});

const schemaPlanification = z.object({
  // Une semaine complète, mais souple sur les bornes : un modèle qui
  // renvoie 6 ou 8 entrées ne doit pas faire échouer toute la
  // génération, même philosophie que `analyse-recommandation.ts`.
  jours: z.array(schemaJourPlanifie).min(5).max(8),
  listeCourses: z.array(schemaArticleCourse).min(1).max(60),
});

export type Planification = z.infer<typeof schemaPlanification>;

export type ResultatPlanification =
  | { succes: true; donnees: Planification }
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
 * Extrait et valide la planification depuis la réponse brute de l'API
 * Messages. Copie conforme d'`analyserReponseRecette` : mêmes cas
 * traités, même refus des valeurs hors bornes plutôt que de les
 * propager à l'écran.
 */
export function analyserReponsePlanification(reponse: unknown): ResultatPlanification {
  const corps = reponse as ReponseMessages;

  if (corps.error?.message !== undefined) {
    return { succes: false, erreur: corps.error.message };
  }

  const blocOutil = (corps.content ?? []).find(
    (bloc): bloc is BlocContenu & { input: unknown } =>
      bloc.type === 'tool_use' && bloc.name === NOM_OUTIL_PLANIFICATION,
  );

  if (blocOutil === undefined) {
    return {
      succes: false,
      erreur: 'Réponse inattendue du service de planification : aucune valeur exploitable.',
    };
  }

  const analyse = schemaPlanification.safeParse(blocOutil.input);
  if (!analyse.success) {
    return {
      succes: false,
      erreur: 'Réponse inattendue du service de planification : valeurs hors bornes.',
    };
  }

  return { succes: true, donnees: analyse.data };
}

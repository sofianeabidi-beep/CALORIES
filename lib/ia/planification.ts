import 'server-only';

import { cleAnthropic } from './env';
import {
  analyserReponsePlanification,
  INSTRUCTIONS_PLANIFICATION,
  MODELE_PLANIFICATION,
  NOM_OUTIL_PLANIFICATION,
  SCHEMA_OUTIL_PLANIFICATION,
  type ResultatPlanification,
} from './analyse-planification';

export type { ResultatPlanification } from './analyse-planification';

/**
 * Planification hebdomadaire de repas + liste de courses.
 *
 * Même structure que `suggererRepas`/`obtenirRecette` : un seul appel à
 * l'API Messages, sortie forcée par outil, ne lève jamais d'exception
 * réseau vers l'appelant. `max_tokens` et le délai sont plus généreux
 * qu'ailleurs (7 jours de repas + une liste de courses consolidée,
 * contre une suggestion ou une recette isolée) — voir aussi
 * `export const maxDuration` sur la page qui déclenche cette action,
 * sans quoi la plateforme d'hébergement risquerait de couper l'appel
 * avant sa fin.
 */
export async function genererPlanification(entree: {
  objectifKcalJour: number;
  nbRepasJour: 3 | 4;
  contrainteTemps: 'rapide' | 'elabore';
}): Promise<ResultatPlanification> {
  let cle: string;
  try {
    cle = cleAnthropic();
  } catch (erreur) {
    return { succes: false, erreur: (erreur as Error).message };
  }

  const temps =
    entree.contrainteTemps === 'rapide'
      ? "Je veux des recettes rapides, avec peu d'ingrédients."
      : "J'ai le temps et beaucoup d'ingrédients disponibles.";

  const message = `Planifie ma semaine avec ${entree.nbRepasJour} repas par jour. Mon objectif est d'environ ${Math.round(entree.objectifKcalJour)} kcal par jour. ${temps} Prépare aussi la liste de courses correspondante.`;

  try {
    const reponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': cle,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELE_PLANIFICATION,
        max_tokens: 4096,
        system: INSTRUCTIONS_PLANIFICATION,
        messages: [{ role: 'user', content: message }],
        tools: [SCHEMA_OUTIL_PLANIFICATION],
        tool_choice: { type: 'tool', name: NOM_OUTIL_PLANIFICATION },
      }),
      signal: AbortSignal.timeout(40_000),
    });

    const corps: unknown = await reponse.json();
    return analyserReponsePlanification(corps);
  } catch {
    return {
      succes: false,
      erreur: 'Planification indisponible pour le moment. Réessayez plus tard.',
    };
  }
}

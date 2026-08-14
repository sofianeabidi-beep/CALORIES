import 'server-only';

import { cleAnthropic } from './env';
import {
  analyserReponseRecommandation,
  INSTRUCTIONS_RECOMMANDATION,
  MODELE_RECOMMANDATION,
  NOM_OUTIL_RECOMMANDATION,
  SCHEMA_OUTIL_RECOMMANDATION,
  type ResultatRecommandation,
} from './analyse-recommandation';

export type { ResultatRecommandation } from './analyse-recommandation';

/** Rien d'utile à suggérer en dessous de ce seuil : l'objectif est déjà atteint ou dépassé. */
const KCAL_RESTANT_MINIMUM = 50;

/**
 * Suggestion de repas à partir du restant calorique du jour.
 *
 * Même structure qu'`estimerAliment` : un seul appel à l'API Messages,
 * sortie forcée par outil, ne lève jamais d'exception réseau vers
 * l'appelant — un échec retombe sur un message d'erreur affichable,
 * jamais sur un écran cassé. Délai borné à 15 s.
 */
export async function suggererRepas(entree: {
  kcalRestant: number;
  repasDejaPris: readonly { repas: string; libelle: string; kcal: number }[];
  repasCible: string;
  contrainteTemps: 'rapide' | 'elabore';
}): Promise<ResultatRecommandation> {
  if (entree.kcalRestant < KCAL_RESTANT_MINIMUM) {
    return {
      succes: false,
      erreur: "Plus grand-chose à ajouter aujourd'hui — l'objectif est déjà atteint ou dépassé.",
    };
  }

  let cle: string;
  try {
    cle = cleAnthropic();
  } catch (erreur) {
    return { succes: false, erreur: (erreur as Error).message };
  }

  const resume =
    entree.repasDejaPris.length === 0
      ? "Rien mangé pour l'instant aujourd'hui."
      : entree.repasDejaPris.map((r) => `${r.libelle} (${r.kcal} kcal)`).join(', ');

  const temps =
    entree.contrainteTemps === 'rapide'
      ? "Je veux quelque chose de rapide, avec peu d'ingrédients."
      : "J'ai le temps et beaucoup d'ingrédients disponibles.";

  const message = `Je cherche des idées pour : ${entree.repasCible}. Il me reste environ ${Math.round(entree.kcalRestant)} kcal aujourd'hui. J'ai déjà mangé : ${resume}. ${temps} Propose-moi des idées de repas adaptées.`;

  try {
    const reponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': cle,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELE_RECOMMANDATION,
        max_tokens: 768,
        system: INSTRUCTIONS_RECOMMANDATION,
        messages: [{ role: 'user', content: message }],
        tools: [SCHEMA_OUTIL_RECOMMANDATION],
        tool_choice: { type: 'tool', name: NOM_OUTIL_RECOMMANDATION },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const corps: unknown = await reponse.json();
    return analyserReponseRecommandation(corps);
  } catch {
    return {
      succes: false,
      erreur: 'Suggestion indisponible pour le moment. Réessayez plus tard.',
    };
  }
}

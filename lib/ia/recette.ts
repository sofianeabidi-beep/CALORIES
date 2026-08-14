import 'server-only';

import { cleAnthropic } from './env';
import {
  analyserReponseRecette,
  INSTRUCTIONS_RECETTE,
  MODELE_RECETTE,
  NOM_OUTIL_RECETTE,
  SCHEMA_OUTIL_RECETTE,
  type ResultatRecette,
} from './analyse-recette';

export type { ResultatRecette } from './analyse-recette';

/**
 * Recette détaillée d'un plat déjà suggéré par `suggererRepas`.
 *
 * Appel séparé plutôt que demandé d'un coup avec les suggestions :
 * générer 2 à 4 recettes complètes à chaque suggestion alourdirait la
 * réponse et la latence pour un contenu que l'utilisateur ne consulte
 * pas toujours. Même structure qu'`estimerAliment`/`suggererRepas` : un
 * seul appel à l'API Messages, sortie forcée par outil, ne lève jamais
 * d'exception réseau vers l'appelant. Délai borné à 15 s.
 */
export async function obtenirRecette(entree: {
  libelle: string;
  kcalEstime: number;
  repasCible: string;
  contrainteTemps: 'rapide' | 'elabore';
}): Promise<ResultatRecette> {
  let cle: string;
  try {
    cle = cleAnthropic();
  } catch (erreur) {
    return { succes: false, erreur: (erreur as Error).message };
  }

  const temps =
    entree.contrainteTemps === 'rapide'
      ? "Je veux quelque chose de rapide, avec peu d'ingrédients."
      : "J'ai le temps et beaucoup d'ingrédients disponibles.";

  const message = `Donne-moi la recette de : ${entree.libelle} (environ ${Math.round(entree.kcalEstime)} kcal), pour le repas suivant : ${entree.repasCible}. ${temps}`;

  try {
    const reponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': cle,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELE_RECETTE,
        max_tokens: 1024,
        system: INSTRUCTIONS_RECETTE,
        messages: [{ role: 'user', content: message }],
        tools: [SCHEMA_OUTIL_RECETTE],
        tool_choice: { type: 'tool', name: NOM_OUTIL_RECETTE },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const corps: unknown = await reponse.json();
    return analyserReponseRecette(corps);
  } catch {
    return {
      succes: false,
      erreur: 'Recette indisponible pour le moment. Réessayez plus tard.',
    };
  }
}

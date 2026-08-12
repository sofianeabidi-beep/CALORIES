import 'server-only';

import { cleAnthropic } from './env';
import {
  analyserReponseEstimation,
  INSTRUCTIONS_ESTIMATION,
  MODELE_ESTIMATION,
  NOM_OUTIL_ESTIMATION,
  SCHEMA_OUTIL_ESTIMATION,
  type ResultatEstimation,
} from './analyse';

export type { ResultatEstimation } from './analyse';

/**
 * Estimation nutritionnelle à partir d'une description libre.
 *
 * Sert pour les plats qui n'ont ni code-barres ni fiche CIQUAL — un plat
 * maison, un reste, un mélange improvisé. Ce n'est **pas** un substitut
 * à la recherche dans un vrai catalogue (phase 2, spec §7) : quand
 * l'aliment est connu, la base de données donne un chiffre exact, pas
 * une estimation. L'IA n'intervient qu'en dernier recours.
 *
 * Comme pour la dépense énergétique estimée, la valeur retournée doit
 * être présentée comme telle — jamais comme un chiffre sûr. C'est
 * pourquoi `entree.source` porte 'estimation_ia' : l'interface peut le
 * savoir et le dire.
 *
 * Ne lève jamais d'exception réseau vers l'appelant : une estimation
 * ratée doit toujours retomber sur la saisie manuelle, jamais bloquer
 * l'écran (même principe que le repli sur la saisie manuelle si Open
 * Food Facts est indisponible, spec §7). Délai borné à 15 s — mieux vaut
 * un échec net qu'une saisie qui semble figée.
 */
export async function estimerAliment(description: string): Promise<ResultatEstimation> {
  const texte = description.trim();
  if (texte.length < 3) {
    return { succes: false, erreur: 'Décrivez ce que vous avez mangé pour lancer l’estimation.' };
  }

  let cle: string;
  try {
    cle = cleAnthropic();
  } catch (erreur) {
    return { succes: false, erreur: (erreur as Error).message };
  }

  try {
    const reponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': cle,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELE_ESTIMATION,
        max_tokens: 512,
        system: INSTRUCTIONS_ESTIMATION,
        messages: [{ role: 'user', content: texte }],
        tools: [SCHEMA_OUTIL_ESTIMATION],
        tool_choice: { type: 'tool', name: NOM_OUTIL_ESTIMATION },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const corps: unknown = await reponse.json();
    return analyserReponseEstimation(corps);
  } catch {
    return {
      succes: false,
      erreur: 'Estimation indisponible pour le moment. Saisissez les valeurs vous-même.',
    };
  }
}

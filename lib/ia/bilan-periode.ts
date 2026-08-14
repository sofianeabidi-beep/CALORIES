import 'server-only';

import { cleAnthropic } from './env';
import {
  analyserReponsePeriode,
  INSTRUCTIONS_ANALYSE_PERIODE,
  MODELE_ANALYSE_PERIODE,
  NOM_OUTIL_ANALYSE_PERIODE,
  SCHEMA_OUTIL_ANALYSE_PERIODE,
  type ResultatAnalysePeriode,
} from './analyse-bilan-periode';

export type { ResultatAnalysePeriode } from './analyse-bilan-periode';

/**
 * En dessous de ce taux de complétude, une analyse ne dirait rien de
 * fiable — même principe que le reste du produit : pas d'indicateur
 * cumulé sans le taux de complétude qui le rend lisible.
 */
const SEUIL_COMPLETUDE_MIN_ANALYSE = 0.3;

/**
 * Analyse d'une période choisie par l'utilisateur, à partir d'un résumé
 * chiffré déjà calculé côté client (`calculerCompletude`, `cumulerDeficit`,
 * `tendancePoids` — pures, donc utilisables aussi bien dans le
 * navigateur). Même structure que `suggererRepas` : un seul appel à
 * l'API Messages, sortie forcée par outil, ne lève jamais d'exception
 * réseau vers l'appelant. Délai borné à 15 s.
 */
export async function analyserPeriode(entree: {
  dateDebut: string;
  dateFin: string;
  completudeTaux: number;
  joursRenseignes: number;
  joursTotal: number;
  deficitCumuleKcal: number;
  kgTheoriques: number;
  tendanceKgSemaine: number | null;
  poidsDebutKg: number | null;
  poidsFinKg: number | null;
}): Promise<ResultatAnalysePeriode> {
  if (entree.completudeTaux < SEUIL_COMPLETUDE_MIN_ANALYSE) {
    return {
      succes: false,
      erreur: 'Trop peu de jours renseignés sur cette période pour une analyse fiable.',
    };
  }

  let cle: string;
  try {
    cle = cleAnthropic();
  } catch (erreur) {
    return { succes: false, erreur: (erreur as Error).message };
  }

  const poids =
    entree.poidsDebutKg !== null && entree.poidsFinKg !== null
      ? `Poids : de ${entree.poidsDebutKg} kg à ${entree.poidsFinKg} kg.`
      : 'Poids : pas assez de pesées sur cette période pour une tendance.';

  const rythme =
    entree.tendanceKgSemaine !== null
      ? `Rythme moyen : ${entree.tendanceKgSemaine.toFixed(2)} kg/semaine.`
      : 'Rythme : impossible à calculer sur cette période.';

  const message = `Période du ${entree.dateDebut} au ${entree.dateFin}. ${entree.joursRenseignes} jours renseignés sur ${entree.joursTotal} (${Math.round(entree.completudeTaux * 100)} %). Déficit cumulé sur les jours renseignés : ${Math.round(entree.deficitCumuleKcal)} kcal, soit environ ${entree.kgTheoriques.toFixed(2)} kg théoriques. ${poids} ${rythme} Analyse cette période.`;

  try {
    const reponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': cle,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELE_ANALYSE_PERIODE,
        max_tokens: 1024,
        system: INSTRUCTIONS_ANALYSE_PERIODE,
        messages: [{ role: 'user', content: message }],
        tools: [SCHEMA_OUTIL_ANALYSE_PERIODE],
        tool_choice: { type: 'tool', name: NOM_OUTIL_ANALYSE_PERIODE },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const corps: unknown = await reponse.json();
    return analyserReponsePeriode(corps);
  } catch {
    return {
      succes: false,
      erreur: 'Analyse indisponible pour le moment. Réessayez plus tard.',
    };
  }
}

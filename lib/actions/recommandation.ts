'use server';

import { suggererRepas, type ResultatRecommandation } from '@/lib/ia/recommandation';

interface EntreeSuggestion {
  kcalRestant: number;
  repasDejaPris: readonly { repas: string; libelle: string; kcal: number }[];
  repasCible: string;
  contrainteTemps: 'rapide' | 'elabore';
}

function estEntreeValide(valeur: unknown): valeur is EntreeSuggestion {
  if (typeof valeur !== 'object' || valeur === null) return false;
  const objet = valeur as Record<string, unknown>;
  if (typeof objet.kcalRestant !== 'number') return false;
  if (typeof objet.repasCible !== 'string') return false;
  if (objet.contrainteTemps !== 'rapide' && objet.contrainteTemps !== 'elabore') return false;
  if (!Array.isArray(objet.repasDejaPris)) return false;
  return objet.repasDejaPris.every(
    (r) =>
      typeof r === 'object' &&
      r !== null &&
      typeof (r as Record<string, unknown>).repas === 'string' &&
      typeof (r as Record<string, unknown>).libelle === 'string' &&
      typeof (r as Record<string, unknown>).kcal === 'number',
  );
}

/**
 * Point d'entrée client de la suggestion de repas par IA.
 *
 * Appelée directement depuis l'écran Aujourd'hui, pas via un
 * `<form action>` : elle ne mute rien, elle propose des idées.
 */
export async function suggererRepasAction(entree: unknown): Promise<ResultatRecommandation> {
  if (!estEntreeValide(entree)) {
    return { succes: false, erreur: 'Requête invalide.' };
  }
  return suggererRepas(entree);
}

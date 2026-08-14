'use server';

import { obtenirRecette, type ResultatRecette } from '@/lib/ia/recette';

interface EntreeRecette {
  libelle: string;
  kcalEstime: number;
  repasCible: string;
  contrainteTemps: 'rapide' | 'elabore';
}

function estEntreeValide(valeur: unknown): valeur is EntreeRecette {
  if (typeof valeur !== 'object' || valeur === null) return false;
  const objet = valeur as Record<string, unknown>;
  if (typeof objet.libelle !== 'string' || objet.libelle.trim().length === 0) return false;
  if (typeof objet.kcalEstime !== 'number') return false;
  if (typeof objet.repasCible !== 'string') return false;
  if (objet.contrainteTemps !== 'rapide' && objet.contrainteTemps !== 'elabore') return false;
  return true;
}

/**
 * Point d'entrée client de la recette détaillée par IA.
 *
 * Appelée depuis chaque suggestion de repas, pas via un `<form action>` :
 * elle ne mute rien, elle affiche une recette à la demande.
 */
export async function obtenirRecetteAction(entree: unknown): Promise<ResultatRecette> {
  if (!estEntreeValide(entree)) {
    return { succes: false, erreur: 'Requête invalide.' };
  }
  return obtenirRecette(entree);
}

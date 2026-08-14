'use server';

import { analyserPeriode, type ResultatAnalysePeriode } from '@/lib/ia/bilan-periode';

interface EntreeAnalyse {
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
}

function estNombreOuNull(v: unknown): v is number | null {
  return v === null || typeof v === 'number';
}

function estEntreeValide(valeur: unknown): valeur is EntreeAnalyse {
  if (typeof valeur !== 'object' || valeur === null) return false;
  const o = valeur as Record<string, unknown>;
  return (
    typeof o.dateDebut === 'string' &&
    typeof o.dateFin === 'string' &&
    typeof o.completudeTaux === 'number' &&
    typeof o.joursRenseignes === 'number' &&
    typeof o.joursTotal === 'number' &&
    typeof o.deficitCumuleKcal === 'number' &&
    typeof o.kgTheoriques === 'number' &&
    estNombreOuNull(o.tendanceKgSemaine) &&
    estNombreOuNull(o.poidsDebutKg) &&
    estNombreOuNull(o.poidsFinKg)
  );
}

/**
 * Point d'entrée client de l'analyse de période par IA.
 *
 * Appelée directement depuis l'écran Pesée, pas via un `<form action>` :
 * elle ne mute rien, elle propose une lecture des chiffres déjà calculés
 * côté client.
 */
export async function analyserPeriodeAction(entree: unknown): Promise<ResultatAnalysePeriode> {
  if (!estEntreeValide(entree)) {
    return { succes: false, erreur: 'Requête invalide.' };
  }
  return analyserPeriode(entree);
}

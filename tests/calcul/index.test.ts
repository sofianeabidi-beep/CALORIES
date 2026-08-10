import { describe, expect, it } from 'vitest';
import * as moteur from '@/lib/calcul';

/**
 * La surface publique est un contrat : c'est par elle que passeront les
 * Server Actions, les composants et le recalcul hors ligne. Un export
 * oublié dans `index.ts` ne se voit qu'au moment de s'en servir.
 */
describe('surface publique du moteur', () => {
  it('expose les fonctions dont le reste de l’application dépend', () => {
    const attendues = [
      // dépense
      'metabolismeDeBase',
      'depenseEstimee',
      'depenseReelle',
      'depenseRetenue',
      // déficit
      'deficitJour',
      'estimerApportManquant',
      'resoudreJournees',
      'cumulerDeficit',
      'kcalVersKg',
      'kgVersKcal',
      // poids
      'lisserPesees',
      'tendancePoids',
      'poidsALaDate',
      'calculerImc',
      // complétude
      'calculerCompletude',
      'completudeSurPlage',
      // projection
      'projeterAtteinteObjectif',
      // garde-fous
      'plancherCalorique',
      'verifierObjectifKcal',
      'verifierPoidsCible',
      'verifierAllure',
      'verifierAge',
      'detecterSignaux',
      // bilan
      'calculerBilan',
      'interpreterEcart',
      // dates
      'estDateIso',
      'ajouterJours',
      'differenceJours',
      'nombreJoursInclus',
      'plageDates',
      'estDansPlage',
      'calculerAge',
    ] as const;

    for (const nom of attendues) {
      expect(moteur, `export manquant : ${nom}`).toHaveProperty(nom);
      expect(typeof moteur[nom]).toBe('function');
    }
  });

  it('expose les constantes qui doivent rester affichables à l’utilisateur', () => {
    // Le coefficient et les planchers ne sont pas des détails
    // d'implémentation : l'interface doit pouvoir les citer.
    expect(moteur.KCAL_PAR_KG).toBe(7700);
    expect(moteur.PLANCHER_KCAL).toEqual({ f: 1200, h: 1500 });
    expect(moteur.IMC_MINIMUM).toBe(18.5);
    expect(moteur.AGE_MINIMUM).toBe(18);
    expect(moteur.SEUIL_FIABILITE_DEPENSE_REELLE).toBe(0.6);
  });

  it('ne dépend ni de l’horloge, ni du fuseau, ni de la locale', () => {
    // Garde-fou structurel : le moteur doit tourner à l'identique sur le
    // serveur et dans le navigateur, y compris hors ligne (spec §8).
    const source = moteur.calculerBilan.toString();
    expect(source).not.toContain('Date.now');
    expect(source).not.toContain('toLocale');
  });
});

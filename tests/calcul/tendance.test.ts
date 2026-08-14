import { describe, expect, it } from 'vitest';
import { analyserTendanceRecente } from '@/lib/calcul/tendance';
import type { JourneeCalculee, StatutJournee } from '@/lib/calcul/types';

const AUJOURDHUI = '2026-03-15';

function journee(date: string, statut: StatutJournee, deficitKcal: number | null): JourneeCalculee {
  return {
    date,
    statut,
    apportRetenuKcal: statut === 'manquant' ? null : 2000,
    depenseRetenueKcal: 2500,
    deficitKcal,
  };
}

describe('analyserTendanceRecente', () => {
  it('rend un ton neutre sous le seuil de jours renseignés', () => {
    const journees = [
      journee('2026-03-14', 'renseigne', 200),
      journee('2026-03-13', 'renseigne', 200),
      journee('2026-03-12', 'renseigne', 200),
      journee('2026-03-11', 'manquant', null),
    ];

    const tendance = analyserTendanceRecente(journees, AUJOURDHUI);

    expect(tendance.ton).toBe('neutre');
    expect(tendance.joursRenseignesFenetre).toBe(3);
    expect(tendance.ecartMoyenFenetreKcal).toBeNull();
  });

  it('priorise un écart notable hier sur une bonne moyenne de fenêtre', () => {
    const journees = [
      journee('2026-03-14', 'renseigne', -400), // hier, surplus notable
      journee('2026-03-13', 'renseigne', 200),
      journee('2026-03-12', 'renseigne', 200),
      journee('2026-03-11', 'renseigne', 200),
      journee('2026-03-10', 'renseigne', 200),
      journee('2026-03-09', 'renseigne', 200),
      journee('2026-03-08', 'renseigne', 200),
    ];

    const tendance = analyserTendanceRecente(journees, AUJOURDHUI);

    expect(tendance.ton).toBe('attention');
    expect(tendance.ecartHierKcal).toBe(-400);
    expect(tendance.joursRenseignesFenetre).toBe(7);
    expect(tendance.ecartMoyenFenetreKcal).toBeCloseTo((-400 + 200 * 6) / 7, 10);
  });

  it("ne déclenche pas 'attention' pile au seuil (comparaison stricte)", () => {
    const journees = [
      journee('2026-03-14', 'renseigne', -300), // exactement le seuil, pas en dessous
      journee('2026-03-13', 'renseigne', 200),
      journee('2026-03-12', 'renseigne', 200),
      journee('2026-03-11', 'renseigne', 200),
    ];

    const tendance = analyserTendanceRecente(journees, AUJOURDHUI);

    expect(tendance.ton).toBe('positif');
  });

  it('rend un ton positif quand la moyenne de fenêtre est nulle ou positive', () => {
    const journees = [
      journee('2026-03-14', 'renseigne', -100),
      journee('2026-03-13', 'renseigne', 200),
      journee('2026-03-12', 'renseigne', 200),
      journee('2026-03-11', 'renseigne', 200),
    ];

    const tendance = analyserTendanceRecente(journees, AUJOURDHUI);

    expect(tendance.ton).toBe('positif');
    expect(tendance.ecartMoyenFenetreKcal).toBeCloseTo(125, 10);
  });

  it('rend un ton neutre quand la moyenne de fenêtre est négative sans écart notable hier', () => {
    const journees = [
      journee('2026-03-14', 'renseigne', -50),
      journee('2026-03-13', 'renseigne', -80),
      journee('2026-03-12', 'renseigne', -60),
      journee('2026-03-11', 'renseigne', -70),
    ];

    const tendance = analyserTendanceRecente(journees, AUJOURDHUI);

    expect(tendance.ton).toBe('neutre');
    expect(tendance.ecartMoyenFenetreKcal).toBeLessThan(0);
  });

  it("ne compte pas un jour 'estime' comme l'écart d'hier, même très négatif", () => {
    const journees = [
      journee('2026-03-14', 'estime', -1000),
      journee('2026-03-13', 'renseigne', -80),
      journee('2026-03-12', 'renseigne', -60),
      journee('2026-03-11', 'renseigne', -70),
      journee('2026-03-10', 'renseigne', -90),
    ];

    const tendance = analyserTendanceRecente(journees, AUJOURDHUI);

    expect(tendance.ecartHierKcal).toBeNull();
    expect(tendance.ton).toBe('neutre');
  });

  it('rend ecartHierKcal null quand hier est absent de la série', () => {
    const journees = [
      journee('2026-03-13', 'renseigne', 200),
      journee('2026-03-12', 'renseigne', 200),
      journee('2026-03-11', 'renseigne', 200),
      journee('2026-03-10', 'renseigne', 200),
    ];

    const tendance = analyserTendanceRecente(journees, AUJOURDHUI);

    expect(tendance.ecartHierKcal).toBeNull();
    expect(tendance.ton).toBe('positif');
  });

  it('applique la fenêtre par défaut de 7 jours', () => {
    const journees = [
      journee('2026-03-14', 'renseigne', 100),
      journee('2026-03-13', 'renseigne', 100),
      journee('2026-03-12', 'renseigne', 100),
      journee('2026-03-11', 'renseigne', 100),
    ];

    const tendance = analyserTendanceRecente(journees, AUJOURDHUI);

    expect(tendance.fenetreJours).toBe(7);
  });

  it('respecte une fenêtre personnalisée plus courte', () => {
    const journees = [
      journee('2026-03-14', 'renseigne', 100),
      journee('2026-03-13', 'renseigne', 100),
      journee('2026-03-12', 'renseigne', 100),
      journee('2026-03-11', 'renseigne', 100),
      // Ce jour est hors de la fenêtre de 4 jours, ne doit pas compter.
      journee('2026-03-10', 'renseigne', -10000),
    ];

    const tendance = analyserTendanceRecente(journees, AUJOURDHUI, 4);

    expect(tendance.fenetreJours).toBe(4);
    expect(tendance.joursRenseignesFenetre).toBe(4);
    expect(tendance.ecartMoyenFenetreKcal).toBeCloseTo(100, 10);
  });
});

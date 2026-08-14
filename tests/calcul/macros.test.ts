import { describe, expect, it } from 'vitest';
import { repartirMacrosObjectif } from '@/lib/calcul/macros';

describe('repartirMacrosObjectif', () => {
  it('reprend le repère de protéines tel quel', () => {
    const repartition = repartirMacrosObjectif({ objectifKcal: 2000, objectifProteinesG: 112 });

    expect(repartition.proteinesG).toBe(112);
  });

  it('alloue 30 % de l’objectif calorique aux lipides', () => {
    const repartition = repartirMacrosObjectif({ objectifKcal: 2000, objectifProteinesG: 112 });

    // 2000 * 0.3 / 9 kcal par g
    expect(repartition.lipidesG).toBeCloseTo((2000 * 0.3) / 9, 10);
  });

  it('donne le reste aux glucides', () => {
    const repartition = repartirMacrosObjectif({ objectifKcal: 2000, objectifProteinesG: 112 });

    const kcalProteines = 112 * 4;
    const kcalLipides = 2000 * 0.3;
    const kcalGlucidesAttendu = 2000 - kcalProteines - kcalLipides;

    expect(repartition.glucidesG).toBeCloseTo(kcalGlucidesAttendu / 4, 10);
  });

  it('ramène les glucides à zéro plutôt que négatifs sur un objectif très bas', () => {
    const repartition = repartirMacrosObjectif({ objectifKcal: 1200, objectifProteinesG: 250 });

    expect(repartition.glucidesG).toBe(0);
  });
});

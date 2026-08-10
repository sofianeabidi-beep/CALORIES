import { describe, expect, it } from 'vitest';
import { projeterAtteinteObjectif } from '@/lib/calcul/projection';
import { differenceJours } from '@/lib/calcul/dates';

const BASE = {
  dateReference: '2026-03-01',
  poidsActuelKg: 80,
  poidsCibleKg: 70,
  rythmeKgParSemaine: -0.5,
  joursDonnees: 28,
};

describe('projeterAtteinteObjectif', () => {
  it('projette une fourchette à partir du rythme observé', () => {
    const projection = projeterAtteinteObjectif(BASE);

    expect(projection.affichable).toBe(true);
    expect(projection.raisonMasquee).toBeNull();
    expect(projection.rythmeKgParSemaine).toBe(-0.5);

    // 10 kg à 0,5 kg/semaine = 20 semaines = 140 jours.
    expect(differenceJours(BASE.dateReference, projection.dateMediane as string)).toBe(140);
    // Optimiste : rythme majoré de 20 % → 0,6 kg/sem → 116,67 → 117 j.
    expect(differenceJours(BASE.dateReference, projection.dateOptimiste as string)).toBe(117);
    // Prudente : rythme minoré de 20 % → 0,4 kg/sem → 175 j.
    expect(differenceJours(BASE.dateReference, projection.datePrudente as string)).toBe(175);
  });

  it('ordonne les trois bornes', () => {
    const p = projeterAtteinteObjectif(BASE);
    expect(
      differenceJours(p.dateOptimiste as string, p.dateMediane as string),
    ).toBeGreaterThan(0);
    expect(
      differenceJours(p.dateMediane as string, p.datePrudente as string),
    ).toBeGreaterThan(0);
  });

  it('fonctionne en prise de poids comme en perte', () => {
    const projection = projeterAtteinteObjectif({
      ...BASE,
      poidsActuelKg: 70,
      poidsCibleKg: 75,
      rythmeKgParSemaine: 0.25,
    });

    expect(projection.affichable).toBe(true);
    // 5 kg à 0,25 kg/semaine = 20 semaines = 140 jours.
    expect(differenceJours(BASE.dateReference, projection.dateMediane as string)).toBe(140);
  });

  it('se masque sous 21 jours de données', () => {
    const projection = projeterAtteinteObjectif({ ...BASE, joursDonnees: 20 });

    expect(projection.affichable).toBe(false);
    expect(projection.raisonMasquee).toBe('donnees_insuffisantes');
    expect(projection.dateMediane).toBeNull();
  });

  it('s’affiche à partir de 21 jours exactement', () => {
    expect(projeterAtteinteObjectif({ ...BASE, joursDonnees: 21 }).affichable).toBe(true);
  });

  it('se masque quand le rythme est inconnu', () => {
    const projection = projeterAtteinteObjectif({ ...BASE, rythmeKgParSemaine: null });

    expect(projection.raisonMasquee).toBe('donnees_insuffisantes');
  });

  it('signale un objectif déjà atteint', () => {
    const projection = projeterAtteinteObjectif({ ...BASE, poidsCibleKg: 80 });

    expect(projection.raisonMasquee).toBe('objectif_atteint');
  });

  it('se masque quand le rythme est trop faible pour projeter', () => {
    const projection = projeterAtteinteObjectif({ ...BASE, rythmeKgParSemaine: -0.04 });

    expect(projection.raisonMasquee).toBe('rythme_trop_faible');
  });

  it('se masque quand le rythme va à l’opposé de l’objectif', () => {
    // Objectif à la baisse, poids qui monte : n'afficher aucune date
    // vaut mieux qu'une date fausse.
    const projection = projeterAtteinteObjectif({ ...BASE, rythmeKgParSemaine: 0.5 });

    expect(projection.raisonMasquee).toBe('rythme_oppose_a_objectif');
  });

  it('se masque au-delà de deux ans d’horizon', () => {
    const projection = projeterAtteinteObjectif({
      ...BASE,
      poidsCibleKg: 30,
      rythmeKgParSemaine: -0.2,
    });

    expect(projection.raisonMasquee).toBe('horizon_trop_lointain');
    expect(projection.dateMediane).toBeNull();
  });
});

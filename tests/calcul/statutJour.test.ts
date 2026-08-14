import { describe, expect, it } from 'vitest';
import { evaluerStatutJour, objectifProteinesRepere } from '@/lib/calcul/statutJour';

describe('evaluerStatutJour', () => {
  it('rend depasse quand l’apport dépasse l’objectif', () => {
    const statut = evaluerStatutJour({
      apportKcal: 2100,
      objectifKcal: 2000,
      proteinesG: 100,
      objectifProteinesG: 100,
    });

    expect(statut.statutKcal).toBe('depasse');
  });

  it('rend proche_objectif au seuil de 90 %, pile ou juste au-dessus', () => {
    const statut = evaluerStatutJour({
      apportKcal: 1800,
      objectifKcal: 2000,
      proteinesG: 100,
      objectifProteinesG: 100,
    });

    expect(statut.statutKcal).toBe('proche_objectif');
  });

  it('rend dans_objectif nettement en dessous du seuil', () => {
    const statut = evaluerStatutJour({
      apportKcal: 1000,
      objectifKcal: 2000,
      proteinesG: 100,
      objectifProteinesG: 100,
    });

    expect(statut.statutKcal).toBe('dans_objectif');
  });

  it('rend insuffisant en dessous de 80 % du repère de protéines', () => {
    const statut = evaluerStatutJour({
      apportKcal: 1000,
      objectifKcal: 2000,
      proteinesG: 50,
      objectifProteinesG: 100,
    });

    expect(statut.statutProteines).toBe('insuffisant');
  });

  it('rend suffisant à partir de 80 % du repère de protéines', () => {
    const statut = evaluerStatutJour({
      apportKcal: 1000,
      objectifKcal: 2000,
      proteinesG: 80,
      objectifProteinesG: 100,
    });

    expect(statut.statutProteines).toBe('suffisant');
  });

  it('rend inconnu quand aucun repère de protéines n’est fourni', () => {
    const statut = evaluerStatutJour({
      apportKcal: 1000,
      objectifKcal: 2000,
      proteinesG: 50,
      objectifProteinesG: null,
    });

    expect(statut.statutProteines).toBe('inconnu');
  });
});

describe('objectifProteinesRepere', () => {
  it('applique le ratio par défaut', () => {
    expect(objectifProteinesRepere(70)).toBeCloseTo(112, 10);
  });

  it('accepte un ratio personnalisé', () => {
    expect(objectifProteinesRepere(70, 2)).toBeCloseTo(140, 10);
  });
});

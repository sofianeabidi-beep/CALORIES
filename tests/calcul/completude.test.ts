import { describe, expect, it } from 'vitest';
import { calculerCompletude, completudeSurPlage } from '@/lib/calcul/completude';
import type { JourneeCalculee, StatutJournee } from '@/lib/calcul/types';

function journee(date: string, statut: StatutJournee): JourneeCalculee {
  return {
    date,
    statut,
    apportRetenuKcal: statut === 'manquant' ? null : 2000,
    depenseRetenueKcal: 2500,
    deficitKcal: statut === 'manquant' ? null : 500,
  };
}

describe('calculerCompletude', () => {
  it('rapporte les jours renseignés au total', () => {
    const completude = calculerCompletude([
      journee('2026-03-01', 'renseigne'),
      journee('2026-03-02', 'renseigne'),
      journee('2026-03-03', 'manquant'),
      journee('2026-03-04', 'renseigne'),
    ]);

    expect(completude.taux).toBe(0.75);
    expect(completude.joursRenseignes).toBe(3);
    expect(completude.joursManquants).toBe(1);
    expect(completude.joursTotal).toBe(4);
  });

  it('ne compte pas les jours estimés comme renseignés', () => {
    // Un jour estimé repose sur une hypothèse, pas sur une saisie. Le
    // compter gonflerait la confiance accordée au cumul.
    const completude = calculerCompletude([
      journee('2026-03-01', 'renseigne'),
      journee('2026-03-02', 'estime'),
    ]);

    expect(completude.taux).toBe(0.5);
    expect(completude.joursRenseignes).toBe(1);
    expect(completude.joursEstimes).toBe(1);
    expect(completude.joursManquants).toBe(0);
  });

  it('rend un taux nul sur une plage vide, sans diviser par zéro', () => {
    expect(calculerCompletude([])).toEqual({
      taux: 0,
      joursRenseignes: 0,
      joursEstimes: 0,
      joursManquants: 0,
      joursTotal: 0,
    });
  });

  it('rend 1 quand tout est renseigné', () => {
    expect(
      calculerCompletude([journee('2026-03-01', 'renseigne')]).taux,
    ).toBe(1);
  });

  it('rend le taux qui invalide un cumul', () => {
    // Le cas de la spec §6.5 : 40 % de complétude, le cumul ne vaut rien
    // et l'utilisateur doit le voir.
    const journees = Array.from({ length: 10 }, (_, i) =>
      journee(`2026-03-${String(i + 1).padStart(2, '0')}`, i < 4 ? 'renseigne' : 'manquant'),
    );

    expect(calculerCompletude(journees).taux).toBeCloseTo(0.4, 10);
  });
});

describe('completudeSurPlage', () => {
  it('compte les jours saisis sur la durée de la plage', () => {
    const completude = completudeSurPlage({
      dateDebut: '2026-03-01',
      dateFin: '2026-03-10',
      datesRenseignees: ['2026-03-01', '2026-03-02', '2026-03-05'],
    });

    expect(completude.joursTotal).toBe(10);
    expect(completude.joursRenseignes).toBe(3);
    expect(completude.joursManquants).toBe(7);
    expect(completude.taux).toBeCloseTo(0.3, 10);
  });

  it('dédoublonne les dates', () => {
    const completude = completudeSurPlage({
      dateDebut: '2026-03-01',
      dateFin: '2026-03-02',
      datesRenseignees: ['2026-03-01', '2026-03-01'],
    });

    expect(completude.joursRenseignes).toBe(1);
  });

  it('rend un taux nul quand la fin précède le début', () => {
    const completude = completudeSurPlage({
      dateDebut: '2026-03-10',
      dateFin: '2026-03-01',
      datesRenseignees: [],
    });

    expect(completude.taux).toBe(0);
    expect(completude.joursTotal).toBe(0);
    expect(completude.joursManquants).toBe(0);
  });
});

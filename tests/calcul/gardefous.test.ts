import { describe, expect, it } from 'vitest';
import {
  detecterSignaux,
  plancherCalorique,
  verifierAge,
  verifierAllure,
  verifierObjectifKcal,
  verifierPoidsCible,
} from '@/lib/calcul/gardefous';

describe('plancherCalorique', () => {
  it('applique 1 200 kcal pour une femme et 1 500 pour un homme', () => {
    expect(plancherCalorique('f')).toBe(1200);
    expect(plancherCalorique('h')).toBe(1500);
  });
});

describe('verifierObjectifKcal', () => {
  it('laisse passer un objectif au-dessus du plancher', () => {
    const v = verifierObjectifKcal({ sexe: 'f', objectifKcal: 1600 });

    expect(v.conforme).toBe(true);
    expect(v.objectifRetenuKcal).toBe(1600);
    expect(v.plafonne).toBe(false);
  });

  it('relève un objectif sous le plancher au lieu de refuser la saisie', () => {
    const v = verifierObjectifKcal({ sexe: 'f', objectifKcal: 900 });

    expect(v.conforme).toBe(false);
    expect(v.objectifRetenuKcal).toBe(1200);
    expect(v.plancherKcal).toBe(1200);
    expect(v.plafonne).toBe(true);
  });

  it('accepte le plancher exact', () => {
    expect(verifierObjectifKcal({ sexe: 'h', objectifKcal: 1500 }).conforme).toBe(true);
    expect(verifierObjectifKcal({ sexe: 'h', objectifKcal: 1499 }).conforme).toBe(false);
  });
});

describe('verifierPoidsCible', () => {
  it('accepte un poids cible au-dessus d’un IMC de 18,5', () => {
    const v = verifierPoidsCible({ poidsCibleKg: 70, tailleCm: 180 });

    expect(v.conforme).toBe(true);
    expect(v.imcCible).toBeCloseTo(21.6, 1);
  });

  it('refuse un poids cible conduisant sous un IMC de 18,5', () => {
    const v = verifierPoidsCible({ poidsCibleKg: 55, tailleCm: 180 });

    expect(v.conforme).toBe(false);
    expect(v.imcCible).toBeCloseTo(16.98, 2);
    // 18,5 × 1,8² = 59,94 kg
    expect(v.poidsMinimumKg).toBeCloseTo(59.94, 2);
  });

  it('accepte l’IMC minimum exact', () => {
    const minimum = 18.5 * 1.8 * 1.8;
    expect(verifierPoidsCible({ poidsCibleKg: minimum, tailleCm: 180 }).conforme).toBe(
      true,
    );
  });
});

describe('verifierAllure', () => {
  it('accepte une allure sous 1 % du poids corporel par semaine', () => {
    const v = verifierAllure({ allureKgSemaine: -0.5, poidsActuelKg: 80 });

    expect(v.conforme).toBe(true);
    expect(v.allureMaxKgSemaine).toBeCloseTo(0.8, 10);
    expect(v.allureRetenueKgSemaine).toBe(-0.5);
  });

  it('borne une perte trop rapide en conservant le sens', () => {
    const v = verifierAllure({ allureKgSemaine: -1.5, poidsActuelKg: 80 });

    expect(v.conforme).toBe(false);
    expect(v.allureRetenueKgSemaine).toBeCloseTo(-0.8, 10);
  });

  it('borne une prise trop rapide de la même façon', () => {
    // Le surplus n'est pas un mode dégradé du déficit (brief §2).
    const v = verifierAllure({ allureKgSemaine: 1.5, poidsActuelKg: 80 });

    expect(v.conforme).toBe(false);
    expect(v.allureRetenueKgSemaine).toBeCloseTo(0.8, 10);
  });

  it('accepte la limite exacte', () => {
    expect(verifierAllure({ allureKgSemaine: -0.8, poidsActuelKg: 80 }).conforme).toBe(
      true,
    );
  });

  it('adapte la limite au poids : 0,8 kg à 80 kg, 1,1 kg à 110 kg', () => {
    expect(
      verifierAllure({ allureKgSemaine: -1, poidsActuelKg: 80 }).conforme,
    ).toBe(false);
    expect(
      verifierAllure({ allureKgSemaine: -1, poidsActuelKg: 110 }).conforme,
    ).toBe(true);
  });
});

describe('verifierAge', () => {
  it('accepte un majeur', () => {
    const v = verifierAge({ dateNaissance: '2000-03-01', dateReference: '2026-03-01' });

    expect(v.conforme).toBe(true);
    expect(v.age).toBe(26);
    expect(v.ageMinimum).toBe(18);
  });

  it('refuse un mineur', () => {
    const v = verifierAge({ dateNaissance: '2010-03-01', dateReference: '2026-03-01' });

    expect(v.conforme).toBe(false);
    expect(v.age).toBe(16);
  });

  it('accepte le jour des 18 ans, refuse la veille', () => {
    expect(
      verifierAge({ dateNaissance: '2008-03-01', dateReference: '2026-03-01' }).conforme,
    ).toBe(true);
    expect(
      verifierAge({ dateNaissance: '2008-03-02', dateReference: '2026-03-01' }).conforme,
    ).toBe(false);
  });
});

describe('detecterSignaux', () => {
  const OBJECTIF_SAIN = 1800;

  it('ne signale rien sur un suivi ordinaire', () => {
    expect(
      detecterSignaux({
        sexe: 'f',
        objectifKcal: OBJECTIF_SAIN,
        apportsRecents: [1800, 1750, null, 1900, 1820],
      }),
    ).toEqual([]);
  });

  it('signale une restriction sévère prolongée', () => {
    const signaux = detecterSignaux({
      sexe: 'f',
      objectifKcal: OBJECTIF_SAIN,
      apportsRecents: Array.from({ length: 7 }, () => 900),
    });

    expect(signaux).toContain('restriction_severe_prolongee');
  });

  it('ne signale pas une restriction courte', () => {
    const signaux = detecterSignaux({
      sexe: 'f',
      objectifKcal: OBJECTIF_SAIN,
      apportsRecents: [900, 900, 1800, 1800],
    });

    expect(signaux).not.toContain('restriction_severe_prolongee');
  });

  it('accepte un seuil de jours personnalisé', () => {
    const signaux = detecterSignaux({
      sexe: 'f',
      objectifKcal: OBJECTIF_SAIN,
      apportsRecents: [900, 900, 900],
      seuilJoursRestriction: 3,
    });

    expect(signaux).toContain('restriction_severe_prolongee');
  });

  it('signale des jours à zéro répétés', () => {
    const signaux = detecterSignaux({
      sexe: 'f',
      objectifKcal: OBJECTIF_SAIN,
      apportsRecents: [0, 1800, 0],
    });

    expect(signaux).toContain('jours_a_zero_repetes');
    // Un jour à zéro n'est pas compté comme une restriction sévère :
    // c'est presque toujours un jour non saisi plutôt qu'un jeûne.
    expect(signaux).not.toContain('restriction_severe_prolongee');
  });

  it('ne signale pas un unique jour à zéro', () => {
    expect(
      detecterSignaux({
        sexe: 'f',
        objectifKcal: OBJECTIF_SAIN,
        apportsRecents: [0, 1800, 1800],
      }),
    ).toEqual([]);
  });

  it('signale un objectif posé au plancher', () => {
    const signaux = detecterSignaux({
      sexe: 'f',
      objectifKcal: 1200,
      apportsRecents: [1800],
    });

    expect(signaux).toContain('objectif_a_la_limite');
  });

  it('ignore les jours non renseignés', () => {
    expect(
      detecterSignaux({
        sexe: 'h',
        objectifKcal: OBJECTIF_SAIN,
        apportsRecents: [null, null, null],
      }),
    ).toEqual([]);
  });

  it('cumule plusieurs signaux', () => {
    const signaux = detecterSignaux({
      sexe: 'h',
      objectifKcal: 1400,
      apportsRecents: [...Array.from({ length: 7 }, () => 1000), 0, 0],
    });

    expect(signaux).toEqual([
      'restriction_severe_prolongee',
      'jours_a_zero_repetes',
      'objectif_a_la_limite',
    ]);
  });
});

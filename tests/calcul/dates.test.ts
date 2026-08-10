import { describe, expect, it } from 'vitest';
import {
  ajouterJours,
  calculerAge,
  differenceJours,
  estDansPlage,
  estDateIso,
  nombreJoursInclus,
  plageDates,
} from '@/lib/calcul/dates';

describe('estDateIso', () => {
  it('accepte une date réelle', () => {
    expect(estDateIso('2026-03-15')).toBe(true);
    expect(estDateIso('2024-02-29')).toBe(true);
  });

  it('rejette un format non conforme', () => {
    expect(estDateIso('15/03/2026')).toBe(false);
    expect(estDateIso('2026-3-15')).toBe(false);
    expect(estDateIso('2026-03-15T00:00:00Z')).toBe(false);
    expect(estDateIso('')).toBe(false);
  });

  it('rejette un mois ou un jour hors bornes', () => {
    expect(estDateIso('2026-00-10')).toBe(false);
    expect(estDateIso('2026-13-10')).toBe(false);
    expect(estDateIso('2026-03-00')).toBe(false);
    expect(estDateIso('2026-03-32')).toBe(false);
  });

  it('rejette une date qui n’existe pas, sans la reporter silencieusement', () => {
    // `Date.UTC(2026, 1, 31)` donnerait le 3 mars sans broncher : c'est
    // exactement le report qu'il ne faut pas laisser passer.
    expect(estDateIso('2026-02-31')).toBe(false);
    expect(estDateIso('2026-02-29')).toBe(false);
    expect(estDateIso('2026-04-31')).toBe(false);
  });
});

describe('ajouterJours', () => {
  it('avance et recule', () => {
    expect(ajouterJours('2026-03-15', 1)).toBe('2026-03-16');
    expect(ajouterJours('2026-03-15', -1)).toBe('2026-03-14');
    expect(ajouterJours('2026-03-15', 0)).toBe('2026-03-15');
  });

  it('franchit les mois et les années', () => {
    expect(ajouterJours('2026-01-31', 1)).toBe('2026-02-01');
    expect(ajouterJours('2026-12-31', 1)).toBe('2027-01-01');
    expect(ajouterJours('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('franchit un 29 février', () => {
    expect(ajouterJours('2024-02-28', 1)).toBe('2024-02-29');
    expect(ajouterJours('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('n’est pas décalé par le passage à l’heure d’été', () => {
    // En Europe/Paris, le 29 mars 2026 ne dure que 23 h. Un calcul en
    // heure locale décalerait toute la suite du programme d'un jour.
    expect(ajouterJours('2026-03-28', 1)).toBe('2026-03-29');
    expect(ajouterJours('2026-03-29', 1)).toBe('2026-03-30');
    expect(differenceJours('2026-03-28', '2026-03-30')).toBe(2);
  });

  it('échoue bruyamment sur une date invalide', () => {
    expect(() => ajouterJours('2026-02-31', 1)).toThrow(RangeError);
    expect(() => ajouterJours('pas une date', 1)).toThrow(RangeError);
  });
});

describe('differenceJours', () => {
  it('compte dans les deux sens', () => {
    expect(differenceJours('2026-01-01', '2026-01-03')).toBe(2);
    expect(differenceJours('2026-01-03', '2026-01-01')).toBe(-2);
    expect(differenceJours('2026-01-01', '2026-01-01')).toBe(0);
  });

  it('compte une année complète', () => {
    expect(differenceJours('2026-01-01', '2027-01-01')).toBe(365);
    expect(differenceJours('2024-01-01', '2025-01-01')).toBe(366);
  });
});

describe('nombreJoursInclus', () => {
  it('compte les deux bornes', () => {
    expect(nombreJoursInclus('2026-03-01', '2026-03-01')).toBe(1);
    expect(nombreJoursInclus('2026-03-01', '2026-03-28')).toBe(28);
  });
});

describe('plageDates', () => {
  it('énumère bornes comprises', () => {
    expect(plageDates('2026-03-01', '2026-03-04')).toEqual([
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
    ]);
  });

  it('renvoie un seul jour quand les bornes sont égales', () => {
    expect(plageDates('2026-03-01', '2026-03-01')).toEqual(['2026-03-01']);
  });

  it('renvoie une plage vide quand la fin précède le début', () => {
    expect(plageDates('2026-03-04', '2026-03-01')).toEqual([]);
  });
});

describe('estDansPlage', () => {
  it('inclut les bornes', () => {
    expect(estDansPlage('2026-03-01', '2026-03-01', '2026-03-04')).toBe(true);
    expect(estDansPlage('2026-03-04', '2026-03-01', '2026-03-04')).toBe(true);
    expect(estDansPlage('2026-03-02', '2026-03-01', '2026-03-04')).toBe(true);
  });

  it('exclut ce qui déborde', () => {
    expect(estDansPlage('2026-02-28', '2026-03-01', '2026-03-04')).toBe(false);
    expect(estDansPlage('2026-03-05', '2026-03-01', '2026-03-04')).toBe(false);
  });
});

describe('calculerAge', () => {
  it('compte les années révolues', () => {
    expect(calculerAge('1990-06-15', '2026-06-15')).toBe(36);
    expect(calculerAge('1990-06-15', '2026-06-16')).toBe(36);
  });

  it('ne compte pas l’anniversaire à venir', () => {
    expect(calculerAge('1990-06-15', '2026-06-14')).toBe(35);
    expect(calculerAge('1990-12-31', '2026-01-01')).toBe(35);
  });

  it('fait tomber un anniversaire du 29 février au 1er mars', () => {
    // 2026 n'est pas bissextile : né le 29 février, on a un an de plus
    // le 1er mars, pas le 28 février.
    expect(calculerAge('2004-02-29', '2026-02-28')).toBe(21);
    expect(calculerAge('2004-02-29', '2026-03-01')).toBe(22);
    // Année bissextile : l'anniversaire existe.
    expect(calculerAge('2004-02-29', '2028-02-29')).toBe(24);
  });

  it('refuse une référence antérieure à la naissance', () => {
    expect(() => calculerAge('2026-06-15', '2026-06-14')).toThrow(RangeError);
  });
});

import { describe, expect, it } from 'vitest';
import {
  calculerImc,
  lisserPesees,
  poidsALaDate,
  tendancePoids,
} from '@/lib/calcul/poids';
import type { PeseeLissee } from '@/lib/calcul/types';

function lissee(date: string, moyenneMobile7jKg: number, aberrante = false): PeseeLissee {
  return { date, poidsKg: moyenneMobile7jKg, moyenneMobile7jKg, aberrante };
}

describe('lisserPesees', () => {
  it('la première pesée est sa propre moyenne et ne peut pas être aberrante', () => {
    const [premiere] = lisserPesees([{ date: '2026-03-01', poidsKg: 80 }]);

    expect(premiere?.moyenneMobile7jKg).toBe(80);
    expect(premiere?.aberrante).toBe(false);
  });

  it('moyenne sur une fenêtre calendaire de 7 jours', () => {
    const resultat = lisserPesees([
      { date: '2026-03-01', poidsKg: 80.0 },
      { date: '2026-03-02', poidsKg: 80.4 },
      { date: '2026-03-03', poidsKg: 79.8 },
    ]);

    expect(resultat[0]?.moyenneMobile7jKg).toBeCloseTo(80.0, 10);
    expect(resultat[1]?.moyenneMobile7jKg).toBeCloseTo(80.2, 10);
    expect(resultat[2]?.moyenneMobile7jKg).toBeCloseTo((80.0 + 80.4 + 79.8) / 3, 10);
  });

  it('marque une pesée aberrante, l’enregistre, et l’exclut de la moyenne', () => {
    const resultat = lisserPesees([
      { date: '2026-03-01', poidsKg: 80.0 },
      { date: '2026-03-02', poidsKg: 80.4 },
      { date: '2026-03-03', poidsKg: 79.8 },
      // 85 kg contre une moyenne à 80,07 : écart de près de 5 kg.
      { date: '2026-03-04', poidsKg: 85.0 },
    ]);

    const aberrante = resultat[3];
    expect(aberrante?.aberrante).toBe(true);
    // La valeur brute est conservée : on n'écrase jamais une saisie.
    expect(aberrante?.poidsKg).toBe(85.0);
    // Et elle ne tire pas la moyenne vers le haut.
    expect(aberrante?.moyenneMobile7jKg).toBeCloseTo((80.0 + 80.4 + 79.8) / 3, 10);
  });

  it('reprend le cours normal après une aberrante', () => {
    const resultat = lisserPesees([
      { date: '2026-03-01', poidsKg: 80.0 },
      { date: '2026-03-02', poidsKg: 80.4 },
      { date: '2026-03-03', poidsKg: 79.8 },
      { date: '2026-03-04', poidsKg: 85.0 },
      { date: '2026-03-05', poidsKg: 79.9 },
    ]);

    expect(resultat[4]?.aberrante).toBe(false);
    expect(resultat[4]?.moyenneMobile7jKg).toBeCloseTo(
      (80.0 + 80.4 + 79.8 + 79.9) / 4,
      10,
    );
  });

  it('accepte exactement 2 kg d’écart, refuse au-delà', () => {
    const limite = lisserPesees([
      { date: '2026-03-01', poidsKg: 80 },
      { date: '2026-03-02', poidsKg: 82 },
    ]);
    expect(limite[1]?.aberrante).toBe(false);

    const depasse = lisserPesees([
      { date: '2026-03-01', poidsKg: 80 },
      { date: '2026-03-02', poidsKg: 82.01 },
    ]);
    expect(depasse[1]?.aberrante).toBe(true);
  });

  it('ne compare pas à une pesée sortie de la fenêtre de 7 jours', () => {
    // Trois semaines plus tard, 5 kg d'écart : ce n'est pas une
    // aberration, c'est un régime qui a fonctionné.
    const resultat = lisserPesees([
      { date: '2026-03-01', poidsKg: 85 },
      { date: '2026-03-22', poidsKg: 80 },
    ]);

    expect(resultat[1]?.aberrante).toBe(false);
    expect(resultat[1]?.moyenneMobile7jKg).toBe(80);
  });

  it('trie les pesées données dans le désordre', () => {
    const resultat = lisserPesees([
      { date: '2026-03-03', poidsKg: 79.8 },
      { date: '2026-03-01', poidsKg: 80.0 },
      { date: '2026-03-02', poidsKg: 80.4 },
    ]);

    expect(resultat.map((p) => p.date)).toEqual([
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
    ]);
  });

  it('rend une liste vide sur une entrée vide', () => {
    expect(lisserPesees([])).toEqual([]);
  });
});

describe('tendancePoids', () => {
  it('calcule le rythme en kg/semaine et en pourcentage du poids', () => {
    // 2 kg perdus en 28 jours = 0,5 kg/semaine ; 0,5 / 80 = 0,625 %
    const tendance = tendancePoids({
      pesees: [lissee('2026-03-01', 80), lissee('2026-03-29', 78)],
      dateFin: '2026-03-29',
      joursFenetre: 29,
    });

    expect(tendance?.kgParSemaine).toBeCloseTo(-0.5, 10);
    expect(tendance?.pourcentPoidsParSemaine).toBeCloseTo(-0.625, 10);
    expect(tendance?.joursObserves).toBe(28);
    expect(tendance?.poidsDebutKg).toBe(80);
    expect(tendance?.poidsFinKg).toBe(78);
  });

  it('rend un rythme positif en prise de poids', () => {
    const tendance = tendancePoids({
      pesees: [lissee('2026-03-01', 78), lissee('2026-03-29', 80)],
      dateFin: '2026-03-29',
      joursFenetre: 29,
    });

    expect(tendance?.kgParSemaine).toBeCloseTo(0.5, 10);
  });

  it('renvoie null sans pesée, ou avec une seule', () => {
    expect(
      tendancePoids({ pesees: [], dateFin: '2026-03-29', joursFenetre: 28 }),
    ).toBeNull();

    expect(
      tendancePoids({
        pesees: [lissee('2026-03-01', 80)],
        dateFin: '2026-03-29',
        joursFenetre: 29,
      }),
    ).toBeNull();
  });

  it('renvoie null quand toutes les pesées tombent le même jour', () => {
    expect(
      tendancePoids({
        pesees: [lissee('2026-03-01', 80), lissee('2026-03-01', 79)],
        dateFin: '2026-03-29',
        joursFenetre: 29,
      }),
    ).toBeNull();
  });

  it('ignore les aberrantes et les pesées hors fenêtre', () => {
    const tendance = tendancePoids({
      pesees: [
        lissee('2026-01-01', 95),
        lissee('2026-03-01', 80),
        lissee('2026-03-10', 74, true),
        lissee('2026-03-29', 78),
      ],
      dateFin: '2026-03-29',
      joursFenetre: 29,
    });

    expect(tendance?.poidsDebutKg).toBe(80);
    expect(tendance?.poidsFinKg).toBe(78);
  });
});

describe('poidsALaDate', () => {
  it('rend le poids par défaut quand aucune pesée n’est utilisable', () => {
    expect(
      poidsALaDate({ pesees: [], date: '2026-03-15', poidsDefautKg: 80 }),
    ).toBe(80);

    expect(
      poidsALaDate({
        pesees: [lissee('2026-03-10', 78, true)],
        date: '2026-03-15',
        poidsDefautKg: 80,
      }),
    ).toBe(80);
  });

  it('rend la moyenne mobile la plus récente non postérieure à la date', () => {
    const pesees = [lissee('2026-03-01', 80), lissee('2026-03-10', 79), lissee('2026-03-20', 78)];

    expect(poidsALaDate({ pesees, date: '2026-03-15', poidsDefautKg: 85 })).toBe(79);
    expect(poidsALaDate({ pesees, date: '2026-03-10', poidsDefautKg: 85 })).toBe(79);
    expect(poidsALaDate({ pesees, date: '2026-03-25', poidsDefautKg: 85 })).toBe(78);
  });

  it('rend le poids par défaut avant la première pesée', () => {
    expect(
      poidsALaDate({
        pesees: [lissee('2026-03-10', 79)],
        date: '2026-03-01',
        poidsDefautKg: 80,
      }),
    ).toBe(80);
  });
});

describe('calculerImc', () => {
  it('calcule l’indice', () => {
    // 80 / 1,8² = 24,691…
    expect(calculerImc(80, 180)).toBeCloseTo(24.691, 3);
  });

  it('refuse une taille nulle ou négative plutôt que de rendre l’infini', () => {
    expect(() => calculerImc(80, 0)).toThrow(RangeError);
    expect(() => calculerImc(80, -180)).toThrow(RangeError);
  });
});

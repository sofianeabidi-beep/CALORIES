import { describe, expect, it } from 'vitest';
import {
  cumulerDeficit,
  deficitJour,
  estimerApportManquant,
  kcalVersKg,
  kgVersKcal,
  resoudreJournees,
} from '@/lib/calcul/deficit';
import type { ApportJournalier, ModeJoursManquants } from '@/lib/calcul/types';

const DEPENSE = 2500;
const depenseConstante = () => DEPENSE;

/** Cinq jours dont le 3 mars est absent — le cas qui distingue les trois modes. */
const APPORTS_AVEC_TROU: ApportJournalier[] = [
  { date: '2026-03-01', apportKcal: 2000 },
  { date: '2026-03-02', apportKcal: 2200 },
  { date: '2026-03-04', apportKcal: 1800 },
  { date: '2026-03-05', apportKcal: 2000 },
];

function resoudre(mode: ModeJoursManquants) {
  return resoudreJournees({
    dateDebut: '2026-03-01',
    dateFin: '2026-03-05',
    apports: APPORTS_AVEC_TROU,
    mode,
    depenseRetenuePourDate: depenseConstante,
  });
}

describe('deficitJour', () => {
  it('soustrait l’apport de la dépense retenue', () => {
    expect(deficitJour({ depenseRetenueKcal: 2500, apportKcal: 2000 })).toBe(500);
  });

  it('devient négatif en surplus, sans que ce soit un cas particulier', () => {
    expect(deficitJour({ depenseRetenueKcal: 2500, apportKcal: 3000 })).toBe(-500);
  });

  it('n’ajoute pas l’activité saisie — elle est déjà dans la dépense retenue', () => {
    // Écart assumé par rapport à la lettre de la spec §6.4, documenté
    // dans CLAUDE.md : l'ajouter la compterait deux fois dès que la
    // dépense réelle recalculée remplace l'estimation.
    expect(deficitJour({ depenseRetenueKcal: 2500, apportKcal: 2000 })).toBe(500);
  });
});

describe('estimerApportManquant', () => {
  it('renvoie null quand aucun jour renseigné ne précède', () => {
    expect(estimerApportManquant([])).toBeNull();
    expect(estimerApportManquant([{ date: '2026-03-01', apportKcal: null }])).toBeNull();
  });

  it('moyenne les jours renseignés', () => {
    expect(
      estimerApportManquant([
        { date: '2026-03-01', apportKcal: 2000 },
        { date: '2026-03-02', apportKcal: 2200 },
      ]),
    ).toBe(2100);
  });

  it('ne retient que les 7 derniers jours renseignés', () => {
    const apports: ApportJournalier[] = [
      // Ce jour très bas est hors des 7 derniers : il ne doit pas peser.
      { date: '2026-03-01', apportKcal: 500 },
      ...Array.from({ length: 7 }, (_, i) => ({
        date: `2026-03-${String(i + 2).padStart(2, '0')}`,
        apportKcal: 2000,
      })),
    ];

    expect(estimerApportManquant(apports)).toBe(2000);
  });

  it('ignore les jours non renseignés intercalés', () => {
    expect(
      estimerApportManquant([
        { date: '2026-03-01', apportKcal: 2000 },
        { date: '2026-03-02', apportKcal: null },
        { date: '2026-03-03', apportKcal: 2400 },
      ]),
    ).toBe(2200);
  });
});

describe('resoudreJournees — les trois modes de jours manquants', () => {
  it('mode neutre : le jour est exclu du cumul et compté comme manquant', () => {
    const journees = resoudre('neutre');
    const trou = journees[2];

    expect(journees).toHaveLength(5);
    expect(trou?.date).toBe('2026-03-03');
    expect(trou?.statut).toBe('manquant');
    expect(trou?.apportRetenuKcal).toBeNull();
    expect(trou?.deficitKcal).toBeNull();
  });

  it('mode estime : le jour prend la moyenne des 7 derniers jours renseignés', () => {
    const journees = resoudre('estime');
    const trou = journees[2];

    // (2000 + 2200) / 2 = 2100 ; déficit = 2500 − 2100 = 400
    expect(trou?.statut).toBe('estime');
    expect(trou?.apportRetenuKcal).toBe(2100);
    expect(trou?.deficitKcal).toBe(400);
  });

  it('mode strict : déficit nul, l’apport est réputé égal à la dépense', () => {
    const journees = resoudre('strict');
    const trou = journees[2];

    expect(trou?.statut).toBe('manquant');
    expect(trou?.apportRetenuKcal).toBe(DEPENSE);
    expect(trou?.deficitKcal).toBe(0);
  });

  it('mode estime sans historique : retombe sur le comportement neutre', () => {
    // Rien à estimer le premier jour d'un programme : inventer un
    // chiffre serait pire que d'assumer le trou.
    const journees = resoudreJournees({
      dateDebut: '2026-03-01',
      dateFin: '2026-03-02',
      apports: [{ date: '2026-03-02', apportKcal: 2000 }],
      mode: 'estime',
      depenseRetenuePourDate: depenseConstante,
    });

    expect(journees[0]?.statut).toBe('manquant');
    expect(journees[0]?.deficitKcal).toBeNull();
    expect(journees[1]?.statut).toBe('renseigne');
  });

  it('marque les jours saisis comme renseignés et calcule leur déficit', () => {
    const journees = resoudre('neutre');

    expect(journees[0]).toEqual({
      date: '2026-03-01',
      statut: 'renseigne',
      apportRetenuKcal: 2000,
      depenseRetenueKcal: 2500,
      deficitKcal: 500,
    });
  });

  it('traite un apport explicitement nul comme un jour renseigné', () => {
    // Un jeûne saisi est une information, pas une absence de saisie.
    const journees = resoudreJournees({
      dateDebut: '2026-03-01',
      dateFin: '2026-03-01',
      apports: [{ date: '2026-03-01', apportKcal: 0 }],
      mode: 'neutre',
      depenseRetenuePourDate: depenseConstante,
    });

    expect(journees[0]?.statut).toBe('renseigne');
    expect(journees[0]?.deficitKcal).toBe(2500);
  });

  it('applique la dépense propre à chaque date', () => {
    const journees = resoudreJournees({
      dateDebut: '2026-03-01',
      dateFin: '2026-03-02',
      apports: [
        { date: '2026-03-01', apportKcal: 2000 },
        { date: '2026-03-02', apportKcal: 2000 },
      ],
      mode: 'neutre',
      depenseRetenuePourDate: (date) => (date === '2026-03-01' ? 2500 : 2400),
    });

    expect(journees[0]?.deficitKcal).toBe(500);
    expect(journees[1]?.deficitKcal).toBe(400);
  });

  it('ignore les apports hors de la plage demandée', () => {
    const journees = resoudreJournees({
      dateDebut: '2026-03-02',
      dateFin: '2026-03-02',
      apports: APPORTS_AVEC_TROU,
      mode: 'neutre',
      depenseRetenuePourDate: depenseConstante,
    });

    expect(journees).toHaveLength(1);
    expect(journees[0]?.apportRetenuKcal).toBe(2200);
  });
});

describe('cumulerDeficit', () => {
  it('somme les jours retenus et convertit en kilos', () => {
    const cumul = cumulerDeficit(resoudre('neutre'));

    // 500 + 300 + 700 + 500 = 2000 kcal sur 4 jours retenus
    expect(cumul.deficitCumuleKcal).toBe(2000);
    expect(cumul.joursCumules).toBe(4);
    expect(cumul.kgTheoriques).toBeCloseTo(2000 / 7700, 10);
  });

  it('exclut les jours neutres, c’est tout l’intérêt du mode', () => {
    const neutre = cumulerDeficit(resoudre('neutre'));
    const strict = cumulerDeficit(resoudre('strict'));

    expect(neutre.joursCumules).toBe(4);
    expect(strict.joursCumules).toBe(5);
    // Le mode strict ajoute un jour à déficit nul : le cumul ne bouge
    // pas, mais le dénominateur de la complétude, si.
    expect(strict.deficitCumuleKcal).toBe(neutre.deficitCumuleKcal);
  });

  it('intègre les jours estimés au cumul', () => {
    const estime = cumulerDeficit(resoudre('estime'));

    expect(estime.deficitCumuleKcal).toBe(2400);
    expect(estime.joursCumules).toBe(5);
  });

  it('rend un cumul nul sur une plage vide', () => {
    expect(cumulerDeficit([])).toEqual({
      deficitCumuleKcal: 0,
      kgTheoriques: 0,
      joursCumules: 0,
    });
  });
});

describe('conversions', () => {
  it('convertit dans les deux sens au coefficient de 7 700', () => {
    expect(kcalVersKg(7700)).toBe(1);
    expect(kgVersKcal(1)).toBe(7700);
    expect(kcalVersKg(kgVersKcal(0.5))).toBeCloseTo(0.5, 10);
  });
});

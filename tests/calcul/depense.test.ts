import { describe, expect, it } from 'vitest';
import {
  depenseEstimee,
  depenseReelle,
  depenseRetenue,
  metabolismeDeBase,
} from '@/lib/calcul/depense';
import { ajouterJours } from '@/lib/calcul/dates';
import type { ApportJournalier, PeseeLissee } from '@/lib/calcul/types';

/** Journées renseignées à apport constant, du plus ancien au plus récent. */
function apportsConstants(
  dateFin: string,
  nombreJours: number,
  apportKcal: number,
): ApportJournalier[] {
  return Array.from({ length: nombreJours }, (_, i) => ({
    date: ajouterJours(dateFin, -(nombreJours - 1 - i)),
    apportKcal,
  }));
}

function pesee(date: string, moyenneMobile7jKg: number, aberrante = false): PeseeLissee {
  return { date, poidsKg: moyenneMobile7jKg, moyenneMobile7jKg, aberrante };
}

describe('metabolismeDeBase — Mifflin-St Jeor', () => {
  it('calcule pour un homme', () => {
    // 10×80 + 6,25×180 − 5×30 + 5 = 800 + 1125 − 150 + 5 = 1780
    expect(metabolismeDeBase({ sexe: 'h', poidsKg: 80, tailleCm: 180, ageAns: 30 })).toBe(
      1780,
    );
  });

  it('calcule pour une femme', () => {
    // 10×65 + 6,25×165 − 5×35 − 161 = 650 + 1031,25 − 175 − 161 = 1345,25
    expect(metabolismeDeBase({ sexe: 'f', poidsKg: 65, tailleCm: 165, ageAns: 35 })).toBe(
      1345.25,
    );
  });

  it('sépare les deux sexes de 166 kcal à morphologie égale', () => {
    const commun = { poidsKg: 70, tailleCm: 170, ageAns: 40 };
    expect(
      metabolismeDeBase({ ...commun, sexe: 'h' }) -
        metabolismeDeBase({ ...commun, sexe: 'f' }),
    ).toBe(166);
  });
});

describe('depenseEstimee', () => {
  const homme = {
    sexe: 'h' as const,
    poidsKg: 80,
    tailleCm: 180,
    ageAns: 30,
  };

  it('applique le facteur d’activité', () => {
    // 1780 × 1,55 = 2759
    expect(depenseEstimee({ ...homme, niveauActivite: 'modere' })).toBeCloseTo(2759, 6);
  });

  it('couvre les cinq niveaux, dans l’ordre croissant', () => {
    const valeurs = (
      ['sedentaire', 'leger', 'modere', 'soutenu', 'tres_soutenu'] as const
    ).map((niveauActivite) => depenseEstimee({ ...homme, niveauActivite }));

    expect(valeurs).toEqual([
      1780 * 1.2,
      1780 * 1.375,
      1780 * 1.55,
      1780 * 1.725,
      1780 * 1.9,
    ]);
    expect(valeurs).toEqual([...valeurs].sort((a, b) => a - b));
  });
});

describe('depenseReelle — bilan énergétique inverse', () => {
  const DATE_FIN = '2026-03-28';

  it('déduit une dépense supérieure à l’apport quand le poids baisse', () => {
    // 28 jours à 2 000 kcal, moyenne mobile de 80,0 à 79,5 en 14 jours.
    // variation = −0,5 kg ; −(−0,5 × 7700 / 14) = +275
    // dépense réelle = 2000 + 275 = 2275 kcal/j
    const resultat = depenseReelle({
      dateFin: DATE_FIN,
      apports: apportsConstants(DATE_FIN, 28, 2000),
      pesees: [pesee('2026-03-01', 80), pesee('2026-03-15', 79.5)],
    });

    expect(resultat.depenseReelleKcal).toBeCloseTo(2275, 6);
    expect(resultat.fiabilite).toBe(1);
    expect(resultat.joursRenseignes).toBe(28);
    expect(resultat.joursFenetre).toBe(28);
    expect(resultat.raisonIndisponible).toBeNull();
  });

  it('déduit une dépense inférieure à l’apport quand le poids monte', () => {
    // variation = +0,5 kg ; −(+0,5 × 7700 / 14) = −275
    const resultat = depenseReelle({
      dateFin: DATE_FIN,
      apports: apportsConstants(DATE_FIN, 28, 2000),
      pesees: [pesee('2026-03-01', 80), pesee('2026-03-15', 80.5)],
    });

    expect(resultat.depenseReelleKcal).toBeCloseTo(1725, 6);
  });

  it('rend l’apport moyen quand le poids ne bouge pas', () => {
    const resultat = depenseReelle({
      dateFin: DATE_FIN,
      apports: apportsConstants(DATE_FIN, 28, 2000),
      pesees: [pesee('2026-03-01', 80), pesee('2026-03-15', 80)],
    });

    expect(resultat.depenseReelleKcal).toBeCloseTo(2000, 6);
  });

  it('exige 14 jours renseignés dans la fenêtre', () => {
    const resultat = depenseReelle({
      dateFin: DATE_FIN,
      apports: apportsConstants(DATE_FIN, 13, 2000),
      pesees: [pesee('2026-03-01', 80), pesee('2026-03-15', 79.5)],
    });

    expect(resultat.depenseReelleKcal).toBeNull();
    expect(resultat.raisonIndisponible).toBe('jours_renseignes_insuffisants');
    // La fiabilité reste exposée même quand le calcul n'aboutit pas :
    // c'est elle qui explique à l'utilisateur pourquoi.
    expect(resultat.fiabilite).toBeCloseTo(13 / 28, 6);
  });

  it('exige deux pesées', () => {
    const resultat = depenseReelle({
      dateFin: DATE_FIN,
      apports: apportsConstants(DATE_FIN, 28, 2000),
      pesees: [pesee('2026-03-01', 80)],
    });

    expect(resultat.raisonIndisponible).toBe('pesees_insuffisantes');
  });

  it('exige 10 jours entre la première et la dernière pesée', () => {
    const resultat = depenseReelle({
      dateFin: DATE_FIN,
      apports: apportsConstants(DATE_FIN, 28, 2000),
      pesees: [pesee('2026-03-01', 80), pesee('2026-03-09', 79.5)],
    });

    expect(resultat.raisonIndisponible).toBe('pesees_trop_rapprochees');
  });

  it('ignore les pesées aberrantes et celles sans moyenne mobile', () => {
    const avec = depenseReelle({
      dateFin: DATE_FIN,
      apports: apportsConstants(DATE_FIN, 28, 2000),
      pesees: [
        pesee('2026-03-01', 80),
        // Un kilo d'eau un matin ne doit pas déplacer la dépense.
        pesee('2026-03-20', 74, true),
        { date: '2026-03-22', poidsKg: 79.4, moyenneMobile7jKg: null, aberrante: false },
        pesee('2026-03-15', 79.5),
      ],
    });

    expect(avec.depenseReelleKcal).toBeCloseTo(2275, 6);
  });

  it('exclut les jours hors fenêtre', () => {
    const resultat = depenseReelle({
      dateFin: DATE_FIN,
      // 40 jours saisis, mais la fenêtre n'en retient que 28.
      apports: apportsConstants(DATE_FIN, 40, 2000),
      pesees: [
        pesee('2026-01-15', 90),
        pesee('2026-03-01', 80),
        pesee('2026-03-15', 79.5),
      ],
    });

    expect(resultat.joursRenseignes).toBe(28);
    expect(resultat.fiabilite).toBe(1);
    expect(resultat.depenseReelleKcal).toBeCloseTo(2275, 6);
  });

  it('accepte une fenêtre personnalisée', () => {
    const resultat = depenseReelle({
      dateFin: DATE_FIN,
      apports: apportsConstants(DATE_FIN, 14, 2000),
      pesees: [pesee('2026-03-15', 80), pesee('2026-03-28', 79.5)],
      joursFenetre: 14,
    });

    expect(resultat.joursFenetre).toBe(14);
    expect(resultat.fiabilite).toBe(1);
    // 13 jours d'écart : 0,5 × 7700 / 13 = 296,15…
    expect(resultat.depenseReelleKcal).toBeCloseTo(2000 + (0.5 * 7700) / 13, 6);
  });

  it('ignore les jours non renseignés dans la moyenne d’apport', () => {
    const apports: ApportJournalier[] = apportsConstants(DATE_FIN, 28, 2000).map((a, i) =>
      i < 5 ? { ...a, apportKcal: null } : a,
    );

    const resultat = depenseReelle({
      dateFin: DATE_FIN,
      apports,
      pesees: [pesee('2026-03-01', 80), pesee('2026-03-15', 79.5)],
    });

    expect(resultat.joursRenseignes).toBe(23);
    expect(resultat.fiabilite).toBeCloseTo(23 / 28, 6);
    // La moyenne porte sur les seuls jours renseignés, pas sur 28.
    expect(resultat.depenseReelleKcal).toBeCloseTo(2275, 6);
  });
});

describe('depenseRetenue', () => {
  it('retient l’estimation tant que la dépense réelle est indisponible', () => {
    const resultat = depenseRetenue({
      depenseEstimeeKcal: 2500,
      depenseReelleKcal: null,
      fiabilite: 1,
      depenseRetenueVeilleKcal: null,
    });

    expect(resultat.depenseRetenueKcal).toBe(2500);
    expect(resultat.issueDuReel).toBe(false);
    expect(resultat.lissee).toBe(false);
  });

  it('retient l’estimation sous le seuil de fiabilité de 0,6', () => {
    const resultat = depenseRetenue({
      depenseEstimeeKcal: 2500,
      depenseReelleKcal: 2200,
      fiabilite: 0.59,
      depenseRetenueVeilleKcal: null,
    });

    expect(resultat.depenseRetenueKcal).toBe(2500);
    expect(resultat.issueDuReel).toBe(false);
  });

  it('bascule sur le réel exactement au seuil de 0,6', () => {
    const resultat = depenseRetenue({
      depenseEstimeeKcal: 2500,
      depenseReelleKcal: 2200,
      fiabilite: 0.6,
      depenseRetenueVeilleKcal: null,
    });

    expect(resultat.depenseRetenueKcal).toBe(2200);
    expect(resultat.issueDuReel).toBe(true);
  });

  it('bride une hausse à 5 % de la veille', () => {
    const resultat = depenseRetenue({
      depenseEstimeeKcal: 2500,
      depenseReelleKcal: null,
      fiabilite: 0,
      depenseRetenueVeilleKcal: 2000,
    });

    expect(resultat.depenseRetenueKcal).toBe(2100);
    expect(resultat.lissee).toBe(true);
  });

  it('bride une baisse à 5 % de la veille', () => {
    const resultat = depenseRetenue({
      depenseEstimeeKcal: 1000,
      depenseReelleKcal: null,
      fiabilite: 0,
      depenseRetenueVeilleKcal: 2000,
    });

    expect(resultat.depenseRetenueKcal).toBe(1900);
    expect(resultat.lissee).toBe(true);
  });

  it('laisse passer une variation inférieure à 5 %', () => {
    const resultat = depenseRetenue({
      depenseEstimeeKcal: 2050,
      depenseReelleKcal: null,
      fiabilite: 0,
      depenseRetenueVeilleKcal: 2000,
    });

    expect(resultat.depenseRetenueKcal).toBe(2050);
    expect(resultat.lissee).toBe(false);
  });

  it('lisse aussi le basculement vers le réel, qui serait la marche la plus brutale', () => {
    const resultat = depenseRetenue({
      depenseEstimeeKcal: 2800,
      depenseReelleKcal: 2200,
      fiabilite: 0.8,
      depenseRetenueVeilleKcal: 2800,
    });

    expect(resultat.issueDuReel).toBe(true);
    expect(resultat.depenseRetenueKcal).toBe(2660);
    expect(resultat.lissee).toBe(true);
  });

  it('ignore une veille nulle ou négative plutôt que de tout écraser', () => {
    const resultat = depenseRetenue({
      depenseEstimeeKcal: 2500,
      depenseReelleKcal: null,
      fiabilite: 0,
      depenseRetenueVeilleKcal: 0,
    });

    expect(resultat.depenseRetenueKcal).toBe(2500);
    expect(resultat.lissee).toBe(false);
  });

  it('converge vers le réel en plusieurs jours au lieu de sauter', () => {
    let veille = 2800;
    const cible = 2200;
    for (let jour = 0; jour < 20; jour += 1) {
      veille = depenseRetenue({
        depenseEstimeeKcal: 2800,
        depenseReelleKcal: cible,
        fiabilite: 0.9,
        depenseRetenueVeilleKcal: veille,
      }).depenseRetenueKcal;
    }
    expect(veille).toBeCloseTo(cible, 6);
  });
});

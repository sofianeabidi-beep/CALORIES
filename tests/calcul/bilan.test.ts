import { describe, expect, it } from 'vitest';
import {
  calculerBilan,
  calculerInstantanes,
  interpreterEcart,
  serieDepenses,
  type ProgrammeCalcul,
} from '@/lib/calcul/bilan';
import { ajouterJours } from '@/lib/calcul/dates';
import type { ApportJournalier, PeseeLissee, ProfilCalcul } from '@/lib/calcul/types';

/**
 * Scénario de référence, entièrement calculable à la main — c'est
 * l'exigence du §15.3 de la spec, et le critère d'acceptation qui veut
 * qu'un déficit cumulé se recalcule au crayon depuis l'export.
 *
 * Homme, 35 ans au 1er mars 2026 (né le 15 juin 1990, anniversaire non
 * encore passé), 180 cm, 80 kg, niveau modéré.
 *
 *   métabolisme de base = 10×80 + 6,25×180 − 5×35 + 5 = 1 755 kcal
 *   dépense estimée     = 1 755 × 1,55            = 2 720,25 kcal
 *   déficit quotidien   = 2 720,25 − 2 000        =   720,25 kcal
 */
const PROFIL: ProfilCalcul = {
  sexe: 'h',
  dateNaissance: '1990-06-15',
  tailleCm: 180,
  niveauActivite: 'modere',
};

const PROGRAMME: ProgrammeCalcul = {
  dateDebut: '2026-03-01',
  poidsDepartKg: 80,
  poidsCibleKg: 75,
  modeJoursManquants: 'neutre',
};

const DEPENSE_ESTIMEE = 2720.25;
const DEFICIT_QUOTIDIEN = 720.25;

function apportsConstants(nombreJours: number, apportKcal: number): ApportJournalier[] {
  return Array.from({ length: nombreJours }, (_, i) => ({
    date: ajouterJours('2026-03-01', i),
    apportKcal,
  }));
}

function pesee(date: string, moyenneMobile7jKg: number, aberrante = false): PeseeLissee {
  return { date, poidsKg: moyenneMobile7jKg, moyenneMobile7jKg, aberrante };
}

describe('calculerBilan — scénario de référence', () => {
  const bilan = calculerBilan({
    date: '2026-03-05',
    profil: PROFIL,
    programme: PROGRAMME,
    apports: apportsConstants(5, 2000),
    pesees: [],
  });

  it('retient la dépense estimée tant que le réel n’est pas calculable', () => {
    expect(bilan.depenseRetenueKcal).toBeCloseTo(DEPENSE_ESTIMEE, 10);
    expect(bilan.depenseReelleKcal).toBeNull();
    expect(bilan.depenseIssueDuReel).toBe(false);
  });

  it('cumule le déficit sur les cinq jours', () => {
    // 5 × 720,25 = 3 601,25 kcal
    expect(bilan.deficitCumulKcal).toBeCloseTo(5 * DEFICIT_QUOTIDIEN, 8);
    expect(bilan.deficitCumulKcal).toBeCloseTo(3601.25, 8);
  });

  it('convertit en kilos théoriques au coefficient de 7 700', () => {
    expect(bilan.kgTheoriques).toBeCloseTo(3601.25 / 7700, 10);
    expect(bilan.kgTheoriques).toBeCloseTo(0.46769, 5);
  });

  it('n’invente pas de kilos réels sans pesée', () => {
    expect(bilan.kgReels).toBeNull();
    expect(bilan.ecartKg).toBeNull();
  });

  it('rend une complétude de 100 % sur cinq jours tous saisis', () => {
    expect(bilan.completude.taux).toBe(1);
    expect(bilan.completude.joursRenseignes).toBe(5);
    expect(bilan.completude.joursTotal).toBe(5);
  });

  it('masque la projection faute de données suffisantes', () => {
    expect(bilan.projection.affichable).toBe(false);
    expect(bilan.projection.raisonMasquee).toBe('donnees_insuffisantes');
  });

  it('expose la fiabilité même quand la dépense réelle est indisponible', () => {
    expect(bilan.fiabilite).toBeCloseTo(5 / 28, 10);
    expect(bilan.allureKgSemaine).toBeNull();
  });

  it('rend le détail jour par jour', () => {
    expect(bilan.journees).toHaveLength(5);
    expect(bilan.journees[0]?.date).toBe('2026-03-01');
    expect(bilan.journees[4]?.date).toBe('2026-03-05');
    expect(bilan.journees[0]?.deficitKcal).toBeCloseTo(DEFICIT_QUOTIDIEN, 10);
  });
});

describe('calculerBilan — confrontation théorie / réalité', () => {
  // 28 jours à 2 000 kcal, moyenne mobile de 80,0 à 79,0 kg.
  const bilan = calculerBilan({
    date: '2026-03-28',
    profil: PROFIL,
    programme: PROGRAMME,
    apports: apportsConstants(28, 2000),
    pesees: [pesee('2026-03-01', 80), pesee('2026-03-15', 79.5), pesee('2026-03-28', 79)],
  });

  it('bascule sur la dépense réelle une fois la fiabilité atteinte', () => {
    expect(bilan.fiabilite).toBe(1);
    expect(bilan.depenseIssueDuReel).toBe(true);
    // 2000 + 1 kg × 7700 / 27 jours = 2 285,19 kcal/j
    expect(bilan.depenseReelleKcal).toBeCloseTo(2000 + 7700 / 27, 6);
  });

  it('mesure les kilos réellement perdus', () => {
    expect(bilan.kgReels).toBeCloseTo(1, 10);
  });

  it('expose l’écart entre théorie et réalité — c’est le produit', () => {
    expect(bilan.ecartKg).toBeCloseTo(bilan.kgTheoriques - 1, 10);
    // La théorie prévoyait davantage que la balance n'en montre : la
    // dépense réelle est inférieure à l'estimation Mifflin-St Jeor.
    expect(bilan.ecartKg as number).toBeGreaterThan(0);
  });

  it('calcule l’allure hebdomadaire observée', () => {
    // 1 kg en 27 jours ≈ 0,259 kg/semaine
    expect(bilan.allureKgSemaine).toBeCloseTo((-1 / 27) * 7, 10);
  });

  it('affiche une projection une fois les 21 jours atteints', () => {
    expect(bilan.projection.affichable).toBe(true);
    expect(bilan.projection.dateMediane).not.toBeNull();
  });
});

describe('calculerBilan — cas particuliers', () => {
  it('applique le mode de jours manquants du programme', () => {
    const apports: ApportJournalier[] = [
      { date: '2026-03-01', apportKcal: 2000 },
      { date: '2026-03-03', apportKcal: 2000 },
    ];

    const neutre = calculerBilan({
      date: '2026-03-03',
      profil: PROFIL,
      programme: PROGRAMME,
      apports,
      pesees: [],
    });

    const estime = calculerBilan({
      date: '2026-03-03',
      profil: PROFIL,
      programme: { ...PROGRAMME, modeJoursManquants: 'estime' },
      apports,
      pesees: [],
    });

    expect(neutre.completude.joursRenseignes).toBe(2);
    expect(neutre.completude.taux).toBeCloseTo(2 / 3, 10);
    expect(neutre.deficitCumulKcal).toBeCloseTo(2 * DEFICIT_QUOTIDIEN, 8);

    // Le mode estimé comble le 2 mars : le cumul augmente, la
    // complétude reste identique. C'est exactement ce qu'il faut
    // montrer à l'utilisateur.
    expect(estime.deficitCumulKcal).toBeCloseTo(3 * DEFICIT_QUOTIDIEN, 8);
    expect(estime.completude.joursRenseignes).toBe(2);
    expect(estime.completude.joursEstimes).toBe(1);
  });

  it('masque la projection quand aucun poids cible n’est fixé', () => {
    const bilan = calculerBilan({
      date: '2026-03-28',
      profil: PROFIL,
      programme: { ...PROGRAMME, poidsCibleKg: null },
      apports: apportsConstants(28, 2000),
      pesees: [pesee('2026-03-01', 80), pesee('2026-03-28', 79)],
    });

    expect(bilan.projection.affichable).toBe(false);
    expect(bilan.projection.raisonMasquee).toBe('donnees_insuffisantes');
    expect(bilan.projection.dateMediane).toBeNull();
  });

  it('ignore les pesées aberrantes dans les kilos réels', () => {
    const bilan = calculerBilan({
      date: '2026-03-05',
      profil: PROFIL,
      programme: PROGRAMME,
      apports: apportsConstants(5, 2000),
      pesees: [pesee('2026-03-04', 74, true)],
    });

    expect(bilan.kgReels).toBeNull();
  });

  it('rend un bilan vide pour une date antérieure au programme', () => {
    const bilan = calculerBilan({
      date: '2026-02-01',
      profil: PROFIL,
      programme: PROGRAMME,
      apports: [],
      pesees: [],
    });

    expect(bilan.journees).toHaveLength(0);
    expect(bilan.deficitCumulKcal).toBe(0);
    expect(bilan.depenseRetenueKcal).toBe(0);
    expect(bilan.depenseReelleKcal).toBeNull();
    expect(bilan.depenseIssueDuReel).toBe(false);
    expect(bilan.fiabilite).toBe(0);
    expect(bilan.completude.taux).toBe(0);
  });

  it('traite un programme d’un seul jour', () => {
    const bilan = calculerBilan({
      date: '2026-03-01',
      profil: PROFIL,
      programme: PROGRAMME,
      apports: apportsConstants(1, 2000),
      pesees: [],
    });

    expect(bilan.journees).toHaveLength(1);
    expect(bilan.deficitCumulKcal).toBeCloseTo(DEFICIT_QUOTIDIEN, 10);
  });

  it('fait vieillir l’utilisateur au fil du programme', () => {
    // Programme à cheval sur le 15 juin : la dépense doit baisser de
    // 5 kcal le jour de l'anniversaire, pas rester figée.
    const bilan = calculerBilan({
      date: '2026-06-16',
      profil: PROFIL,
      programme: { ...PROGRAMME, dateDebut: '2026-06-14' },
      apports: [
        { date: '2026-06-14', apportKcal: 2000 },
        { date: '2026-06-15', apportKcal: 2000 },
        { date: '2026-06-16', apportKcal: 2000 },
      ],
      pesees: [],
    });

    const veille = bilan.journees[0]?.depenseRetenueKcal as number;
    const anniversaire = bilan.journees[1]?.depenseRetenueKcal as number;

    // 5 kcal de métabolisme de base × 1,55 de facteur d'activité
    expect(veille - anniversaire).toBeCloseTo(5 * 1.55, 8);
  });
});

describe('serieDepenses', () => {
  it('produit une dépense par jour du programme', () => {
    const serie = serieDepenses({
      dateFin: '2026-03-05',
      profil: PROFIL,
      programme: PROGRAMME,
      apports: apportsConstants(5, 2000),
      pesees: [],
    });

    expect(serie.size).toBe(5);
    expect(serie.get('2026-03-01')?.depenseRetenueKcal).toBeCloseTo(DEPENSE_ESTIMEE, 10);
    expect(serie.get('2026-03-05')?.issueDuReel).toBe(false);
  });

  it('rend une série vide quand la date précède le début du programme', () => {
    const serie = serieDepenses({
      dateFin: '2026-02-01',
      profil: PROFIL,
      programme: PROGRAMME,
      apports: [],
      pesees: [],
    });

    expect(serie.size).toBe(0);
  });
});

describe('calculerInstantanes — recalcul incrémental', () => {
  const APPORTS = apportsConstants(28, 2000);
  const PESEES = [
    pesee('2026-03-01', 80),
    pesee('2026-03-15', 79.5),
    pesee('2026-03-28', 79),
  ];

  it('ne réécrit que la plage demandée, pas tout l’historique', () => {
    const instantanes = calculerInstantanes({
      dateDebut: '2026-03-20',
      dateFin: '2026-03-28',
      profil: PROFIL,
      programme: PROGRAMME,
      apports: APPORTS,
      pesees: PESEES,
    });

    expect(instantanes).toHaveLength(9);
    expect(instantanes[0]?.date).toBe('2026-03-20');
    expect(instantanes[8]?.date).toBe('2026-03-28');
  });

  it('donne exactement le même résultat que calculerBilan, jour par jour', () => {
    // L'invariant qui compte : la voie rapide du recalcul et la voie
    // directe de l'affichage ne doivent jamais diverger, sinon
    // l'utilisateur voit un chiffre et la base en stocke un autre.
    const instantanes = calculerInstantanes({
      dateDebut: '2026-03-01',
      dateFin: '2026-03-28',
      profil: PROFIL,
      programme: PROGRAMME,
      apports: APPORTS,
      pesees: PESEES,
    });

    for (const instantane of instantanes) {
      const bilan = calculerBilan({
        date: instantane.date,
        profil: PROFIL,
        programme: PROGRAMME,
        apports: APPORTS,
        pesees: PESEES,
      });

      const { journees: _ignore, ...attendu } = bilan;
      expect(instantane, `divergence au ${instantane.date}`).toEqual(attendu);
    }
  });

  it('cumule depuis le début du programme même en ne réécrivant que la fin', () => {
    // Le déficit est un capital : réécrire les neuf derniers jours ne
    // remet pas le compteur à zéro au 20 mars.
    const partiel = calculerInstantanes({
      dateDebut: '2026-03-28',
      dateFin: '2026-03-28',
      profil: PROFIL,
      programme: PROGRAMME,
      apports: APPORTS,
      pesees: PESEES,
    });

    const complet = calculerInstantanes({
      dateDebut: '2026-03-01',
      dateFin: '2026-03-28',
      profil: PROFIL,
      programme: PROGRAMME,
      apports: APPORTS,
      pesees: PESEES,
    });

    expect(partiel).toHaveLength(1);
    expect(partiel[0]).toEqual(complet[27]);
    expect(partiel[0]?.completude.joursTotal).toBe(28);
  });

  it('ne remonte jamais avant le début du programme', () => {
    const instantanes = calculerInstantanes({
      dateDebut: '2026-01-01',
      dateFin: '2026-03-05',
      profil: PROFIL,
      programme: PROGRAMME,
      apports: apportsConstants(5, 2000),
      pesees: [],
    });

    expect(instantanes[0]?.date).toBe('2026-03-01');
    expect(instantanes).toHaveLength(5);
  });

  it('est idempotent', () => {
    const parametres = {
      dateDebut: '2026-03-20',
      dateFin: '2026-03-28',
      profil: PROFIL,
      programme: PROGRAMME,
      apports: APPORTS,
      pesees: PESEES,
    };

    expect(calculerInstantanes(parametres)).toEqual(calculerInstantanes(parametres));
  });

  it('fait croître le cumul de jour en jour', () => {
    const instantanes = calculerInstantanes({
      dateDebut: '2026-03-01',
      dateFin: '2026-03-05',
      profil: PROFIL,
      programme: PROGRAMME,
      apports: apportsConstants(5, 2000),
      pesees: [],
    });

    const cumuls = instantanes.map((i) => i.deficitCumulKcal);
    expect(cumuls).toEqual([...cumuls].sort((a, b) => a - b));
    expect(cumuls[4]).toBeCloseTo(5 * DEFICIT_QUOTIDIEN, 8);
  });

  it('reste rapide sur un recalcul de trois semaines dans un programme d’un an', () => {
    // Critère d'acceptation §14 : moins de 2 secondes. Le test vise
    // large — il attrape une régression quadratique, pas une
    // milliseconde de trop.
    const apportsAn = Array.from({ length: 365 }, (_, i) => ({
      date: ajouterJours('2026-03-01', i),
      apportKcal: 2000,
    }));
    const peseesAn = Array.from({ length: 52 }, (_, i) =>
      pesee(ajouterJours('2026-03-01', i * 7), 80 - i * 0.1),
    );

    const debut = performance.now();
    const instantanes = calculerInstantanes({
      dateDebut: ajouterJours('2026-03-01', 343),
      dateFin: ajouterJours('2026-03-01', 364),
      profil: PROFIL,
      programme: PROGRAMME,
      apports: apportsAn,
      pesees: peseesAn,
    });
    const duree = performance.now() - debut;

    expect(instantanes).toHaveLength(22);
    expect(duree).toBeLessThan(2000);
  });

  it('rend une liste vide quand la plage précède le programme', () => {
    expect(
      calculerInstantanes({
        dateDebut: '2026-01-01',
        dateFin: '2026-02-01',
        profil: PROFIL,
        programme: PROGRAMME,
        apports: [],
        pesees: [],
      }),
    ).toEqual([]);
  });
});

describe('interpreterEcart', () => {
  it('traduit l’écart en kcal par jour et corrige la dépense', () => {
    const lecture = interpreterEcart({
      ecartKg: 0.5,
      joursProgramme: 30,
      depenseRetenueMoyenneKcal: 2500,
    });

    // 0,5 × 7700 / 30 = 128,33 kcal/j de trop dans l'estimation
    expect(lecture?.ecartKcalParJour).toBeCloseTo(128.333, 3);
    expect(lecture?.depenseCorrigeeKcal).toBeCloseTo(2371.667, 3);
  });

  it('corrige à la hausse quand la perte dépasse la théorie', () => {
    const lecture = interpreterEcart({
      ecartKg: -0.5,
      joursProgramme: 30,
      depenseRetenueMoyenneKcal: 2500,
    });

    expect(lecture?.depenseCorrigeeKcal).toBeCloseTo(2628.333, 3);
  });

  it('ne conclut rien sans kilos réels ni sans durée', () => {
    expect(
      interpreterEcart({
        ecartKg: null,
        joursProgramme: 30,
        depenseRetenueMoyenneKcal: 2500,
      }),
    ).toBeNull();

    expect(
      interpreterEcart({
        ecartKg: 0.5,
        joursProgramme: 0,
        depenseRetenueMoyenneKcal: 2500,
      }),
    ).toBeNull();
  });
});

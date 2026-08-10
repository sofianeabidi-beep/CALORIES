import { FENETRE_PROJECTION_JOURS, KCAL_PAR_KG } from './constantes';
import { calculerCompletude, type Completude } from './completude';
import { cumulerDeficit, resoudreJournees } from './deficit';
import { depenseEstimee, depenseReelle, depenseRetenue } from './depense';
import { calculerAge, differenceJours, plageDates } from './dates';
import { poidsALaDate, tendancePoids } from './poids';
import { projeterAtteinteObjectif, type Projection } from './projection';
import type {
  ApportJournalier,
  DateIso,
  JourneeCalculee,
  ModeJoursManquants,
  PeseeLissee,
  ProfilCalcul,
} from './types';

export interface ProgrammeCalcul {
  readonly dateDebut: DateIso;
  readonly poidsDepartKg: number;
  readonly poidsCibleKg: number | null;
  readonly modeJoursManquants: ModeJoursManquants;
}

export interface Bilan {
  readonly date: DateIso;

  /** 1. Le capital accumulé depuis le début du **programme**. */
  readonly deficitCumulKcal: number;
  /** 2. Sa conversion en kilos, au coefficient approximatif de 7 700. */
  readonly kgTheoriques: number;
  /** 3. Les kilos réellement mesurés, et l'écart : c'est le produit. */
  readonly kgReels: number | null;
  readonly ecartKg: number | null;
  /** 4. Ce qui conditionne la validité des trois précédents. */
  readonly completude: Completude;

  readonly depenseReelleKcal: number | null;
  readonly depenseRetenueKcal: number;
  readonly fiabilite: number;
  /** Vrai quand la dépense réelle a remplacé l'estimation. */
  readonly depenseIssueDuReel: boolean;

  readonly allureKgSemaine: number | null;
  readonly projection: Projection;

  readonly journees: readonly JourneeCalculee[];
}

/**
 * Les quatre indicateurs du produit, pour une date donnée (spec §1).
 *
 * Orchestrateur : il ne contient aucune formule propre, il enchaîne les
 * modules dans l'ordre où ils dépendent les uns des autres.
 *
 * La dépense est recalculée **jour par jour** et non une fois pour
 * toutes : elle dépend du poids du moment, du basculement vers le réel,
 * et du lissage à 5 % qui la relie à la veille. Recalculer un déficit
 * cumulé avec la dépense d'aujourd'hui appliquée à un déficit d'il y a
 * quatre mois donnerait un chiffre faux.
 *
 * Le résultat alimente `instantane_calcul` — un enregistrement par jour,
 * qui sert autant à l'affichage en une requête qu'à garder trace de ce
 * qui a été montré à l'utilisateur.
 */
/** Dépense d'une journée, avec ce qu'il faut pour l'expliquer à l'utilisateur. */
export interface DepenseDuJour {
  readonly depenseRetenueKcal: number;
  readonly depenseReelleKcal: number | null;
  readonly fiabilite: number;
  readonly issueDuReel: boolean;
}

/**
 * Série des dépenses retenues, jour après jour, du début du programme à
 * la date demandée.
 *
 * Séparée du reste parce qu'elle est **séquentielle** : le lissage à 5 %
 * relie chaque jour au précédent, on ne peut pas calculer le 12 mars
 * sans avoir calculé le 11. Tout le reste du bilan se dérive ensuite de
 * cette série en un seul passage.
 */
export function serieDepenses(entree: {
  dateFin: DateIso;
  profil: ProfilCalcul;
  programme: ProgrammeCalcul;
  apports: readonly ApportJournalier[];
  pesees: readonly PeseeLissee[];
}): Map<DateIso, DepenseDuJour> {
  const { profil, programme } = entree;
  const serie = new Map<DateIso, DepenseDuJour>();
  let veille: number | null = null;

  for (const jour of plageDates(programme.dateDebut, entree.dateFin)) {
    const poidsKg = poidsALaDate({
      pesees: entree.pesees,
      date: jour,
      poidsDefautKg: programme.poidsDepartKg,
    });

    const estimee = depenseEstimee({
      sexe: profil.sexe,
      poidsKg,
      tailleCm: profil.tailleCm,
      ageAns: calculerAge(profil.dateNaissance, jour),
      niveauActivite: profil.niveauActivite,
    });

    const reelle = depenseReelle({
      dateFin: jour,
      apports: entree.apports,
      pesees: entree.pesees,
    });

    const retenue = depenseRetenue({
      depenseEstimeeKcal: estimee,
      depenseReelleKcal: reelle.depenseReelleKcal,
      fiabilite: reelle.fiabilite,
      depenseRetenueVeilleKcal: veille,
    });

    serie.set(jour, {
      depenseRetenueKcal: retenue.depenseRetenueKcal,
      depenseReelleKcal: reelle.depenseReelleKcal,
      fiabilite: reelle.fiabilite,
      issueDuReel: retenue.issueDuReel,
    });
    veille = retenue.depenseRetenueKcal;
  }

  return serie;
}

/** Retenue nulle : une date hors du programme n'a pas de dépense. */
const DEPENSE_ABSENTE: DepenseDuJour = {
  depenseRetenueKcal: 0,
  depenseReelleKcal: null,
  fiabilite: 0,
  issueDuReel: false,
};

function depenseDu(serie: Map<DateIso, DepenseDuJour>, date: DateIso): DepenseDuJour {
  return serie.get(date) ?? DEPENSE_ABSENTE;
}

/** Sans poids cible, il n'y a rien à projeter — et rien à inventer. */
const PROJECTION_SANS_CIBLE: Projection = {
  affichable: false,
  raisonMasquee: 'donnees_insuffisantes',
  rythmeKgParSemaine: null,
  dateOptimiste: null,
  dateMediane: null,
  datePrudente: null,
};

function projeter(entree: {
  date: DateIso;
  poidsActuelKg: number;
  poidsCibleKg: number | null;
  rythmeKgParSemaine: number | null;
  joursDonnees: number;
}): Projection {
  if (entree.poidsCibleKg === null) return PROJECTION_SANS_CIBLE;

  return projeterAtteinteObjectif({
    dateReference: entree.date,
    poidsActuelKg: entree.poidsActuelKg,
    poidsCibleKg: entree.poidsCibleKg,
    rythmeKgParSemaine: entree.rythmeKgParSemaine,
    joursDonnees: entree.joursDonnees,
  });
}

export function calculerBilan(entree: {
  date: DateIso;
  profil: ProfilCalcul;
  programme: ProgrammeCalcul;
  apports: readonly ApportJournalier[];
  pesees: readonly PeseeLissee[];
}): Bilan {
  const { date, programme } = entree;

  const depenses = serieDepenses({ ...entree, dateFin: date });
  const duJour = depenseDu(depenses, date);

  const journees = resoudreJournees({
    dateDebut: programme.dateDebut,
    dateFin: date,
    apports: entree.apports,
    mode: programme.modeJoursManquants,
    depenseRetenuePourDate: (jour) => depenseDu(depenses, jour).depenseRetenueKcal,
  });

  const cumul = cumulerDeficit(journees);
  const completude = calculerCompletude(journees);

  // Positif quand le poids a baissé, comme `kgTheoriques` est positif en
  // déficit : les deux chiffres doivent être comparables sans effort.
  const poidsActuelKg = poidsALaDate({
    pesees: entree.pesees,
    date,
    poidsDefautKg: programme.poidsDepartKg,
  });
  const aDesPesees = entree.pesees.some((p) => !p.aberrante && p.moyenneMobile7jKg !== null);
  const kgReels = aDesPesees ? programme.poidsDepartKg - poidsActuelKg : null;

  const tendance = tendancePoids({
    pesees: entree.pesees,
    dateFin: date,
    joursFenetre: FENETRE_PROJECTION_JOURS,
  });

  return {
    date,
    deficitCumulKcal: cumul.deficitCumuleKcal,
    kgTheoriques: cumul.kgTheoriques,
    kgReels,
    ecartKg: kgReels === null ? null : cumul.kgTheoriques - kgReels,
    completude,
    depenseReelleKcal: duJour.depenseReelleKcal,
    depenseRetenueKcal: duJour.depenseRetenueKcal,
    fiabilite: duJour.fiabilite,
    depenseIssueDuReel: duJour.issueDuReel,
    allureKgSemaine: tendance?.kgParSemaine ?? null,
    projection: projeter({
      date,
      poidsActuelKg,
      poidsCibleKg: programme.poidsCibleKg,
      rythmeKgParSemaine: tendance?.kgParSemaine ?? null,
      joursDonnees: completude.joursRenseignes,
    }),
    journees,
  };
}

/** Instantané d'un jour, sans le détail des journées. Alimente `instantane_calcul`. */
export type Instantane = Omit<Bilan, 'journees'>;

/**
 * Instantanés d'une plage de dates, en **un seul passage** (spec §6.8).
 *
 * Modifier une entrée du 3 mars invalide tous les cumuls postérieurs :
 * il faut réécrire un instantané par jour de la date impactée à
 * aujourd'hui. Appeler `calculerBilan` pour chacun de ces jours
 * recalculerait le programme entier à chaque fois — quadratique, et le
 * critère d'acceptation exige moins de 2 secondes.
 *
 * Ici la série de dépenses et la résolution des journées sont calculées
 * une fois pour tout le programme, puis le cumul se déroule
 * linéairement. Jamais tout l'historique n'est réécrit : seule la plage
 * demandée ressort.
 *
 * L'opération est idempotente — rejouer le même recalcul produit les
 * mêmes lignes.
 */
export function calculerInstantanes(entree: {
  /** Première date à réécrire : celle de l'entrée modifiée. */
  dateDebut: DateIso;
  /** Dernière date à réécrire : aujourd'hui. */
  dateFin: DateIso;
  profil: ProfilCalcul;
  programme: ProgrammeCalcul;
  apports: readonly ApportJournalier[];
  pesees: readonly PeseeLissee[];
}): Instantane[] {
  const { programme } = entree;

  // Le cumul part toujours du début du programme, même si l'on ne
  // réécrit qu'une poignée de jours : c'est un capital, pas un solde.
  const depenses = serieDepenses({ ...entree, dateFin: entree.dateFin });

  const journees = resoudreJournees({
    dateDebut: programme.dateDebut,
    dateFin: entree.dateFin,
    apports: entree.apports,
    mode: programme.modeJoursManquants,
    depenseRetenuePourDate: (jour) => depenseDu(depenses, jour).depenseRetenueKcal,
  });

  const aDesPesees = entree.pesees.some(
    (p) => !p.aberrante && p.moyenneMobile7jKg !== null,
  );

  const instantanes: Instantane[] = [];
  const cumulees: JourneeCalculee[] = [];
  // Date la plus ancienne réellement réécrite : jamais avant le début du
  // programme, quoi que demande l'appelant.
  const premiere =
    differenceJours(programme.dateDebut, entree.dateDebut) > 0
      ? entree.dateDebut
      : programme.dateDebut;

  for (const journee of journees) {
    cumulees.push(journee);

    if (differenceJours(premiere, journee.date) < 0) continue;

    const date = journee.date;
    const cumul = cumulerDeficit(cumulees);
    const completude = calculerCompletude(cumulees);

    const poidsActuelKg = poidsALaDate({
      pesees: entree.pesees,
      date,
      poidsDefautKg: programme.poidsDepartKg,
    });
    const kgReels = aDesPesees ? programme.poidsDepartKg - poidsActuelKg : null;

    const tendance = tendancePoids({
      pesees: entree.pesees,
      dateFin: date,
      joursFenetre: FENETRE_PROJECTION_JOURS,
    });

    const duJour = depenseDu(depenses, date);

    instantanes.push({
      date,
      deficitCumulKcal: cumul.deficitCumuleKcal,
      kgTheoriques: cumul.kgTheoriques,
      kgReels,
      ecartKg: kgReels === null ? null : cumul.kgTheoriques - kgReels,
      completude,
      depenseReelleKcal: duJour.depenseReelleKcal,
      depenseRetenueKcal: duJour.depenseRetenueKcal,
      fiabilite: duJour.fiabilite,
      depenseIssueDuReel: duJour.issueDuReel,
      allureKgSemaine: tendance?.kgParSemaine ?? null,
      projection: projeter({
        date,
        poidsActuelKg,
        poidsCibleKg: programme.poidsCibleKg,
        rythmeKgParSemaine: tendance?.kgParSemaine ?? null,
        joursDonnees: completude.joursRenseignes,
      }),
    });
  }

  return instantanes;
}

/**
 * Dépense énergétique déduite de l'écart théorie/réel sur l'ensemble du
 * programme. C'est la lecture « d'où vient l'écart » que le §1 de la
 * spec désigne comme le produit lui-même.
 *
 * Un écart positif signifie que la théorie prévoyait plus de perte que
 * la balance n'en montre : la dépense réelle est **inférieure** à celle
 * retenue. Ce n'est ni une erreur de l'utilisateur ni un échec — c'est
 * l'information la plus utile du système.
 */
export function interpreterEcart(entree: {
  ecartKg: number | null;
  joursProgramme: number;
  depenseRetenueMoyenneKcal: number;
}): { ecartKcalParJour: number; depenseCorrigeeKcal: number } | null {
  if (entree.ecartKg === null || entree.joursProgramme <= 0) return null;

  const ecartKcalParJour = (entree.ecartKg * KCAL_PAR_KG) / entree.joursProgramme;

  return {
    ecartKcalParJour,
    depenseCorrigeeKcal: entree.depenseRetenueMoyenneKcal - ecartKcalParJour,
  };
}

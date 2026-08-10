import { FENETRE_PROJECTION_JOURS, KCAL_PAR_KG } from './constantes';
import { calculerCompletude, type Completude } from './completude';
import { cumulerDeficit, resoudreJournees } from './deficit';
import { depenseEstimee, depenseReelle, depenseRetenue } from './depense';
import { calculerAge, plageDates } from './dates';
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
export function calculerBilan(entree: {
  date: DateIso;
  profil: ProfilCalcul;
  programme: ProgrammeCalcul;
  apports: readonly ApportJournalier[];
  pesees: readonly PeseeLissee[];
}): Bilan {
  const { date, profil, programme } = entree;

  const depensesParDate = new Map<DateIso, number>();
  let veille: number | null = null;
  let derniereFiabilite = 0;
  let derniereDepenseReelle: number | null = null;
  let dernierIssuDuReel = false;
  let derniereRetenue = 0;

  for (const jour of plageDates(programme.dateDebut, date)) {
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

    depensesParDate.set(jour, retenue.depenseRetenueKcal);
    veille = retenue.depenseRetenueKcal;
    derniereFiabilite = reelle.fiabilite;
    derniereDepenseReelle = reelle.depenseReelleKcal;
    dernierIssuDuReel = retenue.issueDuReel;
    derniereRetenue = retenue.depenseRetenueKcal;
  }

  const journees = resoudreJournees({
    dateDebut: programme.dateDebut,
    dateFin: date,
    apports: entree.apports,
    mode: programme.modeJoursManquants,
    depenseRetenuePourDate: (jour) => {
      const valeur = depensesParDate.get(jour);
      /* c8 ignore next 2 -- la même plage vient d'être parcourue ci-dessus */
      if (valeur === undefined) return 0;
      return valeur;
    },
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

  const projection =
    programme.poidsCibleKg === null
      ? {
          affichable: false,
          raisonMasquee: 'donnees_insuffisantes' as const,
          rythmeKgParSemaine: null,
          dateOptimiste: null,
          dateMediane: null,
          datePrudente: null,
        }
      : projeterAtteinteObjectif({
          dateReference: date,
          poidsActuelKg,
          poidsCibleKg: programme.poidsCibleKg,
          rythmeKgParSemaine: tendance?.kgParSemaine ?? null,
          joursDonnees: completude.joursRenseignes,
        });

  return {
    date,
    deficitCumulKcal: cumul.deficitCumuleKcal,
    kgTheoriques: cumul.kgTheoriques,
    kgReels,
    ecartKg: kgReels === null ? null : cumul.kgTheoriques - kgReels,
    completude,
    depenseReelleKcal: derniereDepenseReelle,
    depenseRetenueKcal: derniereRetenue,
    fiabilite: derniereFiabilite,
    depenseIssueDuReel: dernierIssuDuReel,
    allureKgSemaine: tendance?.kgParSemaine ?? null,
    projection,
    journees,
  };
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

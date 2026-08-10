import { FENETRE_ESTIMATION_JOUR_MANQUANT, KCAL_PAR_KG } from './constantes';
import { plageDates } from './dates';
import type {
  ApportJournalier,
  DateIso,
  JourneeCalculee,
  ModeJoursManquants,
} from './types';

/**
 * Déficit d'une journée.
 *
 * ```
 * deficit = depense_retenue − apport_enregistre
 * ```
 *
 * **`activite_kcal` n'entre pas dans ce calcul**, contrairement à la
 * lettre de la spec §6.4. Écart assumé et documenté dans `CLAUDE.md` :
 * la dépense réelle recalculée (§6.3) contient déjà toute l'activité par
 * construction, puisqu'elle se déduit de la variation de poids observée.
 * L'ajouter par-dessus la compterait deux fois dès le basculement vers
 * le réel, et l'ajouter seulement avant ce basculement créerait le saut
 * d'indicateur que le lissage à 5 % existe pour éviter.
 *
 * Positif en déficit, négatif en surplus. Ce n'est pas un jugement :
 * c'est une direction (spec §10).
 */
export function deficitJour(entree: {
  depenseRetenueKcal: number;
  apportKcal: number;
}): number {
  return entree.depenseRetenueKcal - entree.apportKcal;
}

/**
 * Apport estimé pour un jour manquant en mode `estime` : moyenne des
 * 7 derniers jours **effectivement renseignés**, pas des 7 derniers jours
 * calendaires. Renvoie `null` si aucun jour renseigné ne précède.
 */
export function estimerApportManquant(
  apportsAnterieurs: readonly ApportJournalier[],
): number | null {
  const renseignes = apportsAnterieurs
    .filter((a) => a.apportKcal !== null)
    .slice(-FENETRE_ESTIMATION_JOUR_MANQUANT);
  if (renseignes.length === 0) return null;
  return (
    renseignes.reduce((somme, a) => somme + (a.apportKcal as number), 0) / renseignes.length
  );
}

/**
 * Résout chaque jour d'une plage selon le mode de jours manquants
 * (spec §6.5). C'est le point qui casse tous les compteurs cumulés des
 * applications concurrentes.
 *
 * - `neutre` *(défaut)* : le jour est **exclu** du cumul et compté comme
 *   non renseigné. Le cumul reste juste, la complétude baisse.
 * - `estime` : le jour prend la moyenne des 7 derniers jours renseignés
 *   et est marqué `estime`. Le cumul reste continu, au prix d'une
 *   hypothèse que l'utilisateur doit pouvoir voir.
 * - `strict` : déficit nul, l'apport est réputé égal à la dépense.
 *
 * `depenseRetenuePourDate` est fourni par l'appelant : la dépense évolue
 * dans le temps (basculement vers le réel, lissage), le moteur ne la
 * devine pas.
 */
export function resoudreJournees(entree: {
  dateDebut: DateIso;
  dateFin: DateIso;
  apports: readonly ApportJournalier[];
  mode: ModeJoursManquants;
  depenseRetenuePourDate: (date: DateIso) => number;
}): JourneeCalculee[] {
  const parDate = new Map<DateIso, number | null>();
  for (const apport of entree.apports) {
    parDate.set(apport.date, apport.apportKcal);
  }

  const historique: ApportJournalier[] = [];
  const journees: JourneeCalculee[] = [];

  for (const date of plageDates(entree.dateDebut, entree.dateFin)) {
    const apportKcal = parDate.get(date) ?? null;
    const depenseRetenueKcal = entree.depenseRetenuePourDate(date);

    if (apportKcal !== null) {
      historique.push({ date, apportKcal });
      journees.push({
        date,
        statut: 'renseigne',
        apportRetenuKcal: apportKcal,
        depenseRetenueKcal,
        deficitKcal: deficitJour({ depenseRetenueKcal, apportKcal }),
      });
      continue;
    }

    if (entree.mode === 'estime') {
      const estime = estimerApportManquant(historique);
      if (estime !== null) {
        journees.push({
          date,
          statut: 'estime',
          apportRetenuKcal: estime,
          depenseRetenueKcal,
          deficitKcal: deficitJour({ depenseRetenueKcal, apportKcal: estime }),
        });
        continue;
      }
      // Aucun jour renseigné ne précède : rien à estimer, on retombe
      // sur le comportement neutre plutôt que d'inventer un chiffre.
      journees.push({
        date,
        statut: 'manquant',
        apportRetenuKcal: null,
        depenseRetenueKcal,
        deficitKcal: null,
      });
      continue;
    }

    if (entree.mode === 'strict') {
      journees.push({
        date,
        statut: 'manquant',
        apportRetenuKcal: depenseRetenueKcal,
        depenseRetenueKcal,
        deficitKcal: 0,
      });
      continue;
    }

    journees.push({
      date,
      statut: 'manquant',
      apportRetenuKcal: null,
      depenseRetenueKcal,
      deficitKcal: null,
    });
  }

  return journees;
}

export interface CumulDeficit {
  readonly deficitCumuleKcal: number;
  readonly kgTheoriques: number;
  readonly joursCumules: number;
}

/**
 * Cumul du déficit sur une plage, et sa conversion en kilos (spec §6.4).
 *
 * ```
 * kg_theoriques = deficit_cumule / 7700
 * ```
 *
 * Le coefficient de 7 700 est une approximation, pas une constante
 * physique — l'interface doit le dire lisiblement, pas en note de bas de
 * page. Les jours à `deficitKcal === null` (mode neutre) sont exclus,
 * c'est tout l'intérêt du mode.
 *
 * **Ne jamais afficher ce résultat sans le taux de complétude.** Un
 * déficit cumulé calculé sur 40 % des jours ne vaut rien.
 */
export function cumulerDeficit(journees: readonly JourneeCalculee[]): CumulDeficit {
  const retenues = journees.filter((j) => j.deficitKcal !== null);
  const deficitCumuleKcal = retenues.reduce((somme, j) => somme + (j.deficitKcal as number), 0);

  return {
    deficitCumuleKcal,
    kgTheoriques: deficitCumuleKcal / KCAL_PAR_KG,
    joursCumules: retenues.length,
  };
}

/** Conversion d'un capital de calories en kilos théoriques. */
export function kcalVersKg(kcal: number): number {
  return kcal / KCAL_PAR_KG;
}

/** Conversion inverse, pour dériver un objectif à partir d'une allure visée. */
export function kgVersKcal(kg: number): number {
  return kg * KCAL_PAR_KG;
}

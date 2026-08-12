import 'server-only';

import {
  calculerBilan,
  calculerInstantanes,
  lisserPesees,
  type ApportJournalier,
  type DateIso,
  type PeseeLissee,
  type ProfilCalcul,
} from '@/lib/calcul';
import type { ProgrammeCalcul } from '@/lib/calcul';
import { creerClientServeur } from '@/lib/supabase/server';
import type { LigneEntree, LigneJournee, LignePesee, LigneProgramme } from '@/lib/supabase/types';

/**
 * Recalcul incrémental (spec §6.8).
 *
 * Modifier une entrée du 3 mars invalide tous les cumuls postérieurs.
 * On réécrit donc `journee` puis `instantane_calcul` **de la date
 * impactée jusqu'à aujourd'hui**, jamais tout l'historique.
 *
 * L'opération est idempotente : les écritures sont des `upsert` sur des
 * clés naturelles, rejouer le recalcul produit les mêmes lignes.
 *
 * **Limite connue.** La spec demande une transaction ; ces écritures
 * sont plusieurs allers-retours PostgREST, donc pas atomiques. Une
 * coupure au milieu laisse des instantanés partiellement à jour — sans
 * perte de données, puisque `journee` et `instantane_calcul` sont
 * dérivés et se reconstruisent au recalcul suivant. Le durcissement
 * consiste à basculer cette fonction en procédure Postgres appelée par
 * RPC ; à faire avant la mise en production, une fois qu'une base
 * existe pour la tester.
 */
export async function recalculerDepuis(entree: {
  dateImpactee: DateIso;
  aujourdhui: DateIso;
}): Promise<{ instantanesEcrits: number } | { erreur: string }> {
  const supabase = await creerClientServeur();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return { erreur: 'Session expirée.' };

  const { data: profilLigne } = await supabase
    .from('profil')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profilLigne === null) return { erreur: 'Profil incomplet.' };

  // Garanti par le trigger `verifier_gardefous_programme` : aucun
  // programme ne peut exister tant que la taille n'est pas renseignée.
  if (profilLigne.taille_cm === null) return { erreur: 'Taille manquante.' };

  const { data: programmeLigne } = await supabase
    .from('programme')
    .select('*')
    .eq('user_id', user.id)
    .eq('actif', true)
    .maybeSingle();

  if (programmeLigne === null) return { erreur: 'Aucun programme actif.' };

  const programmeActif = programmeLigne as LigneProgramme;

  const profil: ProfilCalcul = {
    sexe: profilLigne.sexe,
    dateNaissance: profilLigne.date_naissance,
    tailleCm: profilLigne.taille_cm,
    niveauActivite: profilLigne.niveau_activite,
  };

  const programme: ProgrammeCalcul = {
    dateDebut: programmeActif.date_debut,
    poidsDepartKg: Number(programmeActif.poids_depart_kg),
    poidsCibleKg:
      programmeActif.poids_cible_kg === null ? null : Number(programmeActif.poids_cible_kg),
    modeJoursManquants: profilLigne.mode_jours_manquants,
  };

  const [journeesExistantes, entrees, peseesBrutes] = await Promise.all([
    supabase
      .from('journee')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', programme.dateDebut)
      .lte('date', entree.aujourdhui),
    supabase.from('entree').select('*').eq('user_id', user.id).is('supprime_le', null),
    supabase
      .from('pesee')
      .select('*')
      .eq('user_id', user.id)
      .is('supprime_le', null)
      .order('date', { ascending: true }),
  ]);

  const journees = (journeesExistantes.data ?? []) as LigneJournee[];
  const lignesEntree = (entrees.data ?? []) as LigneEntree[];
  const lignesPesee = (peseesBrutes.data ?? []) as LignePesee[];

  const dateParJournee = new Map(journees.map((j) => [j.id, j.date]));

  // 1. Agrégats par journée. Ces colonnes sont dénormalisées à dessein :
  //    le tableau de bord doit s'afficher en une requête.
  const agregats = new Map<
    DateIso,
    { kcal: number; proteines: number; glucides: number; lipides: number }
  >();

  for (const ligne of lignesEntree) {
    const date = dateParJournee.get(ligne.journee_id);
    if (date === undefined) continue;

    const courant = agregats.get(date) ?? {
      kcal: 0,
      proteines: 0,
      glucides: 0,
      lipides: 0,
    };
    agregats.set(date, {
      kcal: courant.kcal + Number(ligne.kcal),
      proteines: courant.proteines + Number(ligne.proteines_g ?? 0),
      glucides: courant.glucides + Number(ligne.glucides_g ?? 0),
      lipides: courant.lipides + Number(ligne.lipides_g ?? 0),
    });
  }

  // 2. Moyenne mobile et détection d'aberration, recalculées sur toute
  //    la série : une pesée insérée rétroactivement change le lissage
  //    des jours suivants.
  const peseesLissees: PeseeLissee[] = lisserPesees(
    lignesPesee.map((p) => ({ date: p.date, poidsKg: Number(p.poids_kg) })),
  );

  const apports: ApportJournalier[] = journees.map((j) => {
    const agregat = agregats.get(j.date);
    return {
      date: j.date,
      // Une journée sans aucune entrée n'est pas un jour à zéro : c'est
      // un jour non renseigné. La distinction porte toute la complétude.
      apportKcal: agregat === undefined ? null : agregat.kcal,
    };
  });

  // 3. Le calcul, en un seul passage sur le programme.
  const instantanes = calculerInstantanes({
    dateDebut: entree.dateImpactee,
    dateFin: entree.aujourdhui,
    profil,
    programme,
    apports,
    pesees: peseesLissees,
  });

  // Le détail journalier vient de `calculerBilan` sur la dernière date :
  // il couvre tout le programme, on n'en garde que la plage réécrite.
  const detailParDate = new Map(
    calculerBilan({
      date: entree.aujourdhui,
      profil,
      programme,
      apports,
      pesees: peseesLissees,
    }).journees.map((j) => [j.date, j]),
  );

  const datesReecrites = new Set(instantanes.map((i) => i.date));
  const journeesExistantesParDate = new Set(journees.map((j) => j.date));

  const majJournees = [...datesReecrites]
    .filter((date) => journeesExistantesParDate.has(date))
    .map((date) => {
      const agregat = agregats.get(date);
      const detail = detailParDate.get(date);
      return {
        date,
        apport_kcal: agregat?.kcal ?? 0,
        proteines_g: agregat?.proteines ?? 0,
        glucides_g: agregat?.glucides ?? 0,
        lipides_g: agregat?.lipides ?? 0,
        depense_retenue_kcal: detail?.depenseRetenueKcal ?? 0,
        // `null` en mode neutre sur un jour manquant : le jour est exclu
        // du cumul, il n'a pas de déficit — et surtout pas un déficit nul.
        deficit_kcal: detail?.deficitKcal ?? null,
        statut: detail?.statut ?? 'manquant',
      };
    });

  // 4. Une seule écriture, en une transaction (spec §6.8). Une coupure
  //    laisse la base dans l'état d'avant, jamais à moitié recalculée.
  const { error } = await supabase.rpc('appliquer_recalcul', {
    p_programme_id: programmeActif.id,
    p_pesees: peseesLissees.map((p) => ({
      date: p.date,
      moyenne_mobile_7j_kg: p.moyenneMobile7jKg,
      aberrante: p.aberrante,
    })),
    p_journees: majJournees,
    p_instantanes: instantanes.map((i) => ({
      date: i.date,
      deficit_cumul_kcal: i.deficitCumulKcal,
      kg_theoriques: i.kgTheoriques,
      kg_reels: i.kgReels,
      ecart_kg: i.ecartKg,
      depense_reelle_kcal: i.depenseReelleKcal,
      depense_retenue_kcal: i.depenseRetenueKcal,
      depense_issue_du_reel: i.depenseIssueDuReel,
      fiabilite: i.fiabilite,
      allure_kg_semaine: i.allureKgSemaine,
      completude: i.completude.taux,
      jours_renseignes: i.completude.joursRenseignes,
      jours_total: i.completude.joursTotal,
      projection_date: i.projection.dateMediane,
    })),
  });

  if (error !== null) return { erreur: error.message };

  return { instantanesEcrits: instantanes.length };
}

import 'server-only';

import {
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

  const majPesees = peseesLissees
    .map((lissee, index) => ({ lissee, ligne: lignesPesee[index] }))
    .filter(
      (paire): paire is { lissee: PeseeLissee; ligne: LignePesee } =>
        paire.ligne !== undefined,
    )
    .filter(
      ({ lissee, ligne }) =>
        Number(ligne.moyenne_mobile_7j_kg) !== lissee.moyenneMobile7jKg ||
        ligne.aberrante !== lissee.aberrante,
    );

  if (majPesees.length > 0) {
    await Promise.all(
      majPesees.map(({ lissee, ligne }) =>
        supabase
          .from('pesee')
          .update({
            moyenne_mobile_7j_kg: lissee.moyenneMobile7jKg,
            aberrante: lissee.aberrante,
          })
          .eq('id', ligne.id),
      ),
    );
  }

  const apports: ApportJournalier[] = journees.map((j) => {
    const agregat = agregats.get(j.date);
    return {
      date: j.date,
      // Une journée sans aucune entrée n'est pas un jour à zéro : c'est
      // un jour non renseigné. La distinction porte toute la complétude.
      apportKcal: agregat === undefined ? null : agregat.kcal,
    };
  });

  // 3. Réécriture des agrégats de `journee` sur la plage impactée.
  const instantanes = calculerInstantanes({
    dateDebut: entree.dateImpactee,
    dateFin: entree.aujourdhui,
    profil,
    programme,
    apports,
    pesees: peseesLissees,
  });

  const journeeParDate = new Map(journees.map((j) => [j.date, j]));

  const majJournees = instantanes.flatMap((instantane) => {
    const existante = journeeParDate.get(instantane.date);
    if (existante === undefined) return [];

    const agregat = agregats.get(instantane.date);
    return [
      supabase
        .from('journee')
        .update({
          programme_id: programmeActif.id,
          apport_kcal: agregat?.kcal ?? 0,
          proteines_g: agregat?.proteines ?? 0,
          glucides_g: agregat?.glucides ?? 0,
          lipides_g: agregat?.lipides ?? 0,
          depense_retenue_kcal: instantane.depenseRetenueKcal,
          statut: agregat === undefined ? 'manquant' : 'renseigne',
        })
        .eq('id', existante.id),
    ];
  });

  await Promise.all(majJournees);

  // 4. Instantanés. `upsert` sur (user_id, programme_id, date) : rejouer
  //    le recalcul écrase la ligne au lieu d'en créer une seconde.
  if (instantanes.length > 0) {
    const { error } = await supabase.from('instantane_calcul').upsert(
      instantanes.map((i) => ({
        user_id: user.id,
        programme_id: programmeActif.id,
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
        calcule_le: new Date().toISOString(),
      })),
      { onConflict: 'user_id,programme_id,date' },
    );

    if (error !== null) return { erreur: error.message };
  }

  return { instantanesEcrits: instantanes.length };
}

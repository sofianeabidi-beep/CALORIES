import { redirect } from 'next/navigation';
import { lireJournee } from '@/lib/donnees/journee';
import { aujourdhuiIso, formaterDate } from '@/lib/dates-app';
import {
  differenceJours,
  evaluerStatutJour,
  nombreJoursInclus,
  objectifProteinesRepere,
  repartirMacrosObjectif,
} from '@/lib/calcul';
import { Carte, Chiffre, Libelle } from '@/components/ui/primitives';
import { delaiEntree } from '@/components/ui/delai-entree';
import { CompteurAnime } from '@/components/ui/compteur-anime';
import { AlimentationJour } from '@/components/aujourdhui/alimentation-jour';
import { BlocSuggestion } from '@/components/aujourdhui/bloc-suggestion';
import { EnteteProfil } from '@/components/aujourdhui/entete-profil';
import type { StatutKcal } from '@/lib/calcul';

const entier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

function fraction(consomme: number, objectif: number): string {
  return `${entier.format(consomme)}/${entier.format(objectif)}`;
}

/**
 * Statut du jour, toujours chiffré. La tendance sur plusieurs jours n'a
 * pas sa place ici — elle rejoindra le Bilan, qui raisonne déjà en
 * cumulé, plutôt que de dupliquer cette logique sur l'écran du jour.
 */
function texteStatutKcal(statut: StatutKcal, apportKcal: number, objectifKcal: number): string {
  if (statut === 'depasse') {
    return `${entier.format(apportKcal - objectifKcal)} kcal au-delà de l’objectif aujourd’hui.`;
  }
  if (statut === 'proche_objectif') {
    return `Encore ${entier.format(objectifKcal - apportKcal)} kcal avant l’objectif — vous y êtes presque.`;
  }
  return `${entier.format(objectifKcal - apportKcal)} kcal de marge avant l’objectif.`;
}

function texteProteines(
  statut: 'suffisant' | 'insuffisant' | 'inconnu',
  proteinesG: number,
  objectifProteinesG: number,
): string | null {
  if (statut === 'inconnu') return null;
  const base = `Protéines : ${entier.format(proteinesG)} g sur un repère de ~${entier.format(objectifProteinesG)} g`;
  return statut === 'insuffisant' ? `${base} pour l’instant.` : `${base} — couvert.`;
}

export default async function Aujourdhui() {
  const date = aujourdhuiIso();
  const vue = await lireJournee(date);

  // Ni profil ni programme actif : l'utilisateur n'a pas fini son
  // installation, on l'y renvoie plutôt que d'afficher des tirets.
  if (vue === null) redirect('/reglages/programme');

  const { bilan, entrees, nombrePesees, objectifKcal, profil, programme } = vue;
  const apportDuJour = entrees.reduce((somme, e) => somme + Number(e.kcal), 0);
  const proteinesDuJour = entrees.reduce((s, e) => s + Number(e.proteines_g ?? 0), 0);
  const glucidesDuJour = entrees.reduce((s, e) => s + Number(e.glucides_g ?? 0), 0);
  const lipidesDuJour = entrees.reduce((s, e) => s + Number(e.lipides_g ?? 0), 0);

  const cible = objectifKcal ?? Math.round(bilan.depenseRetenueKcal);
  const restant = cible - apportDuJour;

  const objectifProteinesG = objectifProteinesRepere(Number(programme.poids_depart_kg));
  const objectifsMacros = repartirMacrosObjectif({ objectifKcal: cible, objectifProteinesG });

  const statutJour = evaluerStatutJour({
    apportKcal: apportDuJour,
    objectifKcal: cible,
    proteinesG: proteinesDuJour,
    objectifProteinesG,
  });
  const messageStatutKcal = texteStatutKcal(statutJour.statutKcal, apportDuJour, cible);
  const messageProteines = texteProteines(statutJour.statutProteines, proteinesDuJour, objectifProteinesG);

  const repasDejaPris = entrees.map((e) => ({
    repas: e.repas,
    libelle: e.libelle,
    kcal: Number(e.kcal),
  }));

  // `null` sans exception : la projection se masque déjà elle-même
  // quand les données ne la portent pas (§ Projection) — pas de date à
  // soustraire dans ce cas.
  const joursAvantObjectif =
    bilan.projection.affichable && bilan.projection.dateMediane !== null
      ? differenceJours(date, bilan.projection.dateMediane)
      : null;

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <header className="mb-4">
        <Libelle>{formaterDate(date)}</Libelle>
      </header>

      <EnteteProfil
        prenom={profil.prenom}
        joursDeRegime={nombreJoursInclus(programme.date_debut, date)}
        nombrePesees={nombrePesees}
        kgTheoriques={bilan.kgTheoriques}
        joursAvantObjectif={joursAvantObjectif}
        modeDiscret={profil.mode_discret}
        className="entree-douce"
        style={delaiEntree(0)}
      />

      <Carte className="mt-4 halo-deficit entree-douce" style={delaiEntree(1)}>
        <Libelle>Restant aujourd’hui</Libelle>
        <div className="mt-2">
          {/* Mode discret : ni calories, ni objectif. Seules la
              complétude et la tendance restent visibles (spec §9). */}
          {profil.mode_discret ? (
            <Chiffre valeur="—" />
          ) : (
            <CompteurAnime
              valeurs={[apportDuJour, cible]}
              ton={restant >= 0 ? 'deficit' : 'surplus'}
            />
          )}
        </div>

        {!profil.mode_discret && (
          <p className="mt-2 text-sm text-ardoise">
            <span className="chiffre">{entier.format(Math.abs(restant))}</span> kcal{' '}
            {restant >= 0 ? 'restant' : 'au-delà de l’objectif'}
          </p>
        )}

        <p className="mt-2 text-sm text-ardoise">
          {bilan.depenseIssueDuReel ? (
            <>
              Dépense retenue :{' '}
              <span className="chiffre">
                {entier.format(Math.round(bilan.depenseRetenueKcal))}
              </span>{' '}
              kcal, <strong className="font-medium text-graphite">recalculée</strong> sur vos
              données réelles.
            </>
          ) : (
            <>
              Dépense retenue :{' '}
              <span className="chiffre">
                {entier.format(Math.round(bilan.depenseRetenueKcal))}
              </span>{' '}
              kcal, estimée par formule — elle sera corrigée dès que vos données le
              permettront.
            </>
          )}
        </p>
      </Carte>

      {!profil.mode_discret && (
        <Carte className="mt-4 entree-douce" style={delaiEntree(2)}>
          <Libelle>Macronutriments</Libelle>
          <div className="mt-2 grid grid-cols-3 gap-3">
            <div>
              <Chiffre
                valeur={fraction(proteinesDuJour, objectifsMacros.proteinesG)}
                unite="g"
                taille="moyen"
              />
              <p className="mt-1 text-sm text-ardoise">Protéines</p>
            </div>
            <div>
              <Chiffre
                valeur={fraction(glucidesDuJour, objectifsMacros.glucidesG)}
                unite="g"
                taille="moyen"
              />
              <p className="mt-1 text-sm text-ardoise">Glucides</p>
            </div>
            <div>
              <Chiffre
                valeur={fraction(lipidesDuJour, objectifsMacros.lipidesG)}
                unite="g"
                taille="moyen"
              />
              <p className="mt-1 text-sm text-ardoise">Lipides</p>
            </div>
          </div>
        </Carte>
      )}

      {!profil.mode_discret && (
        <Carte className="mt-4 entree-douce" style={delaiEntree(3)}>
          <Libelle>Avis sur la journée</Libelle>
          <div className="mt-2 flex flex-col gap-1">
            <p className="text-sm text-ardoise">{messageStatutKcal}</p>
            {messageProteines !== null && (
              <p className="text-sm text-ardoise">{messageProteines}</p>
            )}
          </div>
        </Carte>
      )}

      <Carte className="mt-4 entree-douce" style={delaiEntree(4)}>
        <Libelle>Alimentation du jour</Libelle>
        <AlimentationJour
          entrees={entrees.map((e) => ({
            id: e.id,
            libelle: e.libelle,
            quantite: Number(e.quantite),
            unite: e.unite,
            kcal: Number(e.kcal),
            repas: e.repas,
          }))}
          modeDiscret={profil.mode_discret}
        />
      </Carte>

      {!profil.mode_discret && (
        <BlocSuggestion
          restantKcal={restant}
          repasDejaPris={repasDejaPris}
          className="mt-4 entree-douce"
          style={delaiEntree(5)}
        />
      )}
    </main>
  );
}

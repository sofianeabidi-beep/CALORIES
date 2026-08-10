import { redirect } from 'next/navigation';
import { lireJournee } from '@/lib/donnees/journee';
import { aujourdhuiIso, formaterDate } from '@/lib/dates-app';
import { IndicateurCumule } from '@/components/bilan/indicateur-cumule';
import { Carte, Chiffre, Libelle } from '@/components/ui/primitives';
import { KCAL_PAR_KG } from '@/lib/calcul';

const entier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const deuxDecimales = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Les quatre indicateurs (spec §1).
 *
 * Le troisième — la confrontation entre kilos théoriques et kilos
 * mesurés — est le produit. L'écart n'est pas une erreur à masquer :
 * c'est ce qui permet de corriger la dépense énergétique.
 */
export default async function Bilan() {
  const date = aujourdhuiIso();
  const vue = await lireJournee(date);
  if (vue === null) redirect('/reglages/programme');

  const { bilan } = vue;
  const enDeficit = bilan.deficitCumulKcal >= 0;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
      <header>
        <h1 className="text-xl font-light text-graphite">Bilan</h1>
        <p className="mt-1 text-sm text-ardoise">
          Depuis le {formaterDate(vue.programme.date_debut, { dateStyle: 'long' })}.
        </p>
      </header>

      <IndicateurCumule
        libelle={enDeficit ? 'Déficit cumulé' : 'Surplus cumulé'}
        valeur={entier.format(Math.abs(bilan.deficitCumulKcal))}
        unite="kcal"
        ton={enDeficit ? 'deficit' : 'surplus'}
        completude={bilan.completude}
        precision={`Soit ${deuxDecimales.format(Math.abs(bilan.kgTheoriques))} kg en théorie, au coefficient approximatif de ${entier.format(KCAL_PAR_KG)} kcal par kilo. Une part des variations à court terme relève de l’eau et du glycogène, pas de la masse grasse.`}
      />

      {bilan.kgReels === null ? (
        <Carte>
          <Libelle>Théorique contre réel</Libelle>
          <p className="mt-2 text-sm text-ardoise">
            Enregistrez au moins une pesée pour confronter la théorie à la réalité. C’est
            de cet écart que l’application déduit votre dépense énergétique réelle.
          </p>
        </Carte>
      ) : (
        <Carte>
          <Libelle>Théorique contre réel</Libelle>
          <div className="mt-3 flex items-baseline justify-between gap-4">
            <div>
              <p className="text-xs text-ardoise">Théorie</p>
              <Chiffre
                valeur={deuxDecimales.format(bilan.kgTheoriques)}
                unite="kg"
                taille="moyen"
              />
            </div>
            <div>
              <p className="text-xs text-ardoise">Balance</p>
              <Chiffre
                valeur={deuxDecimales.format(bilan.kgReels)}
                unite="kg"
                taille="moyen"
              />
            </div>
          </div>

          <p className="mt-3 border-t border-trait pt-2 text-sm text-graphite">
            {Math.abs(bilan.ecartKg ?? 0) < 0.3
              ? 'Théorie et balance concordent : l’estimation de votre dépense est juste.'
              : (bilan.ecartKg ?? 0) > 0
                ? 'La balance descend moins vite que la théorie ne le prévoit : votre dépense réelle est plus basse que l’estimation. L’application s’y adapte.'
                : 'La balance descend plus vite que la théorie ne le prévoit : votre dépense réelle est plus haute que l’estimation. L’application s’y adapte.'}
          </p>
        </Carte>
      )}

      <Carte>
        <Libelle>Dépense énergétique</Libelle>
        <div className="mt-2">
          <Chiffre
            valeur={entier.format(Math.round(bilan.depenseRetenueKcal))}
            unite="kcal/j"
            taille="moyen"
          />
        </div>
        <p className="mt-2 text-sm text-ardoise">
          {bilan.depenseIssueDuReel
            ? 'Recalculée sur vos données réelles. Elle a remplacé l’estimation par formule.'
            : 'Estimée par la formule de Mifflin-St Jeor. C’est un point de départ, pas une vérité — elle sera corrigée dès que vos données le permettront.'}
        </p>
        <p className="mt-2 text-sm text-ardoise">
          Fiabilité : <span className="chiffre">{Math.round(bilan.fiabilite * 100)} %</span>{' '}
          des jours de la fenêtre de 28 jours sont renseignés.
        </p>
      </Carte>

      <Carte>
        <Libelle>Rythme actuel</Libelle>
        {bilan.allureKgSemaine === null ? (
          <p className="mt-2 text-sm text-ardoise">
            Pas encore assez de pesées pour établir une tendance.
          </p>
        ) : (
          <>
            <div className="mt-2">
              <Chiffre
                valeur={deuxDecimales.format(bilan.allureKgSemaine)}
                unite="kg/sem"
                taille="moyen"
                ton={bilan.allureKgSemaine <= 0 ? 'deficit' : 'surplus'}
              />
            </div>
            {bilan.projection.affichable ? (
              <p className="mt-2 text-sm text-ardoise">
                Objectif atteint entre le{' '}
                {formaterDate(bilan.projection.dateOptimiste as string, {
                  dateStyle: 'long',
                })}{' '}
                et le{' '}
                {formaterDate(bilan.projection.datePrudente as string, {
                  dateStyle: 'long',
                })}
                .
              </p>
            ) : (
              <p className="mt-2 text-sm text-ardoise">
                Aucune projection affichée : les données ne la portent pas encore. Mieux
                vaut aucune date qu’une date fausse.
              </p>
            )}
          </>
        )}
      </Carte>
    </main>
  );
}

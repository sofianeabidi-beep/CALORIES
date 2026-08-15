import Link from 'next/link';
import { redirect } from 'next/navigation';
import { lireJournee } from '@/lib/donnees/journee';
import { lireHistoriquePoids } from '@/lib/donnees/pesee';
import { aujourdhuiIso, formaterDate } from '@/lib/dates-app';
import { IndicateurCumule } from '@/components/bilan/indicateur-cumule';
import { GraphiquePoids } from '@/components/bilan/graphique-poids';
import { AnalysePeriode } from '@/components/bilan/analyse-periode';
import { Carte, Chiffre, Libelle } from '@/components/ui/primitives';
import { delaiEntree } from '@/components/ui/delai-entree';
import { calculerImc, tendancePoids, KCAL_PAR_KG } from '@/lib/calcul';

const entier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const uneDecimale = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const deuxDecimales = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Fenêtre du rythme « 3 derniers mois » — distincte des 28 j utilisés pour la projection. */
const FENETRE_RYTHME_LONG_JOURS = 90;

/**
 * Catégories usuelles de l'OMS. Affichage informatif, pas un verdict :
 * même parti pris que le reste de l'application (spec §10) — aucune
 * couleur de jugement, l'IMC est un indicateur parmi d'autres.
 */
function categorieImc(imc: number): string {
  if (imc < 18.5) return 'Insuffisance pondérale';
  if (imc < 25) return 'Corpulence normale';
  if (imc < 30) return 'Surpoids';
  return 'Obésité';
}

function formaterRythme(kgParSemaine: number): string {
  const signe = kgParSemaine >= 0 ? '+' : '';
  if (Math.abs(kgParSemaine) < 1) {
    return `${signe}${entier.format(kgParSemaine * 1000)} g/semaine`;
  }
  return `${signe}${deuxDecimales.format(kgParSemaine)} kg/semaine`;
}

/**
 * Les quatre indicateurs (spec §1), plus le suivi du poids — Pesée et
 * Bilan ne font plus qu'un seul onglet : le poids est l'une des données
 * du bilan, pas un sujet à part.
 *
 * Le troisième indicateur — la confrontation entre kilos théoriques et
 * kilos mesurés — est le produit. L'écart n'est pas une erreur à
 * masquer : c'est ce qui permet de corriger la dépense énergétique.
 */
export default async function Bilan() {
  const date = aujourdhuiIso();
  const [vue, historique] = await Promise.all([lireJournee(date), lireHistoriquePoids()]);
  if (vue === null) redirect('/reglages/programme');

  const { bilan } = vue;
  const enDeficit = bilan.deficitCumulKcal >= 0;

  // `kgReels` est un écart (départ − actuel), pas un poids absolu :
  // il faut le recomposer avec le poids de départ du programme. Sans
  // pesée, on affiche le poids de départ faute de mieux.
  const poidsActuelKg =
    bilan.kgReels === null
      ? Number(vue.programme.poids_depart_kg)
      : Number(vue.programme.poids_depart_kg) - bilan.kgReels;
  const tailleCm = vue.profil.taille_cm;

  const pesees = historique?.pesees ?? [];
  const journees = historique?.journees ?? [];
  const tendanceLongue = tendancePoids({
    pesees,
    dateFin: date,
    joursFenetre: FENETRE_RYTHME_LONG_JOURS,
  });

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
      <header>
        <h1 className="font-voice text-xl text-graphite">Bilan</h1>
        <p className="mt-1 text-sm text-ardoise">
          Depuis le {formaterDate(vue.programme.date_debut, { dateStyle: 'long' })}.
        </p>
      </header>

      <IndicateurCumule
        libelle={enDeficit ? 'Perte de poids cumulée' : 'Prise de poids cumulée'}
        valeur={deuxDecimales.format(Math.abs(bilan.kgTheoriques))}
        valeurAnimee={Math.abs(bilan.kgTheoriques)}
        unite="kg"
        decimales={2}
        ton={enDeficit ? 'deficit' : 'surplus'}
        completude={bilan.completude}
        precision={`Soit ${entier.format(Math.abs(bilan.deficitCumulKcal))} kcal de ${enDeficit ? 'déficit' : 'surplus'} cumulé, au coefficient approximatif de ${entier.format(KCAL_PAR_KG)} kcal par kilo. Une part des variations à court terme relève de l’eau et du glycogène, pas de la masse grasse.`}
        className="halo-deficit entree-douce"
        style={delaiEntree(0)}
      />

      {bilan.kgReels === null ? (
        <Carte className="entree-douce" style={delaiEntree(1)}>
          <Libelle>Théorique contre réel</Libelle>
          <p className="mt-2 text-sm text-ardoise">
            Enregistrez au moins une pesée pour confronter la théorie à la réalité. C’est
            de cet écart que l’application déduit votre dépense énergétique réelle.
          </p>
        </Carte>
      ) : (
        <Carte className="entree-douce" style={delaiEntree(1)}>
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

      <Carte className="entree-douce" style={delaiEntree(2)}>
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
            <p className="mt-1 text-xs text-ardoise">Sur les 28 derniers jours.</p>
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

        {tendanceLongue !== null && (
          <p className="mt-3 border-t border-trait pt-2 text-sm text-ardoise">
            Sur les 3 derniers mois :{' '}
            <span className="chiffre text-graphite">
              {formaterRythme(tendanceLongue.kgParSemaine)}
            </span>{' '}
            en moyenne.
          </p>
        )}
      </Carte>

      <Carte className="entree-douce" style={delaiEntree(3)}>
        <Libelle>Évolution du poids</Libelle>
        <div className="mt-3">
          <GraphiquePoids pesees={pesees} />
        </div>
      </Carte>

      <AnalysePeriode journees={journees} pesees={pesees} />

      {tailleCm !== null && (
        <Carte className="entree-douce" style={delaiEntree(4)}>
          <Libelle>Poids et taille</Libelle>
          <div className="mt-3 flex items-baseline justify-between gap-4">
            <div>
              <p className="text-xs text-ardoise">Poids actuel</p>
              <Chiffre valeur={uneDecimale.format(poidsActuelKg)} unite="kg" taille="moyen" />
            </div>
            <div>
              <p className="text-xs text-ardoise">Taille</p>
              <Chiffre valeur={entier.format(tailleCm)} unite="cm" taille="moyen" />
            </div>
          </div>

          <div className="mt-3 border-t border-trait pt-2">
            <p className="text-xs text-ardoise">IMC</p>
            <Chiffre
              valeur={deuxDecimales.format(calculerImc(poidsActuelKg, tailleCm))}
              taille="moyen"
            />
            <p className="mt-1 text-sm text-graphite">
              {categorieImc(calculerImc(poidsActuelKg, tailleCm))}
            </p>
          </div>

          <p className="mt-2 text-sm text-ardoise">
            L’IMC ne distingue pas masse grasse et masse musculaire : c’est un indicateur
            parmi d’autres, pas un verdict.
          </p>
        </Carte>
      )}

      <Carte className="entree-douce" style={delaiEntree(5)}>
        <Libelle>Historique</Libelle>
        <p className="mt-2 text-sm text-ardoise">
          Déficit ou surplus jour par jour, avec le détail de ce que vous avez mangé.
        </p>
        <Link href="/bilan/historique" className="mt-2 inline-block text-sm text-deficit">
          Voir le détail jour par jour →
        </Link>
      </Carte>

      <Carte className="entree-douce" style={delaiEntree(6)}>
        <Libelle>Dernières pesées</Libelle>
        {pesees.length === 0 ? (
          <p className="mt-2 text-sm text-ardoise">Aucune pesée enregistrée.</p>
        ) : (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {pesees
              .slice(-12)
              .reverse()
              .map((pesee) => (
                <div
                  key={pesee.date}
                  className="rounded-lg border border-trait px-2 py-1.5 text-center"
                >
                  <p
                    className={`chiffre text-sm ${
                      pesee.aberrante ? 'text-signal' : 'text-graphite'
                    }`}
                  >
                    {uneDecimale.format(pesee.poidsKg)} kg
                  </p>
                  <p className="text-xs text-ardoise">
                    {formaterDate(pesee.date, { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              ))}
          </div>
        )}

        {pesees.slice(-12).some((p) => p.aberrante) && (
          <p className="mt-3 border-t border-trait pt-2 text-sm text-ardoise">
            Les valeurs en rouge s’écartent de plus de 2 kg de votre moyenne. Elles sont
            conservées mais exclues du calcul, le temps que vous les confirmiez.
          </p>
        )}

        {/* Un bouton normal, pas flottant : contrairement à « Ajouter un
            repas » (plusieurs fois par jour), se peser arrive au plus une
            fois par jour, et Bilan est une page qu'on lit plutôt qu'un
            écran d'action rapide — un bouton fixe finissait par recouvrir
            en permanence une partie de la carte au-dessus. */}
        <Link
          href="/pesee/nouvelle"
          className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-deficit px-4 text-base font-medium text-white transition duration-150 hover:opacity-90 active:opacity-80"
        >
          Je me pèse
        </Link>
      </Carte>
    </main>
  );
}

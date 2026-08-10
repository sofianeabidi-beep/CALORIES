import Link from 'next/link';
import { redirect } from 'next/navigation';
import { lireJournee } from '@/lib/donnees/journee';
import { aujourdhuiIso, formaterDate } from '@/lib/dates-app';
import { Carte, Chiffre, Libelle } from '@/components/ui/primitives';
import type { Repas } from '@/lib/supabase/types';

const ORDRE_REPAS: readonly { cle: Repas; texte: string }[] = [
  { cle: 'petit_dejeuner', texte: 'Petit-déjeuner' },
  { cle: 'dejeuner', texte: 'Déjeuner' },
  { cle: 'diner', texte: 'Dîner' },
  { cle: 'collation', texte: 'Collation' },
];

const entier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export default async function Aujourdhui() {
  const date = aujourdhuiIso();
  const vue = await lireJournee(date);

  // Ni profil ni programme actif : l'utilisateur n'a pas fini son
  // installation, on l'y renvoie plutôt que d'afficher des tirets.
  if (vue === null) redirect('/reglages/programme');

  const { bilan, entrees, objectifKcal, profil } = vue;
  const apportDuJour = entrees.reduce((somme, e) => somme + Number(e.kcal), 0);

  const cible = objectifKcal ?? Math.round(bilan.depenseRetenueKcal);
  const restant = cible - apportDuJour;

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <header className="mb-4">
        <Libelle>{formaterDate(date)}</Libelle>
      </header>

      <Carte>
        <Libelle>{restant >= 0 ? 'Restant aujourd’hui' : 'Au-delà de l’objectif'}</Libelle>
        <div className="mt-2">
          {/* Mode discret : ni calories, ni objectif. Seules la
              complétude et la tendance restent visibles (spec §9). */}
          {profil.mode_discret ? (
            <Chiffre valeur="—" />
          ) : (
            <Chiffre
              valeur={entier.format(Math.abs(restant))}
              unite="kcal"
              ton={restant >= 0 ? 'deficit' : 'surplus'}
            />
          )}
        </div>

        {!profil.mode_discret && (
          <p className="mt-3 text-sm text-ardoise">
            <span className="chiffre">{entier.format(apportDuJour)}</span> kcal enregistrées
            sur un objectif de <span className="chiffre">{entier.format(cible)}</span>.
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

      <section className="mt-4 flex flex-col gap-3" aria-label="Repas du jour">
        {ORDRE_REPAS.map((repas) => {
          const duRepas = entrees.filter((e) => e.repas === repas.cle);
          const total = duRepas.reduce((somme, e) => somme + Number(e.kcal), 0);

          return (
            <Carte key={repas.cle}>
              <div className="flex items-baseline justify-between gap-2">
                <Libelle>{repas.texte}</Libelle>
                {!profil.mode_discret && duRepas.length > 0 && (
                  <span className="chiffre text-sm text-ardoise">
                    {entier.format(total)} kcal
                  </span>
                )}
              </div>

              {duRepas.length === 0 ? (
                <p className="mt-2 text-sm text-ardoise">Rien d’enregistré.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1">
                  {duRepas.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-baseline justify-between gap-3 text-sm"
                    >
                      <span className="text-graphite">{e.libelle}</span>
                      <span className="chiffre shrink-0 text-ardoise">
                        {entier.format(Number(e.quantite))} {e.unite}
                        {!profil.mode_discret && ` · ${entier.format(Number(e.kcal))} kcal`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <Link
                href={{ pathname: '/saisie', query: { repas: repas.cle } }}
                className="mt-3 flex min-h-11 items-center justify-center rounded-lg border border-trait text-sm text-graphite"
              >
                Ajouter
              </Link>
            </Carte>
          );
        })}
      </section>

      {/* Bouton de saisie omniprésent : c'est la fonction vitale. */}
      <Link
        href="/saisie"
        className="fixed bottom-20 left-1/2 flex min-h-12 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-center rounded-xl bg-deficit px-4 text-base font-medium text-white shadow-lg"
      >
        Enregistrer un aliment
      </Link>
    </main>
  );
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { lireHistoriqueJournees, type JourHistorique } from '@/lib/donnees/historique';
import { formaterDate } from '@/lib/dates-app';
import { LIBELLES_REPAS, ORDRE_REPAS } from '@/lib/repas';
import { Carte, Chiffre, Libelle } from '@/components/ui/primitives';

const entier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

function grouperParRepas(jour: JourHistorique) {
  return ORDRE_REPAS.map((cle) => ({
    cle,
    texte: LIBELLES_REPAS[cle],
    entrees: jour.entrees.filter((e) => e.repas === cle),
  })).filter((groupe) => groupe.entrees.length > 0);
}

/**
 * Détail jour par jour, séparé de Bilan pour ne pas y alourdir une vue
 * de synthèse — Bilan lit en un coup d'œil, cette page se parcourt.
 *
 * Pagination par curseur de date (`avant`), pas par numéro de page : un
 * lien simple à construire, stable même si des jours sont ajoutés entre
 * deux visites.
 */
export default async function Historique({
  searchParams,
}: {
  searchParams: Promise<{ avant?: string }>;
}) {
  const { avant } = await searchParams;
  const vue = await lireHistoriqueJournees(avant === undefined ? undefined : { avant });
  if (vue === null) redirect('/reglages/programme');

  const dernierJour = vue.jours[vue.jours.length - 1];

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
      <header>
        <Link href="/bilan" className="text-sm text-ardoise">
          ← Bilan
        </Link>
        <h1 className="font-voice mt-1 text-xl text-graphite">Historique</h1>
      </header>

      {vue.jours.length === 0 ? (
        <Carte>
          <p className="text-sm text-ardoise">Aucune journée enregistrée pour l’instant.</p>
        </Carte>
      ) : (
        vue.jours.map((jour) => {
          const enDeficit = jour.deficitKcal !== null && jour.deficitKcal >= 0;
          const groupes = grouperParRepas(jour);

          return (
            <Carte key={jour.date}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm text-graphite">
                  {formaterDate(jour.date, { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                {jour.deficitKcal === null ? (
                  <span className="chiffre text-sm text-ardoise">—</span>
                ) : (
                  <Chiffre
                    valeur={entier.format(Math.abs(jour.deficitKcal))}
                    unite="kcal"
                    taille="moyen"
                    ton={enDeficit ? 'deficit' : 'surplus'}
                  />
                )}
              </div>
              <p className="mt-1 text-xs text-ardoise">
                {jour.deficitKcal === null
                  ? 'Journée non renseignée.'
                  : enDeficit
                    ? 'de déficit ce jour-là.'
                    : 'de surplus ce jour-là.'}{' '}
                Apport : <span className="chiffre">{entier.format(jour.apportKcal)}</span> kcal.
              </p>

              {groupes.length === 0 ? (
                <p className="mt-3 border-t border-trait pt-2 text-sm text-ardoise">
                  Rien d’enregistré.
                </p>
              ) : (
                <div className="mt-3 flex flex-col gap-2 border-t border-trait pt-2">
                  {groupes.map((groupe) => (
                    <div key={groupe.cle}>
                      <Libelle>{groupe.texte}</Libelle>
                      <ul className="mt-1 flex flex-col gap-0.5">
                        {groupe.entrees.map((e) => (
                          <li
                            key={e.id}
                            className="flex items-baseline justify-between gap-2 text-sm"
                          >
                            <span className="text-graphite">{e.libelle}</span>
                            <span className="chiffre shrink-0 text-ardoise">
                              {entier.format(e.kcal)} kcal
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </Carte>
          );
        })
      )}

      {vue.aEncorePlus && dernierJour !== undefined && (
        <Link
          href={`/bilan/historique?avant=${dernierJour.date}`}
          className="text-center text-sm text-deficit"
        >
          Jours précédents →
        </Link>
      )}
    </main>
  );
}

'use client';

import { useState } from 'react';
import { obtenirRecetteAction } from '@/lib/actions/recette';
import type { Recette } from '@/lib/ia/analyse-recette';
import { LIBELLES_REPAS } from '@/lib/repas';
import type { Repas } from '@/lib/supabase/types';
import { Carte, Libelle } from '@/components/ui/primitives';

const entier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export interface RepasPlanifie {
  readonly repas: Repas;
  readonly libelle: string;
  readonly kcalEstime: number;
}

export interface JourPlanifie {
  readonly jour: string;
  readonly repas: readonly RepasPlanifie[];
}

interface EtatRecette {
  readonly ouvert: boolean;
  readonly enCours: boolean;
  readonly erreur: string | null;
  readonly donnees: Recette | null;
}

/**
 * Affiche les sept jours du plan, un repas par ligne, avec le même
 * bouton « Voir la recette » que `suggestion-repas.tsx` — réutilise
 * directement `obtenirRecetteAction`, sans dupliquer l'appel IA ni la
 * logique d'ouverture/repli.
 */
export function SemainePlanifiee({
  jours,
  contrainteTemps,
}: {
  jours: readonly JourPlanifie[];
  contrainteTemps: 'rapide' | 'elabore';
}) {
  const [recettes, setRecettes] = useState<Readonly<Record<string, EtatRecette>>>({});

  async function afficherRecette(cle: string, repasCible: string, libelle: string, kcalEstime: number) {
    const etatActuel = recettes[cle];
    if (etatActuel?.donnees !== null && etatActuel !== undefined) {
      setRecettes((prev) => ({ ...prev, [cle]: { ...etatActuel, ouvert: !etatActuel.ouvert } }));
      return;
    }

    setRecettes((prev) => ({
      ...prev,
      [cle]: { ouvert: true, enCours: true, erreur: null, donnees: null },
    }));

    const resultat = await obtenirRecetteAction({ libelle, kcalEstime, repasCible, contrainteTemps });

    setRecettes((prev) => ({
      ...prev,
      [cle]: resultat.succes
        ? { ouvert: true, enCours: false, erreur: null, donnees: resultat.donnees }
        : { ouvert: true, enCours: false, erreur: resultat.erreur, donnees: null },
    }));
  }

  return (
    <div className="flex flex-col gap-3">
      {jours.map((jour, ji) => (
        <Carte key={jour.jour}>
          <Libelle>{jour.jour}</Libelle>
          <ul className="mt-2 flex flex-col gap-3">
            {jour.repas.map((r, ri) => {
              const cle = `${ji}-${ri}`;
              const etat = recettes[cle];
              const repasCible = LIBELLES_REPAS[r.repas];

              return (
                <li key={cle} className="text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-graphite">
                      {repasCible} — {r.libelle}
                    </span>
                    <span className="chiffre shrink-0 text-ardoise">
                      {entier.format(r.kcalEstime)} kcal
                    </span>
                  </div>

                  <button
                    type="button"
                    className="mt-1 text-ardoise underline underline-offset-2"
                    onClick={() => {
                      void afficherRecette(cle, repasCible, r.libelle, r.kcalEstime);
                    }}
                  >
                    {etat?.enCours === true
                      ? 'Recherche de la recette…'
                      : etat?.ouvert === true
                        ? 'Masquer la recette'
                        : 'Voir la recette'}
                  </button>

                  {etat?.erreur !== null && etat?.erreur !== undefined && (
                    <p className="mt-1 text-ardoise">{etat.erreur}</p>
                  )}

                  {etat?.ouvert === true && etat.donnees !== null && (
                    <div className="mt-2 flex flex-col gap-2 border-t border-trait pt-2">
                      {etat.donnees.portions !== undefined && (
                        <p className="text-ardoise">
                          Pour {entier.format(etat.donnees.portions)}{' '}
                          {etat.donnees.portions > 1 ? 'portions' : 'portion'}
                        </p>
                      )}
                      <ul className="list-disc pl-4 text-ardoise">
                        {etat.donnees.ingredients.map((ing) => (
                          <li key={ing.item}>
                            {ing.item} — {ing.quantite}
                          </li>
                        ))}
                      </ul>
                      <ol className="list-decimal pl-4 text-ardoise">
                        {etat.donnees.etapes.map((etape) => (
                          <li key={etape}>{etape}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Carte>
      ))}
    </div>
  );
}

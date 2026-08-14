'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bascule, Libelle } from '@/components/ui/primitives';
import { supprimerEntree } from '@/lib/actions/journal';
import { LIBELLES_REPAS, OPTIONS_REPAS, repasParDefaut } from '@/lib/repas';
import type { Repas } from '@/lib/supabase/types';

interface EntreeAffichee {
  readonly id: string;
  readonly libelle: string;
  readonly quantite: number;
  readonly unite: string;
  readonly kcal: number;
  readonly repas: Repas;
}

const entier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/**
 * Détail du jour, un repas à la fois.
 *
 * Empiler les quatre repas en permanence était répétitif — l'utilisateur
 * choisit maintenant lequel regarder, comme un onglet, plutôt que de
 * faire défiler trois sections vides pour trouver la bonne.
 *
 * Le bouton d'ajout vit ici, scopé au repas affiché, plutôt qu'un bouton
 * flottant générique en bas d'écran : l'utilisateur choisit le repas une
 * fois, en changeant d'onglet, et l'ajout part directement dans la bonne
 * catégorie — plus besoin de la choisir une seconde fois sur l'écran
 * suivant.
 *
 * Modifier/Supprimer par entrée : une erreur de saisie (mauvaise
 * quantité, mauvais aliment) est fréquente et doit se corriger aussi
 * vite qu'elle s'est ajoutée, sans repasser par le support ou recréer
 * l'entrée à la main.
 */
export function AlimentationJour({
  entrees,
  modeDiscret,
}: {
  entrees: readonly EntreeAffichee[];
  modeDiscret: boolean;
}) {
  const [selection, setSelection] = useState<Repas>(repasParDefaut);
  const [suppressionEnCours, setSuppressionEnCours] = useState<string | null>(null);

  const duRepas = entrees.filter((e) => e.repas === selection);
  const total = duRepas.reduce((somme, e) => somme + e.kcal, 0);
  const texteRepas = LIBELLES_REPAS[selection];

  async function supprimer(id: string) {
    setSuppressionEnCours(id);
    await supprimerEntree({ id });
    setSuppressionEnCours(null);
  }

  return (
    <div>
      <Bascule
        options={OPTIONS_REPAS}
        valeur={selection}
        onChange={(v) => {
          setSelection(v as Repas);
        }}
      />

      <div className="mt-3">
        <div className="flex items-baseline justify-between gap-2">
          <Libelle>{texteRepas}</Libelle>
          {!modeDiscret && duRepas.length > 0 && (
            <span className="chiffre text-sm text-ardoise">{entier.format(total)} kcal</span>
          )}
        </div>

        {duRepas.length === 0 ? (
          <p className="mt-2 text-sm text-ardoise">Rien d’enregistré.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-3">
            {duRepas.map((e) => (
              <li key={e.id} className="border-b border-trait pb-3 text-sm last:border-b-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-graphite">{e.libelle}</span>
                  <span className="chiffre shrink-0 text-ardoise">
                    {entier.format(e.quantite)} {e.unite}
                    {!modeDiscret && ` · ${entier.format(e.kcal)} kcal`}
                  </span>
                </div>
                <div className="mt-1 flex gap-4">
                  <Link
                    href={`/saisie?editId=${e.id}`}
                    className="text-xs text-ardoise underline underline-offset-2"
                  >
                    Modifier
                  </Link>
                  <button
                    type="button"
                    disabled={suppressionEnCours === e.id}
                    onClick={() => {
                      void supprimer(e.id);
                    }}
                    className="text-xs text-ardoise underline underline-offset-2 disabled:opacity-50"
                  >
                    {suppressionEnCours === e.id ? 'Suppression…' : 'Supprimer'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Link
          href={`/saisie?repas=${selection}`}
          className="mt-3 flex min-h-11 items-center justify-center rounded-lg border border-trait text-sm text-graphite transition duration-150 hover:border-ardoise active:bg-trait"
        >
          Ajouter à {texteRepas.toLowerCase()}
        </Link>
      </div>
    </div>
  );
}

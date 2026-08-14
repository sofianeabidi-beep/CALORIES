'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bascule, Libelle } from '@/components/ui/primitives';
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
 */
export function AlimentationJour({
  entrees,
  modeDiscret,
}: {
  entrees: readonly EntreeAffichee[];
  modeDiscret: boolean;
}) {
  const [selection, setSelection] = useState<Repas>(repasParDefaut);

  const duRepas = entrees.filter((e) => e.repas === selection);
  const total = duRepas.reduce((somme, e) => somme + e.kcal, 0);
  const texteRepas = LIBELLES_REPAS[selection];

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
          <ul className="mt-2 flex flex-col gap-1">
            {duRepas.map((e) => (
              <li key={e.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-graphite">{e.libelle}</span>
                <span className="chiffre shrink-0 text-ardoise">
                  {entier.format(e.quantite)} {e.unite}
                  {!modeDiscret && ` · ${entier.format(e.kcal)} kcal`}
                </span>
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

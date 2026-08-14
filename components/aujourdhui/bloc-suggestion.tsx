'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Bascule, Carte, Libelle } from '@/components/ui/primitives';
import { SuggestionRepas } from '@/components/aujourdhui/suggestion-repas';
import { LIBELLES_REPAS, OPTIONS_REPAS, ORDRE_REPAS, repasParDefaut } from '@/lib/repas';
import type { Repas } from '@/lib/supabase/types';

interface RepasPris {
  readonly repas: string;
  readonly libelle: string;
  readonly kcal: number;
}

/** Un repas par ligne, dans l'ordre de la journée — pas un fourre-tout alphabétique. */
function grouperParRepas(repasDejaPris: readonly RepasPris[]): readonly { texte: string; libelles: readonly string[] }[] {
  return ORDRE_REPAS.map((cle) => ({
    texte: LIBELLES_REPAS[cle],
    libelles: repasDejaPris.filter((r) => r.repas === cle).map((r) => r.libelle),
  })).filter((groupe) => groupe.libelles.length > 0);
}

/**
 * Bloc de suggestion, séparé de « Alimentation du jour » plutôt que
 * greffé dedans : c'est une proposition, pas un détail de ce qui a déjà
 * été mangé, et les deux se lisaient mal une fois confondus.
 *
 * Le rappel de ce qui a déjà été pris aujourd'hui est affiché
 * explicitement avant le bouton — l'IA en tient déjà compte dans chaque
 * « raison » (voir `INSTRUCTIONS_RECOMMANDATION`), mais le dire une
 * seule fois en toutes lettres au-dessus rend cette prise en compte
 * visible d'un coup d'œil plutôt que de la laisser à déduire suggestion
 * par suggestion.
 */
export function BlocSuggestion({
  restantKcal,
  repasDejaPris,
  className,
  style,
}: {
  restantKcal: number;
  repasDejaPris: readonly RepasPris[];
  className?: string | undefined;
  style?: CSSProperties | undefined;
}) {
  const [repasCible, setRepasCible] = useState<Repas>(repasParDefaut);
  const groupes = grouperParRepas(repasDejaPris);

  return (
    <Carte className={className} style={style}>
      <Libelle>Une idée de repas ?</Libelle>

      <div className="mt-2">
        {groupes.length === 0 ? (
          <p className="text-sm text-ardoise">Rien d’enregistré aujourd’hui pour l’instant.</p>
        ) : (
          <p className="text-sm text-ardoise">
            Déjà pris aujourd’hui :{' '}
            {groupes.map((g, i) => (
              <span key={g.texte}>
                {i > 0 && ' · '}
                <span className="text-graphite">{g.texte.toLowerCase()}</span> :{' '}
                {g.libelles.join(', ')}
              </span>
            ))}
          </p>
        )}
      </div>

      <div className="mt-3">
        <Bascule
          options={OPTIONS_REPAS}
          valeur={repasCible}
          onChange={(v) => {
            setRepasCible(v as Repas);
          }}
        />
      </div>

      <SuggestionRepas
        repasCible={LIBELLES_REPAS[repasCible]}
        restantKcal={restantKcal}
        repasDejaPris={repasDejaPris}
      />
    </Carte>
  );
}

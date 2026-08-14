'use client';

import { useState } from 'react';
import { suggererRepasAction } from '@/lib/actions/recommandation';
import type { Recommandation } from '@/lib/ia/analyse-recommandation';
import { Bascule, Bouton } from '@/components/ui/primitives';

const entier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

type ContrainteTemps = 'rapide' | 'elabore';

const OPTIONS_TEMPS: readonly { valeur: ContrainteTemps; texte: string }[] = [
  { valeur: 'rapide', texte: 'Rapide' },
  { valeur: 'elabore', texte: 'J’ai le temps' },
];

/**
 * Bouton de suggestion pour un repas donné (petit-déjeuner, déjeuner,
 * dîner ou collation) : appelle l'IA avec le restant calorique du jour,
 * ce qui a déjà été mangé et une contrainte de temps choisie sur place.
 *
 * Lecture seule : aucune suggestion ne s'enregistre automatiquement,
 * l'utilisateur repasse par la saisie habituelle s'il veut la retenir —
 * même principe d'honnêteté que l'estimation IA du formulaire de saisie,
 * ce sont des idées, pas des valeurs à faire confiance les yeux fermés.
 */
export function SuggestionRepas({
  repasCible,
  restantKcal,
  repasDejaPris,
}: {
  /** Libellé français du repas visé (« Déjeuner »…), transmis tel quel à l'IA. */
  repasCible: string;
  restantKcal: number;
  repasDejaPris: readonly { repas: string; libelle: string; kcal: number }[];
}) {
  const [contrainteTemps, setContrainteTemps] = useState<ContrainteTemps>('rapide');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recommandation, setRecommandation] = useState<Recommandation | null>(null);

  async function lancerSuggestion() {
    setEnCours(true);
    setErreur(null);
    setRecommandation(null);

    const resultat = await suggererRepasAction({
      kcalRestant: restantKcal,
      repasDejaPris,
      repasCible,
      contrainteTemps,
    });

    if (!resultat.succes) {
      setErreur(resultat.erreur);
      setEnCours(false);
      return;
    }

    setRecommandation(resultat.donnees);
    setEnCours(false);
  }

  return (
    <div className="mt-3">
      <Bascule
        options={OPTIONS_TEMPS}
        valeur={contrainteTemps}
        onChange={(v) => {
          setContrainteTemps(v as ContrainteTemps);
        }}
        pleineLargeur
      />

      <Bouton
        variante="discret"
        className="mt-2"
        disabled={enCours}
        onClick={() => {
          void lancerSuggestion();
        }}
      >
        {enCours ? 'Recherche…' : 'Suggérer une idée'}
      </Bouton>

      {erreur !== null && <p className="mt-2 text-sm text-ardoise">{erreur}</p>}

      {recommandation !== null && (
        <div className="mt-3 flex flex-col gap-3">
          <ul className="flex flex-col gap-2">
            {recommandation.suggestions.map((s) => (
              <li key={s.libelle} className="text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-graphite">{s.libelle}</span>
                  <span className="chiffre shrink-0 text-ardoise">
                    {entier.format(s.kcalEstime)} kcal
                  </span>
                </div>
                <p className="text-ardoise">{s.raison}</p>
              </li>
            ))}
          </ul>
          <p className="text-sm text-ardoise">
            Suggestions générées par IA — à ajuster selon vos envies, pas une prescription.
          </p>
        </div>
      )}
    </div>
  );
}

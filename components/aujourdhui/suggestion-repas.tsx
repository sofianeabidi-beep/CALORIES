'use client';

import { useState } from 'react';
import { suggererRepasAction } from '@/lib/actions/recommandation';
import { obtenirRecetteAction } from '@/lib/actions/recette';
import type { Recommandation } from '@/lib/ia/analyse-recommandation';
import type { Recette } from '@/lib/ia/analyse-recette';
import { Bascule, Bouton } from '@/components/ui/primitives';

const entier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

type ContrainteTemps = 'rapide' | 'elabore';

const OPTIONS_TEMPS: readonly { valeur: ContrainteTemps; texte: string }[] = [
  { valeur: 'rapide', texte: 'Rapide' },
  { valeur: 'elabore', texte: 'J’ai le temps' },
];

interface EtatRecette {
  readonly ouvert: boolean;
  readonly enCours: boolean;
  readonly erreur: string | null;
  readonly donnees: Recette | null;
}

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
  const [recettes, setRecettes] = useState<Readonly<Record<number, EtatRecette>>>({});

  async function lancerSuggestion() {
    setEnCours(true);
    setErreur(null);
    setRecommandation(null);
    setRecettes({});

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

  /**
   * Recette demandée à la volée, une seule fois par suggestion — pas
   * générée d'emblée avec les suggestions, ce qui alourdirait un premier
   * appel que l'utilisateur ne consulte pas toujours. Un second clic une
   * fois chargée replie simplement le contenu plutôt que de rappeler
   * l'IA.
   */
  async function afficherRecette(index: number, libelle: string, kcalEstime: number) {
    const etatActuel = recettes[index];
    if (etatActuel?.donnees !== null && etatActuel !== undefined) {
      setRecettes((prev) => ({ ...prev, [index]: { ...etatActuel, ouvert: !etatActuel.ouvert } }));
      return;
    }

    setRecettes((prev) => ({
      ...prev,
      [index]: { ouvert: true, enCours: true, erreur: null, donnees: null },
    }));

    const resultat = await obtenirRecetteAction({
      libelle,
      kcalEstime,
      repasCible,
      contrainteTemps,
    });

    setRecettes((prev) => ({
      ...prev,
      [index]: resultat.succes
        ? { ouvert: true, enCours: false, erreur: null, donnees: resultat.donnees }
        : { ouvert: true, enCours: false, erreur: resultat.erreur, donnees: null },
    }));
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
          <ul className="flex flex-col gap-3">
            {recommandation.suggestions.map((s, index) => {
              const etatRecette = recettes[index];
              return (
                <li key={s.libelle} className="text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-graphite">{s.libelle}</span>
                    <span className="chiffre shrink-0 text-ardoise">
                      {entier.format(s.kcalEstime)} kcal
                    </span>
                  </div>
                  <p className="text-ardoise">{s.raison}</p>

                  <button
                    type="button"
                    className="mt-1 text-ardoise underline underline-offset-2"
                    onClick={() => {
                      void afficherRecette(index, s.libelle, s.kcalEstime);
                    }}
                  >
                    {etatRecette?.enCours === true
                      ? 'Recherche de la recette…'
                      : etatRecette?.ouvert === true
                        ? 'Masquer la recette'
                        : 'Voir la recette'}
                  </button>

                  {etatRecette?.erreur !== null && etatRecette?.erreur !== undefined && (
                    <p className="mt-1 text-ardoise">{etatRecette.erreur}</p>
                  )}

                  {etatRecette?.ouvert === true && etatRecette.donnees !== null && (
                    <div className="mt-2 flex flex-col gap-2 border-t border-trait pt-2">
                      {etatRecette.donnees.portions !== undefined && (
                        <p className="text-ardoise">
                          Pour {entier.format(etatRecette.donnees.portions)}{' '}
                          {etatRecette.donnees.portions > 1 ? 'portions' : 'portion'}
                        </p>
                      )}
                      <ul className="list-disc pl-4 text-ardoise">
                        {etatRecette.donnees.ingredients.map((ing) => (
                          <li key={ing.item}>
                            {ing.item} — {ing.quantite}
                          </li>
                        ))}
                      </ul>
                      <ol className="list-decimal pl-4 text-ardoise">
                        {etatRecette.donnees.etapes.map((etape) => (
                          <li key={etape}>{etape}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-ardoise">
            Suggestions générées par IA — à ajuster selon vos envies, pas une prescription.
          </p>
        </div>
      )}
    </div>
  );
}

'use client';

import { useActionState, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { enregistrerEntree } from '@/lib/actions/journal';
import type { Resultat } from '@/lib/actions/journal';
import { estimerRepasDecrit } from '@/lib/actions/estimation';
import { BoutonDictee } from '@/components/saisie/bouton-dictee';
import type { EstimationAliment } from '@/lib/ia/analyse';
import { aujourdhuiIso } from '@/lib/dates-app';
import { OPTIONS_REPAS } from '@/lib/repas';
import { Alerte, Bouton, Carte, Champ, Selecteur } from '@/components/ui/primitives';
import { delaiEntree } from '@/components/ui/delai-entree';
import type { Repas } from '@/lib/supabase/types';

const ETAT_INITIAL: Resultat = { ok: true };

export interface EntreeAModifier {
  readonly id: string;
  readonly date: string;
  readonly libelle: string;
  readonly repas: Repas;
  readonly quantite: number;
  readonly unite: string;
  readonly kcal: number;
  readonly proteinesG: number | null;
  readonly glucidesG: number | null;
  readonly lipidesG: number | null;
}

function nombreOuNull(valeur: FormDataEntryValue | null): number | null {
  if (valeur === null || valeur === '') return null;
  return Number(valeur);
}

interface AlimentEditable {
  readonly cle: string;
  libelle: string;
  quantite: string;
  unite: string;
  kcal: string;
  proteinesG: string;
  glucidesG: string;
  lipidesG: string;
}

function versEditable(a: EstimationAliment): AlimentEditable {
  return {
    cle: crypto.randomUUID(),
    libelle: a.libelle,
    quantite: String(Math.round(a.quantiteG)),
    unite: 'g',
    kcal: String(Math.round(a.kcal)),
    proteinesG: String(Math.round(a.proteinesG * 10) / 10),
    glucidesG: String(Math.round(a.glucidesG * 10) / 10),
    lipidesG: String(Math.round(a.lipidesG * 10) / 10),
  };
}

/**
 * Saisie rapide — et correction.
 *
 * Trois chemins vers les mêmes champs : les remplir à la main, décrire
 * ce qui a été mangé en une phrase et laisser une IA proposer des
 * valeurs, ou corriger une entrée déjà enregistrée (`entreeAModifier`).
 * Le deuxième ne remplace pas la recherche dans un vrai catalogue
 * (CIQUAL, Open Food Facts — phase 2) : quand l'aliment est connu, la
 * base donne un chiffre exact. L'IA n'intervient qu'en dernier recours,
 * et le dit explicitement — jamais présentée comme une valeur sûre.
 *
 * Une description peut citer plusieurs aliments distincts (« des
 * sardines et des crevettes ») aux profils nutritionnels différents :
 * l'estimation renvoie alors une liste, affichée comme des cartes
 * séparées et modifiables, enregistrées ensemble plutôt que fondues en
 * un seul total qui masquerait la contribution de chacune.
 *
 * En correction, la description libre disparaît : il n'y a rien à
 * réestimer, seulement des valeurs déjà connues à ajuster.
 * `enregistrerEntree` fait un upsert sur l'UUID client — soumettre le
 * même id que l'entrée d'origine la met à jour au lieu d'en créer une
 * seconde.
 */
export function FormulaireSaisie({
  entreeAModifier = null,
}: {
  entreeAModifier?: EntreeAModifier | null;
}) {
  const parametres = useSearchParams();
  const routeur = useRouter();

  const repasDefaut = entreeAModifier?.repas ?? parametres.get('repas') ?? 'dejeuner';

  const [texteLibre, setTexteLibre] = useState('');
  const [enEstimation, setEnEstimation] = useState(false);
  const [erreurEstimation, setErreurEstimation] = useState<string | null>(null);

  const [aliments, setAliments] = useState<AlimentEditable[] | null>(null);
  const [repasChoisi, setRepasChoisi] = useState(repasDefaut);
  const [enEnregistrement, setEnEnregistrement] = useState(false);
  const [erreurEnregistrement, setErreurEnregistrement] = useState<string | null>(null);

  const [libelle, setLibelle] = useState(entreeAModifier?.libelle ?? '');
  const [quantite, setQuantite] = useState(String(entreeAModifier?.quantite ?? 100));
  const [unite, setUnite] = useState(entreeAModifier?.unite ?? 'g');
  const [kcal, setKcal] = useState(entreeAModifier === null ? '' : String(entreeAModifier.kcal));
  const [proteinesG, setProteinesG] = useState(
    entreeAModifier?.proteinesG === undefined || entreeAModifier.proteinesG === null
      ? ''
      : String(entreeAModifier.proteinesG),
  );
  const [glucidesG, setGlucidesG] = useState(
    entreeAModifier?.glucidesG === undefined || entreeAModifier.glucidesG === null
      ? ''
      : String(entreeAModifier.glucidesG),
  );
  const [lipidesG, setLipidesG] = useState(
    entreeAModifier?.lipidesG === undefined || entreeAModifier.lipidesG === null
      ? ''
      : String(entreeAModifier.lipidesG),
  );

  async function action(_precedent: Resultat, donnees: FormData): Promise<Resultat> {
    const resultat = await enregistrerEntree({
      // Édition : même id que l'entrée d'origine, l'upsert la met à
      // jour. Création : UUID généré ici — rejouer l'envoi après une
      // coupure réseau produit alors un upsert, jamais un doublon
      // (spec §8).
      id: entreeAModifier?.id ?? crypto.randomUUID(),
      date: entreeAModifier?.date ?? donnees.get('date'),
      libelle: donnees.get('libelle'),
      repas: donnees.get('repas'),
      quantite: Number(donnees.get('quantite')),
      unite: donnees.get('unite'),
      kcal: Number(donnees.get('kcal')),
      proteinesG: nombreOuNull(donnees.get('proteinesG')),
      glucidesG: nombreOuNull(donnees.get('glucidesG')),
      lipidesG: nombreOuNull(donnees.get('lipidesG')),
      source: donnees.get('source') || 'rapide',
    });

    // Corriger une entrée est un geste isolé, contrairement à la saisie
    // rapide d'affilée : revenir à Aujourd'hui est ici la confirmation
    // la plus utile, comme pour Programme et Pesée.
    if (resultat.ok && entreeAModifier !== null) {
      routeur.push('/aujourdhui');
    }

    return resultat;
  }

  const [etat, envoyer, enCours] = useActionState(action, ETAT_INITIAL);
  const champs = etat.ok ? undefined : etat.champs;

  async function lancerEstimation() {
    setEnEstimation(true);
    setErreurEstimation(null);
    setErreurEnregistrement(null);

    const resultat = await estimerRepasDecrit(texteLibre);

    if (!resultat.succes) {
      setErreurEstimation(resultat.erreur);
      setEnEstimation(false);
      return;
    }

    setAliments(resultat.donnees.map(versEditable));
    setEnEstimation(false);
  }

  function modifierAliment(cle: string, champ: keyof AlimentEditable, valeur: string) {
    setAliments((precedent) =>
      precedent === null
        ? null
        : precedent.map((a) => (a.cle === cle ? { ...a, [champ]: valeur } : a)),
    );
  }

  function retirerAliment(cle: string) {
    setAliments((precedent) => {
      if (precedent === null) return null;
      const reste = precedent.filter((a) => a.cle !== cle);
      return reste.length === 0 ? null : reste;
    });
  }

  async function enregistrerAliments() {
    if (aliments === null) return;
    setEnEnregistrement(true);
    setErreurEnregistrement(null);

    for (const a of aliments) {
      const resultat = await enregistrerEntree({
        id: crypto.randomUUID(),
        date: aujourdhuiIso(),
        libelle: a.libelle,
        repas: repasChoisi,
        quantite: Number(a.quantite),
        unite: a.unite,
        kcal: Number(a.kcal),
        proteinesG: nombreOuNull(a.proteinesG),
        glucidesG: nombreOuNull(a.glucidesG),
        lipidesG: nombreOuNull(a.lipidesG),
        source: 'estimation_ia',
      });

      if (!resultat.ok) {
        setErreurEnregistrement(`« ${a.libelle} » : ${resultat.erreur}`);
        setEnEnregistrement(false);
        return;
      }
    }

    setEnEnregistrement(false);
    routeur.push('/aujourdhui');
  }

  return (
    <>
      {entreeAModifier === null && (
        <Carte className="mb-4 entree-douce" style={delaiEntree(0)}>
          <label htmlFor="texteLibre" className="libelle">
            Décrire ce que vous avez mangé
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="texteLibre"
              value={texteLibre}
              onChange={(e) => {
                setTexteLibre(e.target.value);
              }}
              placeholder="Ex. un sandwich jambon-beurre et une pomme"
              className="chiffre min-h-11 flex-1 rounded-lg border border-trait bg-surface px-3 py-2 text-base text-graphite"
            />
            <BoutonDictee onTranscription={setTexteLibre} />
          </div>
          <Bouton
            variante="discret"
            className="mt-2"
            disabled={enEstimation || texteLibre.trim().length < 3}
            onClick={() => {
              void lancerEstimation();
            }}
          >
            {enEstimation ? 'Estimation…' : 'Estimer avec l’IA'}
          </Bouton>
          {erreurEstimation !== null && (
            <p className="mt-2 text-sm text-ardoise">{erreurEstimation}</p>
          )}
          <p className="mt-2 text-sm text-ardoise">
            Pour un aliment simple ou une marque connue, mieux vaut la recherche du catalogue
            quand elle sera disponible — plus précise qu’une estimation.
          </p>
        </Carte>
      )}

      {aliments !== null ? (
        <div className="flex flex-col gap-4">
          <Carte className="entree-douce" style={delaiEntree(0)}>
            <Selecteur
              nom="repas"
              libelle="Repas"
              options={OPTIONS_REPAS}
              value={repasChoisi}
              onChange={setRepasChoisi}
            />
            <p className="mt-2 text-sm text-ardoise">
              Valeurs estimées par IA à partir de votre description — vérifiez chaque aliment
              avant d’enregistrer, ce n’est pas une valeur mesurée.
            </p>
          </Carte>

          {aliments.map((a, index) => (
            <Carte key={a.cle} className="entree-douce" style={delaiEntree(index + 1)}>
              <div className="flex flex-col gap-4">
                <Champ
                  nom={`libelle-${a.cle}`}
                  libelle="Aliment"
                  required
                  autoComplete="off"
                  value={a.libelle}
                  onChange={(e) => {
                    modifierAliment(a.cle, 'libelle', e.target.value);
                  }}
                />

                <div className="grid grid-cols-2 gap-3">
                  <Champ
                    nom={`quantite-${a.cle}`}
                    libelle="Quantité"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    required
                    value={a.quantite}
                    onChange={(e) => {
                      modifierAliment(a.cle, 'quantite', e.target.value);
                    }}
                  />
                  <Champ
                    nom={`unite-${a.cle}`}
                    libelle="Unité"
                    value={a.unite}
                    onChange={(e) => {
                      modifierAliment(a.cle, 'unite', e.target.value);
                    }}
                  />
                </div>

                <Champ
                  nom={`kcal-${a.cle}`}
                  libelle="Calories (kcal)"
                  type="number"
                  inputMode="decimal"
                  step="1"
                  min="0"
                  required
                  value={a.kcal}
                  onChange={(e) => {
                    modifierAliment(a.cle, 'kcal', e.target.value);
                  }}
                />

                <fieldset className="grid grid-cols-3 gap-3">
                  <legend className="libelle mb-1">Macronutriments</legend>
                  <Champ
                    nom={`proteinesG-${a.cle}`}
                    libelle="Prot. (g)"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    value={a.proteinesG}
                    onChange={(e) => {
                      modifierAliment(a.cle, 'proteinesG', e.target.value);
                    }}
                  />
                  <Champ
                    nom={`glucidesG-${a.cle}`}
                    libelle="Gluc. (g)"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    value={a.glucidesG}
                    onChange={(e) => {
                      modifierAliment(a.cle, 'glucidesG', e.target.value);
                    }}
                  />
                  <Champ
                    nom={`lipidesG-${a.cle}`}
                    libelle="Lip. (g)"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    value={a.lipidesG}
                    onChange={(e) => {
                      modifierAliment(a.cle, 'lipidesG', e.target.value);
                    }}
                  />
                </fieldset>

                <Bouton
                  variante="discret"
                  onClick={() => {
                    retirerAliment(a.cle);
                  }}
                >
                  Retirer cet aliment
                </Bouton>
              </div>
            </Carte>
          ))}

          {erreurEnregistrement !== null && <Alerte>{erreurEnregistrement}</Alerte>}

          <Bouton
            disabled={enEnregistrement}
            onClick={() => {
              void enregistrerAliments();
            }}
          >
            {enEnregistrement
              ? 'Enregistrement…'
              : `Enregistrer ${aliments.length > 1 ? `les ${aliments.length} aliments` : 'l’aliment'}`}
          </Bouton>

          <Bouton
            variante="discret"
            onClick={() => {
              setAliments(null);
            }}
          >
            Revenir à la saisie manuelle
          </Bouton>
        </div>
      ) : (
        <Carte className="entree-douce" style={delaiEntree(1)}>
          <form action={envoyer} className="flex flex-col gap-4" aria-busy={enCours}>
            {entreeAModifier === null && (
              <input type="hidden" name="date" value={aujourdhuiIso()} />
            )}
            <input type="hidden" name="source" value="rapide" readOnly />

            <Champ
              nom="libelle"
              libelle="Aliment"
              required
              erreurs={champs?.libelle}
              autoComplete="off"
              value={libelle}
              onChange={(e) => {
                setLibelle(e.target.value);
              }}
            />

            <Selecteur
              nom="repas"
              libelle="Repas"
              options={OPTIONS_REPAS}
              defaultValue={repasDefaut}
              erreurs={champs?.repas}
            />

            <div className="grid grid-cols-2 gap-3">
              <Champ
                nom="quantite"
                libelle="Quantité"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                required
                erreurs={champs?.quantite}
                value={quantite}
                onChange={(e) => {
                  setQuantite(e.target.value);
                }}
              />
              <Champ
                nom="unite"
                libelle="Unité"
                value={unite}
                onChange={(e) => {
                  setUnite(e.target.value);
                }}
              />
            </div>

            <Champ
              nom="kcal"
              libelle="Calories (kcal)"
              type="number"
              inputMode="decimal"
              step="1"
              min="0"
              required
              erreurs={champs?.kcal}
              value={kcal}
              onChange={(e) => {
                setKcal(e.target.value);
              }}
            />

            <fieldset className="grid grid-cols-3 gap-3">
              <legend className="libelle mb-1">Macronutriments (facultatif)</legend>
              <Champ
                nom="proteinesG"
                libelle="Prot. (g)"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={proteinesG}
                onChange={(e) => {
                  setProteinesG(e.target.value);
                }}
              />
              <Champ
                nom="glucidesG"
                libelle="Gluc. (g)"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={glucidesG}
                onChange={(e) => {
                  setGlucidesG(e.target.value);
                }}
              />
              <Champ
                nom="lipidesG"
                libelle="Lip. (g)"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={lipidesG}
                onChange={(e) => {
                  setLipidesG(e.target.value);
                }}
              />
            </fieldset>

            {!etat.ok && <Alerte>{etat.erreur}</Alerte>}

            <Bouton type="submit" disabled={enCours}>
              {enCours
                ? 'Enregistrement…'
                : entreeAModifier === null
                  ? 'Enregistrer'
                  : 'Enregistrer les modifications'}
            </Bouton>

            <Bouton
              variante="discret"
              onClick={() => {
                routeur.push('/aujourdhui');
              }}
            >
              Retour
            </Bouton>
          </form>
        </Carte>
      )}
    </>
  );
}

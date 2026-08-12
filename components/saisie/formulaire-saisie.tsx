'use client';

import { useActionState, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { enregistrerEntree } from '@/lib/actions/journal';
import type { Resultat } from '@/lib/actions/journal';
import { estimerRepasDecrit } from '@/lib/actions/estimation';
import { aujourdhuiIso } from '@/lib/dates-app';
import { Alerte, Bouton, Carte, Champ, Selecteur } from '@/components/ui/primitives';

const ETAT_INITIAL: Resultat = { ok: true };

const REPAS = [
  { valeur: 'petit_dejeuner', texte: 'Petit-déjeuner' },
  { valeur: 'dejeuner', texte: 'Déjeuner' },
  { valeur: 'diner', texte: 'Dîner' },
  { valeur: 'collation', texte: 'Collation' },
] as const;

function nombreOuNull(valeur: FormDataEntryValue | null): number | null {
  if (valeur === null || valeur === '') return null;
  return Number(valeur);
}

async function action(_precedent: Resultat, donnees: FormData): Promise<Resultat> {
  return enregistrerEntree({
    // UUID généré par le client : rejouer l'envoi après une coupure
    // réseau produit un upsert, jamais un doublon (spec §8).
    id: crypto.randomUUID(),
    date: donnees.get('date'),
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
}

/**
 * Saisie rapide.
 *
 * Deux chemins vers les mêmes champs : les remplir à la main, ou décrire
 * le repas en une phrase et laisser une IA proposer des valeurs. Le
 * second ne remplace pas la recherche dans un vrai catalogue (CIQUAL,
 * Open Food Facts — phase 2) : quand l'aliment est connu, la base donne
 * un chiffre exact. L'IA n'intervient qu'en dernier recours, pour les
 * plats maison qu'aucune base ne référencera jamais, et le dit
 * explicitement — jamais présentée comme une valeur sûre.
 */
export function FormulaireSaisie() {
  const [etat, envoyer, enCours] = useActionState(action, ETAT_INITIAL);
  const parametres = useSearchParams();
  const routeur = useRouter();
  const champs = etat.ok ? undefined : etat.champs;

  const repasDefaut = parametres.get('repas') ?? 'dejeuner';

  const [texteLibre, setTexteLibre] = useState('');
  const [enEstimation, setEnEstimation] = useState(false);
  const [erreurEstimation, setErreurEstimation] = useState<string | null>(null);
  const [estimeParIa, setEstimeParIa] = useState(false);

  const [libelle, setLibelle] = useState('');
  const [quantite, setQuantite] = useState('100');
  const [unite, setUnite] = useState('g');
  const [kcal, setKcal] = useState('');
  const [proteinesG, setProteinesG] = useState('');
  const [glucidesG, setGlucidesG] = useState('');
  const [lipidesG, setLipidesG] = useState('');

  async function lancerEstimation() {
    setEnEstimation(true);
    setErreurEstimation(null);

    const resultat = await estimerRepasDecrit(texteLibre);

    if (!resultat.succes) {
      setErreurEstimation(resultat.erreur);
      setEnEstimation(false);
      return;
    }

    const { donnees } = resultat;
    setLibelle(donnees.libelle);
    setQuantite(String(Math.round(donnees.quantiteG)));
    setUnite('g');
    setKcal(String(Math.round(donnees.kcal)));
    setProteinesG(String(Math.round(donnees.proteinesG * 10) / 10));
    setGlucidesG(String(Math.round(donnees.glucidesG * 10) / 10));
    setLipidesG(String(Math.round(donnees.lipidesG * 10) / 10));
    setEstimeParIa(true);
    setEnEstimation(false);
  }

  return (
    <>
      <Carte className="mb-4">
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

      <Carte>
        <form action={envoyer} className="flex flex-col gap-4">
          <input type="hidden" name="date" value={aujourdhuiIso()} />
          <input type="hidden" name="source" value={estimeParIa ? 'estimation_ia' : 'rapide'} readOnly />

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
            options={REPAS}
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

          {estimeParIa && (
            <p className="text-sm text-ardoise">
              Valeurs estimées par IA à partir de votre description — vérifiez avant
              d’enregistrer, ce n’est pas une valeur mesurée.
            </p>
          )}

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
            {enCours ? 'Enregistrement…' : 'Enregistrer'}
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
    </>
  );
}

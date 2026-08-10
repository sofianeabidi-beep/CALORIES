'use client';

import { useActionState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { enregistrerEntree } from '@/lib/actions/journal';
import type { Resultat } from '@/lib/actions/journal';
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
    source: 'rapide',
  });
}

/**
 * Saisie rapide.
 *
 * Phase 1 : saisie manuelle uniquement. La recherche dans le catalogue,
 * le scan de code-barres, les favoris et les repas enregistrés arrivent
 * en phase 2 — c'est là que se gagnera l'objectif des 10 secondes.
 */
export function FormulaireSaisie() {
  const [etat, envoyer, enCours] = useActionState(action, ETAT_INITIAL);
  const parametres = useSearchParams();
  const routeur = useRouter();
  const champs = etat.ok ? undefined : etat.champs;

  const repasDefaut = parametres.get('repas') ?? 'dejeuner';

  return (
    <>
      <Carte>
        <form action={envoyer} className="flex flex-col gap-4">
          <input type="hidden" name="date" value={aujourdhuiIso()} />

          <Champ
            nom="libelle"
            libelle="Aliment"
            required
            erreurs={champs?.libelle}
            autoComplete="off"
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
              defaultValue={100}
              required
              erreurs={champs?.quantite}
            />
            <Champ nom="unite" libelle="Unité" defaultValue="g" erreurs={champs?.unite} />
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
            />
            <Champ
              nom="glucidesG"
              libelle="Gluc. (g)"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
            />
            <Champ
              nom="lipidesG"
              libelle="Lip. (g)"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
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

'use client';

import { useActionState } from 'react';
import { enregistrerProgramme } from '@/lib/actions/compte';
import type { Resultat } from '@/lib/actions/journal';
import { aujourdhuiIso } from '@/lib/dates-app';
import { Alerte, Bouton, Carte, Champ, Selecteur } from '@/components/ui/primitives';

const ETAT_INITIAL: Resultat = { ok: true };

function nombreOuNull(valeur: FormDataEntryValue | null): number | null {
  if (valeur === null || valeur === '') return null;
  return Number(valeur);
}

async function action(_precedent: Resultat, donnees: FormData): Promise<Resultat> {
  return enregistrerProgramme({
    libelle: donnees.get('libelle') || undefined,
    type: donnees.get('type'),
    dateDebut: donnees.get('dateDebut'),
    poidsDepartKg: Number(donnees.get('poidsDepartKg')),
    poidsCibleKg: nombreOuNull(donnees.get('poidsCibleKg')),
    allureCibleKgSemaine: nombreOuNull(donnees.get('allureCibleKgSemaine')),
    objectifKcal: nombreOuNull(donnees.get('objectifKcal')),
  });
}

export default function Programme() {
  const [etat, envoyer, enCours] = useActionState(action, ETAT_INITIAL);
  const champs = etat.ok ? undefined : etat.champs;

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <header className="mb-4">
        <h1 className="text-xl font-light text-graphite">Programme</h1>
        <p className="mt-1 text-sm text-ardoise">
          Les cumuls se calculent par programme, jamais depuis l’inscription. En créer un
          nouveau clôt le précédent et repart de zéro.
        </p>
      </header>

      <Carte>
        <form action={envoyer} className="flex flex-col gap-4">
          <Champ nom="libelle" libelle="Nom (facultatif)" erreurs={champs?.libelle} />

          <Selecteur
            nom="type"
            libelle="Type"
            options={[
              { valeur: 'deficit', texte: 'Déficit — perdre du poids' },
              { valeur: 'surplus', texte: 'Surplus — prendre du poids' },
              { valeur: 'maintien', texte: 'Maintien — stabiliser' },
            ]}
            erreurs={champs?.type}
          />

          <Champ
            nom="dateDebut"
            libelle="Date de début"
            type="date"
            defaultValue={aujourdhuiIso()}
            required
            erreurs={champs?.dateDebut}
          />

          <Champ
            nom="poidsDepartKg"
            libelle="Poids de départ (kg)"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="30"
            max="400"
            required
            erreurs={champs?.poidsDepartKg}
          />

          <Champ
            nom="poidsCibleKg"
            libelle="Poids cible (kg, facultatif)"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="30"
            max="400"
            erreurs={champs?.poidsCibleKg}
          />

          <Champ
            nom="allureCibleKgSemaine"
            libelle="Allure visée (kg/semaine, négatif pour perdre)"
            type="number"
            inputMode="decimal"
            step="0.05"
            erreurs={champs?.allureCibleKgSemaine}
          />

          <Champ
            nom="objectifKcal"
            libelle="Objectif calorique (kcal, facultatif)"
            type="number"
            inputMode="numeric"
            step="10"
            erreurs={champs?.objectifKcal}
          />

          <p className="text-sm text-ardoise">
            Certaines valeurs sont bornées : l’objectif calorique ne descend pas sous
            1 200 kcal pour une femme ou 1 500 pour un homme, le poids cible reste au-dessus
            d’un IMC de 18,5, et l’allure ne dépasse pas 1 % du poids par semaine.
          </p>

          {!etat.ok && <Alerte>{etat.erreur}</Alerte>}

          <Bouton type="submit" disabled={enCours}>
            {enCours ? 'Enregistrement…' : 'Enregistrer le programme'}
          </Bouton>
        </form>
      </Carte>
    </main>
  );
}

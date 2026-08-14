'use client';

import { useActionState, useState } from 'react';
import { enregistrerProgramme } from '@/lib/actions/compte';
import type { Resultat } from '@/lib/actions/journal';
import { aujourdhuiIso } from '@/lib/dates-app';
import { differenceJours, verifierAllure } from '@/lib/calcul';
import { Alerte, Bouton, Carte, Champ, Selecteur } from '@/components/ui/primitives';

const ETAT_INITIAL: Resultat = { ok: true };

const deuxDecimales = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function nombreOuNull(valeur: FormDataEntryValue | null): number | null {
  if (valeur === null || valeur === '') return null;
  return Number(valeur);
}

/**
 * Rythme nécessaire pour atteindre `poidsCibleKg` à `dateCible`, à la
 * place d'un kg/semaine saisi à la main : personne ne sait
 * spontanément ce que représente « -0,4 kg/semaine et négatif pour
 * perdre », tout le monde sait ce que représente une date.
 *
 * `null` tant qu'il manque poids de départ, poids cible ou date cible,
 * ou si la date cible ne suit pas la date de début — rien à calculer,
 * pas une valeur à deviner.
 */
function calculerAllure(entree: {
  poidsDepartKg: number | null;
  poidsCibleKg: number | null;
  dateDebut: string;
  dateCible: string;
}): number | null {
  const { poidsDepartKg, poidsCibleKg, dateDebut, dateCible } = entree;
  if (poidsDepartKg === null || poidsCibleKg === null || dateCible === '') return null;
  const jours = differenceJours(dateDebut, dateCible);
  if (jours <= 0) return null;
  return ((poidsCibleKg - poidsDepartKg) / jours) * 7;
}

export default function Programme() {
  const [dateDebut, setDateDebut] = useState(aujourdhuiIso());
  const [poidsDepartKg, setPoidsDepartKg] = useState('');
  const [poidsCibleKg, setPoidsCibleKg] = useState('');
  const [dateCible, setDateCible] = useState('');

  const poidsDepartKgNum = poidsDepartKg === '' ? null : Number(poidsDepartKg);
  const poidsCibleKgNum = poidsCibleKg === '' ? null : Number(poidsCibleKg);
  const allureCalculee = calculerAllure({
    poidsDepartKg: poidsDepartKgNum,
    poidsCibleKg: poidsCibleKgNum,
    dateDebut,
    dateCible,
  });
  const controleAllure =
    allureCalculee === null
      ? null
      : verifierAllure({
          allureKgSemaine: allureCalculee,
          poidsActuelKg: poidsDepartKgNum ?? 0,
        });

  async function action(_precedent: Resultat, donnees: FormData): Promise<Resultat> {
    return enregistrerProgramme({
      libelle: donnees.get('libelle') || undefined,
      type: donnees.get('type'),
      dateDebut: donnees.get('dateDebut'),
      tailleCm: Number(donnees.get('tailleCm')),
      poidsDepartKg: Number(donnees.get('poidsDepartKg')),
      poidsCibleKg: nombreOuNull(donnees.get('poidsCibleKg')),
      allureCibleKgSemaine: allureCalculee,
      objectifKcal: nombreOuNull(donnees.get('objectifKcal')),
    });
  }

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
        <form action={envoyer} className="flex flex-col gap-4" aria-busy={enCours}>
          <Champ nom="libelle" libelle="Pseudo (facultatif)" erreurs={champs?.libelle} />

          <Selecteur
            nom="type"
            libelle="Objectif"
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
            value={dateDebut}
            onChange={(e) => {
              setDateDebut(e.target.value);
            }}
            required
            erreurs={champs?.dateDebut}
          />

          <div className="border-t border-trait" aria-hidden="true" />

          <Champ
            nom="tailleCm"
            libelle="Taille (cm)"
            type="number"
            inputMode="numeric"
            min="100"
            max="250"
            required
            erreurs={champs?.tailleCm}
          />

          <Champ
            nom="poidsDepartKg"
            libelle="Poids de départ (kg)"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="30"
            max="400"
            value={poidsDepartKg}
            onChange={(e) => {
              setPoidsDepartKg(e.target.value);
            }}
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
            value={poidsCibleKg}
            onChange={(e) => {
              setPoidsCibleKg(e.target.value);
            }}
            erreurs={champs?.poidsCibleKg}
          />

          <div className="border-t border-trait" aria-hidden="true" />

          <Champ
            nom="dateCible"
            libelle="Objectif atteint pour quand ? (facultatif)"
            type="date"
            min={dateDebut}
            value={dateCible}
            onChange={(e) => {
              setDateCible(e.target.value);
            }}
          />

          <p className="text-sm text-ardoise">
            {poidsCibleKgNum === null
              ? 'Renseignez un poids cible pour calculer le rythme nécessaire.'
              : allureCalculee === null
                ? 'Choisissez une date de fin postérieure à la date de début.'
                : `Cela représente un rythme de ${deuxDecimales.format(Math.abs(allureCalculee))} kg par semaine, ${
                    allureCalculee <= 0 ? 'en perte' : 'en prise'
                  }.`}
          </p>

          {controleAllure !== null && !controleAllure.conforme && (
            <Alerte>
              Ce rythme dépasse le maximum recommandé pour votre poids (
              {deuxDecimales.format(controleAllure.allureMaxKgSemaine)} kg/semaine) — choisissez
              une date plus éloignée.
            </Alerte>
          )}

          {champs?.allureCibleKgSemaine !== undefined && (
            <Alerte>{champs.allureCibleKgSemaine.join(' ')}</Alerte>
          )}

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

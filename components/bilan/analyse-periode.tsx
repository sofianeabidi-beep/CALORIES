'use client';

import { useState } from 'react';
import { analyserPeriodeAction } from '@/lib/actions/analyse-periode';
import type { AnalysePeriode } from '@/lib/ia/analyse-bilan-periode';
import {
  ajouterJours,
  calculerCompletude,
  cumulerDeficit,
  differenceJours,
  estDansPlage,
  tendancePoids,
  type JourneeCalculee,
  type PeseeLissee,
} from '@/lib/calcul';
import { aujourdhuiIso } from '@/lib/dates-app';
import { Bascule, Bouton, Carte } from '@/components/ui/primitives';

type Preset = '30j' | '90j' | 'personnalise';

const PRESETS: readonly { valeur: Preset; texte: string }[] = [
  { valeur: '30j', texte: '30 derniers jours' },
  { valeur: '90j', texte: '3 derniers mois' },
  { valeur: 'personnalise', texte: 'Personnalisé' },
];

/**
 * Sélection d'une période et analyse par IA.
 *
 * Les statistiques (complétude, déficit cumulé, rythme) sont calculées
 * ici, côté client, avec les mêmes fonctions pures que le reste de
 * l'application — `lib/calcul/` tourne aussi bien dans le navigateur que
 * sur le serveur (spec §8). Seul le résumé chiffré part vers l'IA,
 * jamais les journées ou pesées brutes.
 */
export function AnalysePeriode({
  journees,
  pesees,
}: {
  journees: readonly JourneeCalculee[];
  pesees: readonly PeseeLissee[];
}) {
  const [preset, setPreset] = useState<Preset>('30j');
  const [dateDebutPerso, setDateDebutPerso] = useState(ajouterJours(aujourdhuiIso(), -29));
  const [dateFinPerso, setDateFinPerso] = useState(aujourdhuiIso());
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<AnalysePeriode | null>(null);

  function choisirPreset(valeur: string) {
    setPreset(valeur as Preset);
    setResultat(null);
    setErreur(null);
  }

  function plagePreset(): { dateDebut: string; dateFin: string } {
    const aujourdhui = aujourdhuiIso();
    if (preset === '30j') return { dateDebut: ajouterJours(aujourdhui, -29), dateFin: aujourdhui };
    if (preset === '90j') return { dateDebut: ajouterJours(aujourdhui, -89), dateFin: aujourdhui };
    return { dateDebut: dateDebutPerso, dateFin: dateFinPerso };
  }

  async function lancerAnalyse() {
    const { dateDebut, dateFin } = plagePreset();

    if (dateDebut > dateFin) {
      setErreur('La date de début doit précéder la date de fin.');
      return;
    }

    setEnCours(true);
    setErreur(null);
    setResultat(null);

    const journeesPeriode = journees.filter((j) => estDansPlage(j.date, dateDebut, dateFin));
    const completude = calculerCompletude(journeesPeriode);
    const cumul = cumulerDeficit(journeesPeriode);
    const tendance = tendancePoids({
      pesees,
      dateFin,
      joursFenetre: differenceJours(dateDebut, dateFin) + 1,
    });

    const resultatAction = await analyserPeriodeAction({
      dateDebut,
      dateFin,
      completudeTaux: completude.taux,
      joursRenseignes: completude.joursRenseignes,
      joursTotal: completude.joursTotal,
      deficitCumuleKcal: cumul.deficitCumuleKcal,
      kgTheoriques: cumul.kgTheoriques,
      tendanceKgSemaine: tendance?.kgParSemaine ?? null,
      poidsDebutKg: tendance?.poidsDebutKg ?? null,
      poidsFinKg: tendance?.poidsFinKg ?? null,
    });

    if (!resultatAction.succes) {
      setErreur(resultatAction.erreur);
      setEnCours(false);
      return;
    }

    setResultat(resultatAction.donnees);
    setEnCours(false);
  }

  return (
    <Carte className="mt-4">
      <p className="libelle">Analyser une période</p>

      <div className="mt-2">
        <Bascule options={PRESETS} valeur={preset} onChange={choisirPreset} />
      </div>

      {preset === 'personnalise' && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="dateDebutPerso" className="libelle">
              Du
            </label>
            <input
              id="dateDebutPerso"
              type="date"
              value={dateDebutPerso}
              max={dateFinPerso}
              onChange={(e) => {
                setDateDebutPerso(e.target.value);
              }}
              className="min-h-11 rounded-lg border border-trait bg-surface px-3 py-2 text-base text-graphite"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="dateFinPerso" className="libelle">
              Au
            </label>
            <input
              id="dateFinPerso"
              type="date"
              value={dateFinPerso}
              min={dateDebutPerso}
              max={aujourdhuiIso()}
              onChange={(e) => {
                setDateFinPerso(e.target.value);
              }}
              className="min-h-11 rounded-lg border border-trait bg-surface px-3 py-2 text-base text-graphite"
            />
          </div>
        </div>
      )}

      <Bouton
        variante="discret"
        className="mt-3"
        disabled={enCours}
        onClick={() => {
          void lancerAnalyse();
        }}
      >
        {enCours ? 'Analyse…' : 'Analyser'}
      </Bouton>

      {erreur !== null && <p className="mt-2 text-sm text-ardoise">{erreur}</p>}

      {resultat !== null && (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-sm text-graphite">{resultat.resume}</p>

          <div>
            <p className="libelle">Constats</p>
            <ul className="mt-1 flex flex-col gap-1">
              {resultat.constats.map((c) => (
                <li key={c} className="text-sm text-ardoise">
                  • {c}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="libelle">Axes d’amélioration</p>
            <ul className="mt-1 flex flex-col gap-1">
              {resultat.axesAmelioration.map((a) => (
                <li key={a} className="text-sm text-ardoise">
                  • {a}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-ardoise">
            Analyse générée par IA à partir de vos chiffres — une lecture parmi d’autres,
            pas un avis médical.
          </p>
        </div>
      )}
    </Carte>
  );
}

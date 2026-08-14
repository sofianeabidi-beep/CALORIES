'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { genererPlanificationAction } from '@/lib/actions/planification';
import { Bascule, Bouton, Carte, Libelle } from '@/components/ui/primitives';

type NbRepas = '3' | '4';
type ContrainteTemps = 'rapide' | 'elabore';

const OPTIONS_NB_REPAS: readonly { valeur: NbRepas; texte: string }[] = [
  { valeur: '3', texte: '3 repas/jour' },
  { valeur: '4', texte: '4 repas/jour' },
];

const OPTIONS_TEMPS: readonly { valeur: ContrainteTemps; texte: string }[] = [
  { valeur: 'rapide', texte: 'Rapide' },
  { valeur: 'elabore', texte: 'J’ai le temps' },
];

/**
 * Déclencheur de génération — nombre de repas/jour et contrainte de
 * temps choisis ici plutôt qu'en réglage fixe, à la demande explicite de
 * l'utilisateur (« laissez le choix dans la configuration »).
 *
 * Après succès, `router.refresh()` plutôt qu'une navigation : la page
 * (Server Component) relit `lirePlanificationSemaine` et bascule
 * naturellement de ce formulaire vers l'affichage du plan, sans dupliquer
 * l'état ici.
 */
export function Generateur({
  objectifKcalJour,
  regeneration = false,
}: {
  objectifKcalJour: number;
  regeneration?: boolean;
}) {
  const routeur = useRouter();
  const [nbRepas, setNbRepas] = useState<NbRepas>('3');
  const [contrainteTemps, setContrainteTemps] = useState<ContrainteTemps>('rapide');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function generer() {
    setEnCours(true);
    setErreur(null);

    const resultat = await genererPlanificationAction({
      objectifKcalJour,
      nbRepasJour: Number(nbRepas) as 3 | 4,
      contrainteTemps,
    });

    if (!resultat.ok) {
      setErreur(resultat.erreur);
      setEnCours(false);
      return;
    }

    routeur.refresh();
  }

  if (regeneration) {
    return (
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <Bascule options={OPTIONS_NB_REPAS} valeur={nbRepas} onChange={(v) => setNbRepas(v as NbRepas)} />
          <Bascule
            options={OPTIONS_TEMPS}
            valeur={contrainteTemps}
            onChange={(v) => setContrainteTemps(v as ContrainteTemps)}
          />
        </div>
        <Bouton
          variante="discret"
          disabled={enCours}
          onClick={() => {
            void generer();
          }}
        >
          {enCours ? 'Génération…' : 'Régénérer la semaine'}
        </Bouton>
        {erreur !== null && <p className="text-sm text-ardoise">{erreur}</p>}
      </div>
    );
  }

  return (
    <Carte>
      <Libelle>Planifier ma semaine</Libelle>
      <p className="mt-2 text-sm text-ardoise">
        Un agent IA propose un plan de repas pour toute la semaine, autour de votre objectif
        calorique, et prépare la liste de courses correspondante.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <Bascule
          options={OPTIONS_NB_REPAS}
          valeur={nbRepas}
          onChange={(v) => setNbRepas(v as NbRepas)}
          pleineLargeur
        />
        <Bascule
          options={OPTIONS_TEMPS}
          valeur={contrainteTemps}
          onChange={(v) => setContrainteTemps(v as ContrainteTemps)}
          pleineLargeur
        />
      </div>

      <Bouton
        className="mt-3"
        disabled={enCours}
        onClick={() => {
          void generer();
        }}
      >
        {enCours ? 'Génération…' : 'Planifier ma semaine'}
      </Bouton>

      {erreur !== null && <p className="mt-2 text-sm text-ardoise">{erreur}</p>}
    </Carte>
  );
}

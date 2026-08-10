'use client';

import { useActionState } from 'react';
import { enregistrerPesee } from '@/lib/actions/journal';
import type { Resultat } from '@/lib/actions/journal';
import { aujourdhuiIso } from '@/lib/dates-app';
import { Alerte, Bouton, Carte, Champ } from '@/components/ui/primitives';

const ETAT_INITIAL: Resultat = { ok: true };

async function action(_precedent: Resultat, donnees: FormData): Promise<Resultat> {
  return enregistrerPesee({
    id: crypto.randomUUID(),
    date: donnees.get('date'),
    poidsKg: Number(donnees.get('poidsKg')),
    // La pesée est marquée aberrante par le moteur, jamais rejetée.
    // L'utilisateur confirme ensuite si la valeur est réelle.
    confirmee: donnees.get('confirmee') === 'on',
    source: 'manuelle',
  });
}

export function FormulairePesee({
  poidsPrecedentKg,
}: {
  poidsPrecedentKg?: number | undefined;
}) {
  const [etat, envoyer, enCours] = useActionState(action, ETAT_INITIAL);
  const champs = etat.ok ? undefined : etat.champs;

  return (
    <Carte>
      <form action={envoyer} className="flex flex-col gap-4">
        <Champ
          nom="date"
          libelle="Date"
          type="date"
          defaultValue={aujourdhuiIso()}
          required
          erreurs={champs?.date}
        />

        <Champ
          nom="poidsKg"
          libelle="Poids (kg)"
          type="number"
          inputMode="decimal"
          step="0.1"
          min="30"
          max="400"
          defaultValue={poidsPrecedentKg}
          required
          erreurs={champs?.poidsKg}
        />

        <label className="flex items-start gap-3 text-sm text-graphite">
          <input type="checkbox" name="confirmee" className="mt-1 size-5 shrink-0" />
          <span>
            Je confirme cette valeur même si elle s’écarte nettement de ma moyenne.
          </span>
        </label>

        <p className="text-sm text-ardoise">
          C’est la moyenne sur 7 jours qui est utilisée partout, pas la pesée du matin :
          l’eau, le sel et le transit font varier la balance de plus d’un kilo sans qu’un
          gramme de masse grasse ait bougé.
        </p>

        {!etat.ok && <Alerte>{etat.erreur}</Alerte>}

        <Bouton type="submit" disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Enregistrer la pesée'}
        </Bouton>
      </form>
    </Carte>
  );
}

'use client';

import { useActionState, useState } from 'react';
import { enregistrerPrenom } from '@/lib/actions/compte';
import type { Resultat } from '@/lib/actions/journal';
import { Alerte, Bouton, Champ } from '@/components/ui/primitives';

const ETAT_INITIAL: Resultat = { ok: true };

/**
 * `useActionState` seul ne distingue pas « pas encore envoyé » de
 * « vient de réussir » (§ décisions) : les deux valent `{ ok: true }`.
 * `confirme` est le sentinel qui manque, remis à `false` à chaque envoi.
 */
export function FormulairePrenom({ prenomActuel }: { prenomActuel: string | null }) {
  const [confirme, setConfirme] = useState(false);

  async function action(_precedent: Resultat, donnees: FormData): Promise<Resultat> {
    setConfirme(false);
    const resultat = await enregistrerPrenom({ prenom: donnees.get('prenom') });
    if (resultat.ok) setConfirme(true);
    return resultat;
  }

  const [etat, envoyer, enCours] = useActionState(action, ETAT_INITIAL);
  const champs = etat.ok ? undefined : etat.champs;

  return (
    <form action={envoyer} className="mt-2 flex flex-col gap-3" aria-busy={enCours}>
      <Champ
        nom="prenom"
        libelle="Prénom"
        defaultValue={prenomActuel ?? ''}
        erreurs={champs?.prenom}
        autoComplete="given-name"
      />
      {!etat.ok && <Alerte>{etat.erreur}</Alerte>}
      <Bouton type="submit" variante="discret" disabled={enCours}>
        {enCours ? 'Enregistrement…' : 'Enregistrer'}
      </Bouton>
      {confirme && <p className="text-sm text-ardoise">Enregistré.</p>}
    </form>
  );
}

'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { seConnecter } from '@/lib/actions/compte';
import type { Resultat } from '@/lib/actions/journal';
import { Alerte, Bouton, Champ } from '@/components/ui/primitives';

const ETAT_INITIAL: Resultat = { ok: true };

async function action(_precedent: Resultat, donnees: FormData): Promise<Resultat> {
  return seConnecter({
    email: donnees.get('email'),
    motDePasse: donnees.get('motDePasse'),
  });
}

export default function Connexion() {
  const [etat, envoyer, enCours] = useActionState(action, ETAT_INITIAL);
  const champs = etat.ok ? undefined : etat.champs;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-light text-graphite">Caloryes</h1>
        <p className="mt-1 text-sm text-ardoise">
          Où j’en suis vraiment, et est-ce que ça marche.
        </p>
      </header>

      <form action={envoyer} className="flex flex-col gap-4">
        <Champ
          nom="email"
          libelle="Adresse électronique"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          erreurs={champs?.email}
        />
        <Champ
          nom="motDePasse"
          libelle="Mot de passe"
          type="password"
          autoComplete="current-password"
          required
          erreurs={champs?.motDePasse}
        />

        {!etat.ok && <Alerte>{etat.erreur}</Alerte>}

        <Bouton type="submit" disabled={enCours}>
          {enCours ? 'Connexion…' : 'Se connecter'}
        </Bouton>
      </form>

      <p className="text-center text-sm text-ardoise">
        Pas encore de compte ?{' '}
        <Link href="/inscription" className="text-deficit underline">
          Créer un compte
        </Link>
      </p>
    </main>
  );
}

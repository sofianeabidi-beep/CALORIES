'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { seConnecter } from '@/lib/actions/compte';
import type { Resultat } from '@/lib/actions/journal';
import { Alerte, Bouton, Carte, Champ } from '@/components/ui/primitives';

const ETAT_INITIAL: Resultat = { ok: true };

async function action(_precedent: Resultat, donnees: FormData): Promise<Resultat> {
  return seConnecter({
    email: donnees.get('email'),
    motDePasse: donnees.get('motDePasse'),
  });
}

/**
 * Formulaire nu : la présentation (vision, utilité, images) vit sur `/`
 * depuis que cette page-là existe. Doubler le pitch ici serait redondant
 * pour quelqu'un qui revient juste se connecter.
 */
export default function Connexion() {
  const [etat, envoyer, enCours] = useActionState(action, ETAT_INITIAL);
  const champs = etat.ok ? undefined : etat.champs;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-8">
      <header>
        <Link href="/" className="text-2xl font-light text-graphite">
          Symbio
        </Link>
        <p className="mt-1 text-sm text-ardoise">Content de vous revoir.</p>
      </header>

      <Carte>
        <form action={envoyer} className="flex flex-col gap-4" aria-busy={enCours}>
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
      </Carte>

      <p className="text-center text-sm text-ardoise">
        Pas encore de compte ?{' '}
        <Link href="/inscription" className="text-deficit underline">
          Créer un compte
        </Link>
      </p>
    </main>
  );
}

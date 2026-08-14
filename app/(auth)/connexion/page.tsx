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
 * Palette chaude figée plutôt que `var(--couleur-papier)`/`var(--couleur-graphite)` :
 * c'est un monde visuel à part, assumé — un carnet, pas un tableau de
 * bord — qui n'a pas vocation à s'inverser avec le thème système, au même
 * titre que le bandeau de marque précédent restait figé. `#5c4a30` plutôt
 * que le brun plus clair de l'aperçu initial : à ce ton-là (~4:1 sur fond
 * crème), le texte de petite taille passait sous le seuil AA — vérifié au
 * calcul, pas à l'œil.
 */
function SectionHero() {
  return (
    <section
      className="px-6 pt-14 pb-16"
      style={{ background: '#f1ece1', color: '#2b2620' }}
    >
      <p
        className="text-base italic"
        style={{ fontFamily: 'Georgia, "Iowan Old Style", serif', color: '#5c4a30' }}
      >
        Symbio
      </p>
      <h1
        className="mt-6 text-3xl leading-[1.25] font-normal text-balance"
        style={{ fontFamily: 'Georgia, "Iowan Old Style", "Times New Roman", serif' }}
      >
        Reprenez la main, <em style={{ color: '#5c4a30' }}>sans</em> compter chaque bouchée.
      </h1>
    </section>
  );
}

export default function Connexion() {
  const [etat, envoyer, enCours] = useActionState(action, ETAT_INITIAL);
  const champs = etat.ok ? undefined : etat.champs;

  return (
    <main className="flex min-h-dvh flex-col">
      <SectionHero />

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
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
      </div>
    </main>
  );
}

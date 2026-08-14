'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { sInscrire } from '@/lib/actions/compte';
import type { Resultat } from '@/lib/actions/journal';
import { Alerte, Bouton, Carte, Champ, Selecteur } from '@/components/ui/primitives';

const ETAT_INITIAL: Resultat = { ok: true };

async function action(_precedent: Resultat, donnees: FormData): Promise<Resultat> {
  return sInscrire({
    email: donnees.get('email'),
    motDePasse: donnees.get('motDePasse'),
    confirmationMotDePasse: donnees.get('confirmationMotDePasse'),
    sexe: donnees.get('sexe'),
    dateNaissance: donnees.get('dateNaissance'),
    niveauActivite: donnees.get('niveauActivite'),
    cguAcceptees: donnees.get('cguAcceptees') === 'on',
    consentementSante: donnees.get('consentementSante') === 'on',
  });
}

const NIVEAUX = [
  { valeur: 'sedentaire', texte: 'Sédentaire — travail assis, peu de marche' },
  { valeur: 'leger', texte: 'Léger — un peu d’activité, 1 à 3 fois par semaine' },
  { valeur: 'modere', texte: 'Modéré — activité régulière, 3 à 5 fois par semaine' },
  { valeur: 'soutenu', texte: 'Soutenu — activité intense, 6 à 7 fois par semaine' },
  { valeur: 'tres_soutenu', texte: 'Très soutenu — travail physique ou double séance' },
] as const;

export default function Inscription() {
  const [etat, envoyer, enCours] = useActionState(action, ETAT_INITIAL);
  const champs = etat.ok ? undefined : etat.champs;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="font-voice text-2xl text-graphite">Créer un compte</h1>
        <p className="mt-1 text-sm text-ardoise">
          Ces informations servent à estimer votre dépense énergétique de départ.
          L’application la corrigera ensuite à partir de vos données réelles.
        </p>
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
            autoComplete="new-password"
            required
            erreurs={champs?.motDePasse}
          />
          <Champ
            nom="confirmationMotDePasse"
            libelle="Confirmer le mot de passe"
            type="password"
            autoComplete="new-password"
            required
            erreurs={champs?.confirmationMotDePasse}
          />

          {/* Rupture visuelle : les champs de compte (au-dessus) se
              distinguent des champs de profil (en-dessous), à plat sinon. */}
          <div className="border-t border-trait" aria-hidden="true" />

          <Selecteur
            nom="sexe"
            libelle="Sexe"
            options={[
              { valeur: 'f', texte: 'Femme' },
              { valeur: 'h', texte: 'Homme' },
            ]}
            erreurs={champs?.sexe}
          />

          <Champ
            nom="dateNaissance"
            libelle="Date de naissance"
            type="date"
            required
            erreurs={champs?.dateNaissance}
          />

          <Selecteur
            nom="niveauActivite"
            libelle="Niveau d’activité"
            options={NIVEAUX}
            defaultValue="sedentaire"
            erreurs={champs?.niveauActivite}
          />

          {/*
            Deux cases distinctes, jamais fondues en une seule : le
            consentement au traitement de données de santé doit être
            recueilli séparément des conditions générales (RGPD art. 9).
          */}
          <fieldset className="flex flex-col gap-3 rounded-lg border border-trait p-3">
            <legend className="libelle px-1">Consentements</legend>

            <label className="flex items-start gap-3 text-sm text-graphite">
              <input
                type="checkbox"
                name="cguAcceptees"
                className="mt-1 size-5 shrink-0"
                required
              />
              <span>J’accepte les conditions générales d’utilisation.</span>
            </label>

            {champs?.cguAcceptees !== undefined && (
              <Alerte>{champs.cguAcceptees.join(' ')}</Alerte>
            )}

            <label className="flex items-start gap-3 text-sm text-graphite">
              <input
                type="checkbox"
                name="consentementSante"
                className="mt-1 size-5 shrink-0"
                required
              />
              <span>
                J’accepte que mon poids et mon alimentation, qui sont des données de santé,
                soient traités pour calculer mes indicateurs. Ces données restent dans
                l’Union européenne et ne sont transmises à aucun outil tiers.
              </span>
            </label>

            {champs?.consentementSante !== undefined && (
              <Alerte>{champs.consentementSante.join(' ')}</Alerte>
            )}
          </fieldset>

          <p className="text-sm text-ardoise">
            L’application est réservée aux personnes majeures. Elle mesure et restitue :
            elle ne donne aucun conseil médical ni nutritionnel.
          </p>

          {!etat.ok && <Alerte>{etat.erreur}</Alerte>}

          <Bouton type="submit" disabled={enCours}>
            {enCours ? 'Création…' : 'Créer le compte'}
          </Bouton>
        </form>
      </Carte>

      <p className="text-center text-sm text-ardoise">
        Déjà inscrit ?{' '}
        <Link href="/connexion" className="text-deficit underline">
          Se connecter
        </Link>
      </p>
    </main>
  );
}

'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { mettreAJourPhotoProfil } from '@/lib/actions/compte';
import { Alerte } from '@/components/ui/primitives';

/**
 * Changement de photo en un seul geste : choisir un fichier soumet
 * aussitôt le formulaire (`requestSubmit`), pas de bouton de validation
 * séparé. `router.refresh()` après succès plutôt qu'un état local pour
 * la nouvelle URL : `Identite` est un composant serveur, c'est lui qui
 * doit relire `profil.photo_url` à jour.
 */
export function PhotoProfil() {
  const routeur = useRouter();
  const formulaire = useRef<HTMLFormElement>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer(donnees: FormData) {
    setEnCours(true);
    setErreur(null);

    const resultat = await mettreAJourPhotoProfil(donnees);

    if (!resultat.ok) {
      setErreur(resultat.erreur);
      setEnCours(false);
      return;
    }

    setEnCours(false);
    routeur.refresh();
  }

  return (
    <form ref={formulaire} action={envoyer}>
      <label className="text-sm text-deficit">
        {enCours ? 'Envoi…' : 'Changer la photo'}
        <input
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={enCours}
          onChange={(e) => {
            if (e.currentTarget.files !== null && e.currentTarget.files.length > 0) {
              formulaire.current?.requestSubmit();
            }
          }}
        />
      </label>
      {erreur !== null && (
        <div className="mt-2">
          <Alerte>{erreur}</Alerte>
        </div>
      )}
    </form>
  );
}

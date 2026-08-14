import { Suspense } from 'react';
import { FormulaireSaisie } from '@/components/saisie/formulaire-saisie';
import { Carte } from '@/components/ui/primitives';

/**
 * Écran de saisie.
 *
 * Le formulaire lit `useSearchParams` pour préremplir le repas depuis
 * l'écran Aujourd'hui : Next impose alors une frontière Suspense, sans
 * quoi toute la page bascule en rendu client.
 */
export default function Saisie() {
  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <h1 className="mb-4 text-xl font-light text-graphite">Ajouter un repas</h1>

      <Suspense
        fallback={
          <Carte>
            <p className="text-sm text-ardoise">Chargement du formulaire…</p>
          </Carte>
        }
      >
        <FormulaireSaisie />
      </Suspense>
    </main>
  );
}

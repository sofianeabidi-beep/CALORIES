'use client';

import { Bouton, Carte, Libelle } from '@/components/ui/primitives';

export default function Erreur({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-8">
      <Carte>
        <Libelle>Une erreur est survenue</Libelle>
        <p className="mt-2 text-sm text-ardoise">
          Quelque chose s’est mal passé. Vos données ne sont pas perdues — réessayez.
        </p>
        <div className="mt-4">
          <Bouton
            variante="discret"
            onClick={() => {
              reset();
            }}
          >
            Réessayer
          </Bouton>
        </div>
      </Carte>
    </main>
  );
}

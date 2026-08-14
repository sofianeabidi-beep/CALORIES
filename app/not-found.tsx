import Link from 'next/link';
import { Carte, Libelle } from '@/components/ui/primitives';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-8">
      <Carte>
        <Libelle>Page introuvable</Libelle>
        <p className="mt-2 text-sm text-ardoise">
          Cette page n’existe pas ou a été déplacée.
        </p>
        <Link
          href="/aujourdhui"
          className="mt-4 flex min-h-11 items-center justify-center rounded-lg border border-trait px-4 text-base font-medium text-graphite transition duration-150 hover:border-ardoise active:bg-trait"
        >
          Retour à l’accueil
        </Link>
      </Carte>
    </main>
  );
}

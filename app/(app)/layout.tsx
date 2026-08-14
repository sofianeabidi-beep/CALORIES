import Link from 'next/link';
import type { ReactNode } from 'react';

const ONGLETS = [
  { href: '/aujourdhui', texte: 'Aujourd’hui' },
  { href: '/bilan', texte: 'Bilan' },
  { href: '/reglages', texte: 'Réglages' },
] as const;

export default function LayoutApplication({ children }: { children: ReactNode }) {
  return (
    /*
     * La réserve du bas doit dégager deux éléments superposés : la
     * navigation (56 px) et le bouton de saisie flottant, posé 80 px
     * au-dessus du bord et haut de 48 px. Sous 144 px, la dernière
     * carte de l'écran Aujourd'hui passe derrière le bouton.
     */
    <div className="min-h-dvh pb-36">
      {children}

      {/*
        Navigation en bas : l'application s'utilise d'une seule main, le
        pouce n'atteint pas le haut d'un écran de téléphone.
      */}
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 border-t border-trait bg-surface"
      >
        <ul className="mx-auto flex max-w-md">
          {ONGLETS.map((onglet) => (
            <li key={onglet.href} className="flex-1">
              <Link
                href={onglet.href}
                className="flex min-h-14 items-center justify-center px-2 text-sm text-ardoise"
              >
                {onglet.texte}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';

const DUREE_MS = 600;

/** Accélération douce en fin de course — un compteur qui s'arrête net est moins agréable qu'un qui ralentit. */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

const COULEURS = {
  neutre: 'text-graphite',
  deficit: 'text-deficit',
  surplus: 'text-surplus',
  signal: 'text-signal',
} as const;

const entier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

function formatteurDecimales(decimales: number): Intl.NumberFormat {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

/**
 * Chiffre(s) qui comptent jusqu'à leur valeur au lieu de s'afficher figés.
 *
 * Séparé de `Chiffre` plutôt que d'y ajouter l'animation : `Chiffre`
 * affiche des formes trop diverses selon l'écran (kg, %, texte « — » en
 * mode discret) pour qu'une seule mécanique d'animation s'y applique
 * proprement partout. `valeurs` accepte plusieurs nombres — utile pour
 * animer une fraction (« 210/2 226 ») dont les deux moitiés comptent en
 * même temps, jointes par `separateur`.
 *
 * Pas de prop `formatter` (fonction) : ce composant est rendu depuis des
 * pages serveur, et une fonction ne peut pas traverser la frontière
 * composant serveur → composant client — seules des données sérialisables
 * le peuvent. La mise en forme (arrondi, séparateur de milliers) reste
 * donc entièrement interne.
 *
 * Respecte `prefers-reduced-motion` explicitement : la règle globale de
 * `globals.css` réduit la *durée* des animations à quasi zéro, ce qui
 * suffirait déjà, mais sauter directement à la valeur finale évite un
 * `requestAnimationFrame` inutile pour ces utilisateurs.
 */
export function CompteurAnime({
  valeurs,
  separateur = '/',
  unite,
  ton = 'neutre',
  decimales = 0,
}: {
  valeurs: readonly number[];
  separateur?: string;
  unite?: string | undefined;
  ton?: 'neutre' | 'deficit' | 'surplus' | 'signal';
  /** Nombre de décimales affichées — 0 par défaut (kcal). Un poids en kg passe 2. */
  decimales?: number;
}) {
  const [affichees, setAffichees] = useState<readonly number[]>(() => valeurs.map(() => 0));
  const depart = useRef<readonly number[]>(valeurs.map(() => 0));

  const cle = valeurs.join(',');

  useEffect(() => {
    // Durée ramenée à 0 plutôt qu'une branche à part : le `setState` reste
    // ainsi toujours dans le callback de `requestAnimationFrame`, jamais
    // appelé de façon synchrone dans le corps de l'effet.
    const reduitMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duree = reduitMotion ? 0 : DUREE_MS;

    const origine = depart.current;
    const debut = performance.now();
    let frame: number;

    function animer(maintenant: number) {
      const t = duree === 0 ? 1 : Math.min(1, (maintenant - debut) / duree);
      const progression = easeOut(t);
      setAffichees(origine.map((v, i) => v + ((valeurs[i] as number) - v) * progression));
      if (t < 1) {
        frame = requestAnimationFrame(animer);
      } else {
        depart.current = valeurs;
      }
    }

    frame = requestAnimationFrame(animer);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `cle` résume `valeurs` par contenu, pas par référence.
  }, [cle]);

  const formatteur = decimales === 0 ? entier : formatteurDecimales(decimales);
  const texte = affichees.map((v) => formatteur.format(v)).join(separateur);

  return (
    <p className={`chiffre ${COULEURS[ton]} text-5xl leading-none font-light`}>
      {texte}
      {unite !== undefined && <span className="ml-1 text-base font-normal text-ardoise">{unite}</span>}
    </p>
  );
}

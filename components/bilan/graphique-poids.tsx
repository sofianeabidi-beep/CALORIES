import type { PeseeLissee } from '@/lib/calcul';

const LARGEUR = 600;
const HAUTEUR = 220;
const MARGE = { haut: 16, bas: 28, gauche: 16, droite: 16 };

const uneDecimale = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * Courbe de la moyenne mobile du poids.
 *
 * Une seule série : pas de légende nécessaire, le titre de la carte dit
 * déjà ce qui est tracé. Axe Y borné aux valeurs observées (pas à zéro) —
 * un poids ne se lit pas depuis l'origine, c'est la variation qui compte.
 * Pas de code couleur bonne/mauvaise tendance, cohérent avec le reste de
 * l'application : une seule teinte neutre.
 */
export function GraphiquePoids({ pesees }: { pesees: readonly PeseeLissee[] }) {
  const points = pesees.filter(
    (p): p is PeseeLissee & { moyenneMobile7jKg: number } =>
      !p.aberrante && p.moyenneMobile7jKg !== null,
  );

  if (points.length < 2) {
    return (
      <p className="text-sm text-ardoise">
        Pas encore assez de pesées pour tracer une courbe — il en faut au moins deux.
      </p>
    );
  }

  const valeurs = points.map((p) => p.moyenneMobile7jKg);
  const min = Math.min(...valeurs);
  const max = Math.max(...valeurs);
  // Marge verticale : une courbe qui touche les bords du cadre se lit mal.
  const paddingY = Math.max((max - min) * 0.15, 0.5);
  const yBas = min - paddingY;
  const yHaut = max + paddingY;

  const largeurUtile = LARGEUR - MARGE.gauche - MARGE.droite;
  const hauteurUtile = HAUTEUR - MARGE.haut - MARGE.bas;

  const x = (i: number) => MARGE.gauche + (i / (points.length - 1)) * largeurUtile;
  const y = (valeur: number) =>
    MARGE.haut + hauteurUtile - ((valeur - yBas) / (yHaut - yBas)) * hauteurUtile;

  const chemin = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.moyenneMobile7jKg).toFixed(1)}`)
    .join(' ');

  const premier = points[0];
  const dernier = points[points.length - 1];
  /* c8 ignore next -- longueur >= 2 vérifiée juste au-dessus, garde de typage */
  if (premier === undefined || dernier === undefined) return null;

  return (
    <div>
      <svg
        viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}
        className="w-full"
        role="img"
        aria-label={`Évolution du poids de ${uneDecimale.format(premier.moyenneMobile7jKg)} kg à ${uneDecimale.format(dernier.moyenneMobile7jKg)} kg`}
      >
        {/* Ligne de référence haute et basse, hairline, recessive. */}
        <line
          x1={MARGE.gauche}
          x2={LARGEUR - MARGE.droite}
          y1={y(yHaut)}
          y2={y(yHaut)}
          style={{ stroke: 'var(--couleur-trait)' }}
          strokeWidth={1}
        />
        <line
          x1={MARGE.gauche}
          x2={LARGEUR - MARGE.droite}
          y1={HAUTEUR - MARGE.bas}
          y2={HAUTEUR - MARGE.bas}
          style={{ stroke: 'var(--couleur-trait)' }}
          strokeWidth={1}
        />

        <path
          d={chemin}
          fill="none"
          style={{ stroke: 'var(--couleur-deficit)' }}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Point de départ et d'arrivée : les deux seules valeurs
            étiquetées directement, le reste se lit sur la forme. */}
        {[premier, dernier].map((p, i) => (
          <circle
            key={i}
            cx={x(i === 0 ? 0 : points.length - 1)}
            cy={y(p.moyenneMobile7jKg)}
            r={4}
            style={{ fill: 'var(--couleur-deficit)', stroke: 'var(--couleur-surface)' }}
            strokeWidth={2}
          />
        ))}

        <text
          x={x(0)}
          y={HAUTEUR - 8}
          textAnchor="start"
          className="text-xs"
          style={{ fill: 'var(--couleur-ardoise)' }}
        >
          {uneDecimale.format(premier.moyenneMobile7jKg)} kg
        </text>
        <text
          x={x(points.length - 1)}
          y={HAUTEUR - 8}
          textAnchor="end"
          className="text-xs"
          style={{ fill: 'var(--couleur-ardoise)' }}
        >
          {uneDecimale.format(dernier.moyenneMobile7jKg)} kg
        </text>
      </svg>
    </div>
  );
}

'use client';

import { useState } from 'react';
import type { PeseeLissee } from '@/lib/calcul';
import { formaterDate } from '@/lib/dates-app';

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
 *
 * Chaque pesée porte un point survolable/tapable (souris ou tactile —
 * l'appli s'utilise surtout au doigt) qui affiche poids et date exacts.
 * Le cercle visible reste petit ; un second cercle transparent, plus
 * grand, capte l'interaction pour rester une cible tactile confortable
 * sans épaissir le tracé.
 */
export function GraphiquePoids({ pesees }: { pesees: readonly PeseeLissee[] }) {
  const [survole, setSurvole] = useState<number | null>(null);

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

  const pointSurvole = survole === null ? null : points[survole];
  const ancrageEtiquette = (i: number): 'start' | 'middle' | 'end' => {
    const px = x(i);
    if (px < 60) return 'start';
    if (px > LARGEUR - 60) return 'end';
    return 'middle';
  };

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

        {/* Un point par pesée : visible en petit, tapable/survolable en
            plus grand via le cercle transparent superposé. */}
        {points.map((p, i) => (
          <g key={p.date}>
            <circle
              cx={x(i)}
              cy={y(p.moyenneMobile7jKg)}
              r={survole === i ? 4.5 : 3}
              style={{ fill: 'var(--couleur-deficit)', stroke: 'var(--couleur-surface)' }}
              strokeWidth={1.5}
            />
            <circle
              cx={x(i)}
              cy={y(p.moyenneMobile7jKg)}
              r={22}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`${uneDecimale.format(p.moyenneMobile7jKg)} kg le ${formaterDate(p.date, { day: 'numeric', month: 'short' })}`}
              onMouseEnter={() => {
                setSurvole(i);
              }}
              onMouseLeave={() => {
                setSurvole(null);
              }}
              onFocus={() => {
                setSurvole(i);
              }}
              onBlur={() => {
                setSurvole(null);
              }}
              onClick={() => {
                setSurvole((actuel) => (actuel === i ? null : i));
              }}
            />
          </g>
        ))}

        {pointSurvole !== undefined && pointSurvole !== null && survole !== null && (
          <g>
            {(() => {
              const py = y(pointSurvole.moyenneMobile7jKg);
              // Pas assez de place au-dessus (point proche du haut du
              // cadre) : l'étiquette passe sous le point plutôt que de se
              // faire couper par le bord du viewBox.
              const enDessous = py - 34 < 0;
              const rectY = enDessous ? py + 12 : py - 34;
              const texteY = enDessous ? py + 27 : py - 19;
              const ancrage = ancrageEtiquette(survole);
              return (
                <>
                  <rect
                    x={
                      ancrage === 'start' ? x(survole) : ancrage === 'end' ? x(survole) - 116 : x(survole) - 58
                    }
                    y={rectY}
                    width={116}
                    height={22}
                    rx={5}
                    style={{ fill: 'var(--couleur-graphite)' }}
                  />
                  <text
                    x={x(survole)}
                    y={texteY}
                    textAnchor={ancrage}
                    dx={ancrage === 'start' ? 6 : ancrage === 'end' ? -6 : 0}
                    className="text-xs"
                    style={{ fill: 'var(--couleur-papier)' }}
                  >
                    {uneDecimale.format(pointSurvole.moyenneMobile7jKg)} kg —{' '}
                    {formaterDate(pointSurvole.date, { day: 'numeric', month: 'short' })}
                  </text>
                </>
              );
            })()}
          </g>
        )}

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

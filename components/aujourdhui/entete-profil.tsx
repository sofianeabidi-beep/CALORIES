import type { CSSProperties } from 'react';
import { Carte, Libelle } from '@/components/ui/primitives';

const entier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const deuxDecimales = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function nomAffiche(prenom: string | null): string {
  return prenom !== null && prenom.length > 0 ? prenom : 'Vous';
}

/**
 * Bloc d'identité en tête d'Aujourd'hui — inspiré du profil Strava dans
 * sa forme (avatar, nom, trois chiffres), pas dans son fond : pas
 * d'abonnés ni d'abonnements, ce serait un graphe social que
 * l'application ne construit pas (décision du 2026-08-14). Les trois
 * chiffres restent personnels : aucun ne se compare à qui que ce soit.
 */
export function EnteteProfil({
  prenom,
  joursDeRegime,
  nombrePesees,
  kgTheoriques,
  joursAvantObjectif,
  modeDiscret,
  className,
  style,
}: {
  prenom: string | null;
  joursDeRegime: number;
  nombrePesees: number;
  /** Positif quand le poids a théoriquement baissé — voir `Bilan.kgTheoriques`. */
  kgTheoriques: number;
  /**
   * `null` quand la projection n'est pas affichable (§ Projection) : moins
   * de 21 jours de données, rythme quasi nul, à l'opposé de l'objectif,
   * ou échéance à plus de deux ans. Mieux vaut ne rien dire qu'une
   * échéance fausse — la ligne disparaît plutôt que d'afficher un tiret.
   */
  joursAvantObjectif: number | null;
  modeDiscret: boolean;
  className?: string | undefined;
  style?: CSSProperties | undefined;
}) {
  const nom = nomAffiche(prenom);
  const initiale = nom.charAt(0).toUpperCase();
  const enDeficit = kgTheoriques >= 0;

  return (
    <Carte className={className} style={style}>
      <div className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-deficit/10 text-lg font-medium text-deficit"
        >
          {initiale}
        </div>
        <p className="text-lg text-graphite">{nom}</p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-trait pt-4">
        <div>
          <p className="chiffre text-xl font-light text-graphite">
            {entier.format(joursDeRegime)}
          </p>
          <Libelle>{joursDeRegime > 1 ? 'Jours de régime' : 'Jour de régime'}</Libelle>
        </div>
        <div>
          <p className="chiffre text-xl font-light text-graphite">
            {entier.format(nombrePesees)}
          </p>
          <Libelle>{nombrePesees > 1 ? 'Pesées' : 'Pesée'}</Libelle>
        </div>
        <div>
          <p className="chiffre text-xl font-light text-graphite">
            {modeDiscret ? '—' : deuxDecimales.format(Math.abs(kgTheoriques))}
            {!modeDiscret && <span className="ml-1 text-sm font-normal text-ardoise">kg</span>}
          </p>
          <Libelle>{enDeficit ? 'Déficit cumulé' : 'Surplus cumulé'}</Libelle>
        </div>
      </div>

      {joursAvantObjectif !== null && joursAvantObjectif > 0 && (
        <p className="mt-3 border-t border-trait pt-3 text-sm text-ardoise">
          Il vous reste environ{' '}
          <span className="chiffre font-medium text-graphite">
            {entier.format(joursAvantObjectif)}
          </span>{' '}
          {joursAvantObjectif > 1 ? 'jours' : 'jour'} d’effort à ce rythme pour atteindre votre
          objectif.
        </p>
      )}
    </Carte>
  );
}

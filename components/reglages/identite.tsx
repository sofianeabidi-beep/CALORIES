import type { CSSProperties } from 'react';
import { Carte, Libelle } from '@/components/ui/primitives';
import { PhotoProfil } from '@/components/reglages/photo-profil';

const entier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const uneDecimale = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const deuxDecimales = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function nomAffiche(prenom: string | null): string {
  return prenom !== null && prenom.length > 0 ? prenom : 'Vous';
}

/**
 * Bloc d'identité, en tête de la section Profil (Réglages) — anciennement
 * en tête d'Aujourd'hui, déplacé ici pour rejoindre les objectifs et la
 * dépense énergétique plutôt que de rester isolé sur l'écran du jour.
 *
 * Le nombre de pesées a disparu au passage : peu parlant une fois sorti
 * du contexte du graphique de Bilan. Le poids actuel prend sa place,
 * cohérent avec le cadrage en perte/prise de poids plutôt qu'en kcal
 * (voir Bilan).
 */
export function Identite({
  prenom,
  photoUrl,
  joursDeRegime,
  kgTheoriques,
  poidsActuelKg,
  joursAvantObjectif,
  modeDiscret,
  className,
  style,
}: {
  prenom: string | null;
  photoUrl: string | null;
  joursDeRegime: number;
  /** Positif quand le poids a théoriquement baissé — voir `Bilan.kgTheoriques`. */
  kgTheoriques: number;
  poidsActuelKg: number;
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
        {photoUrl !== null ? (
          // eslint-disable-next-line @next/next/no-img-element -- domaine Supabase non listé dans next/image, une simple balise suffit pour un avatar.
          <img
            src={photoUrl}
            alt=""
            className="size-11 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-deficit/10 text-lg font-medium text-deficit"
          >
            {initiale}
          </div>
        )}
        <div>
          <p className="text-lg text-graphite">{nom}</p>
          <PhotoProfil />
        </div>
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
            {modeDiscret ? '—' : deuxDecimales.format(Math.abs(kgTheoriques))}
            {!modeDiscret && <span className="ml-1 text-sm font-normal text-ardoise">kg</span>}
          </p>
          <Libelle>{enDeficit ? 'Perte de poids cumulée' : 'Prise de poids cumulée'}</Libelle>
        </div>
        <div>
          <p className="chiffre text-xl font-light text-graphite">
            {modeDiscret ? '—' : uneDecimale.format(poidsActuelKg)}
            {!modeDiscret && <span className="ml-1 text-sm font-normal text-ardoise">kg</span>}
          </p>
          <Libelle>Poids actuel</Libelle>
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

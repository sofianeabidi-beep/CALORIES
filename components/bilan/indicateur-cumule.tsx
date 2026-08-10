import type { Completude } from '@/lib/calcul';
import { Carte, Chiffre, Libelle } from '@/components/ui/primitives';

/**
 * Indicateur cumulé, **toujours accompagné de sa complétude**.
 *
 * La règle du §6.5 — « aucun indicateur cumulé ne s'affiche sans son
 * taux de complétude » — est ici structurelle et non déclarative : la
 * complétude est un paramètre obligatoire du composant. On ne peut pas
 * afficher un cumul sans elle, même par distraction, même sous la
 * pression du planning. C'est le critère d'acceptation le plus facile à
 * perdre au moment de l'intégration graphique.
 */
export function IndicateurCumule({
  libelle,
  valeur,
  unite,
  ton = 'neutre',
  completude,
  precision,
}: {
  libelle: string;
  valeur: string;
  unite?: string;
  ton?: 'neutre' | 'deficit' | 'surplus';
  completude: Completude;
  precision?: string;
}) {
  const pourcent = Math.round(completude.taux * 100);

  // Sous 60 %, le cumul ne veut plus dire grand-chose. On ne le cache
  // pas — l'utilisateur a le droit de le voir — mais on le dit.
  const fragile = completude.taux < 0.6;

  return (
    <Carte>
      <Libelle>{libelle}</Libelle>
      <div className="mt-2">
        <Chiffre valeur={valeur} unite={unite} ton={ton} />
      </div>

      {precision !== undefined && (
        <p className="mt-2 text-sm text-ardoise">{precision}</p>
      )}

      <div className="mt-3 border-t border-trait pt-2">
        <p className={`text-sm ${fragile ? 'text-signal' : 'text-ardoise'}`}>
          <span className="chiffre font-medium">{pourcent} %</span> de jours renseignés
          <span className="text-ardoise">
            {' '}
            ({completude.joursRenseignes} sur {completude.joursTotal})
          </span>
        </p>
        {fragile && (
          <p className="mt-1 text-sm text-ardoise">
            Trop de jours manquent pour que ce chiffre soit fiable.
          </p>
        )}
        {completude.joursEstimes > 0 && (
          <p className="mt-1 text-sm text-ardoise">
            Dont{' '}
            <span className="chiffre">{completude.joursEstimes}</span>{' '}
            {completude.joursEstimes > 1 ? 'jours estimés' : 'jour estimé'}, non compté
            {completude.joursEstimes > 1 ? 's' : ''} comme renseigné
            {completude.joursEstimes > 1 ? 's' : ''}.
          </p>
        )}
      </div>
    </Carte>
  );
}

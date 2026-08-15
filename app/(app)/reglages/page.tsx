import Link from 'next/link';
import { seDeconnecter } from '@/lib/actions/compte';
import { creerClientServeur } from '@/lib/supabase/server';
import { lireJournee } from '@/lib/donnees/journee';
import { aujourdhuiIso, formaterDate } from '@/lib/dates-app';
import { differenceJours, nombreJoursInclus } from '@/lib/calcul';
import { Bouton, Carte, Chiffre, Libelle } from '@/components/ui/primitives';
import { FormulairePrenom } from '@/components/reglages/formulaire-prenom';
import { Identite } from '@/components/reglages/identite';

const entier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

const MODES = {
  neutre: 'Neutre — le jour est exclu du cumul et compté comme non renseigné',
  estime: 'Estimé — le jour prend la moyenne des 7 derniers jours renseignés',
  strict: 'Strict — déficit nul, l’apport est réputé égal à la dépense',
} as const;

/**
 * Réglages fait aussi office de Profil : identité, objectifs et dépense
 * énergétique en tête, réglages du compte en dessous.
 *
 * Volontairement **pas** de redirection vers `/reglages/programme` si
 * `lireJournee` renvoie `null` (contrairement à Aujourd'hui/Bilan/
 * Planification) : c'est la seule page de l'appli qui reste accessible
 * sans programme actif, notamment pour se déconnecter. Le bloc
 * identité/objectifs/dépense se contente de ne pas s'afficher tant que
 * ces données ne sont pas prêtes ; le reste de la page (compte, prénom,
 * lien vers la création du programme) fonctionne déjà à vide.
 */
export default async function Reglages() {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profil } = await supabase
    .from('profil')
    .select('*')
    .eq('user_id', user?.id ?? '')
    .maybeSingle();

  const { data: programme } = await supabase
    .from('programme')
    .select('*')
    .eq('user_id', user?.id ?? '')
    .eq('actif', true)
    .maybeSingle();

  const date = aujourdhuiIso();
  const vue = await lireJournee(date);

  const poidsActuelKg =
    vue === null
      ? null
      : vue.bilan.kgReels === null
        ? Number(vue.programme.poids_depart_kg)
        : Number(vue.programme.poids_depart_kg) - vue.bilan.kgReels;

  // `null` sans exception : la projection se masque déjà elle-même
  // quand les données ne la portent pas (§ Projection).
  const joursAvantObjectif =
    vue !== null && vue.bilan.projection.affichable && vue.bilan.projection.dateMediane !== null
      ? differenceJours(date, vue.bilan.projection.dateMediane)
      : null;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
      <h1 className="font-voice text-xl text-graphite">Profil</h1>

      {vue !== null && poidsActuelKg !== null && (
        <Identite
          prenom={vue.profil.prenom}
          photoUrl={vue.profil.photo_url}
          joursDeRegime={nombreJoursInclus(vue.programme.date_debut, date)}
          kgTheoriques={vue.bilan.kgTheoriques}
          poidsActuelKg={poidsActuelKg}
          joursAvantObjectif={joursAvantObjectif}
          modeDiscret={vue.profil.mode_discret}
        />
      )}

      <Carte>
        <Libelle>Compte</Libelle>
        <p className="mt-2 text-sm text-graphite">{user?.email}</p>
      </Carte>

      <Carte>
        <Libelle>Prénom</Libelle>
        <p className="mt-2 text-sm text-ardoise">
          Affiché dans votre profil. Laissez vide pour revenir à votre adresse électronique.
        </p>
        <FormulairePrenom prenomActuel={profil?.prenom ?? null} />
      </Carte>

      <Carte>
        <Libelle>Objectifs</Libelle>
        {programme === null ? (
          <p className="mt-2 text-sm text-ardoise">Aucun programme en cours.</p>
        ) : (
          <div className="mt-2 flex flex-col gap-1 text-sm text-graphite">
            <p>
              {programme.libelle ?? programme.type} — depuis le {programme.date_debut}, départ à{' '}
              <span className="chiffre">{programme.poids_depart_kg}</span> kg
            </p>
            {programme.poids_cible_kg !== null && (
              <p>
                Poids cible : <span className="chiffre">{programme.poids_cible_kg}</span> kg
              </p>
            )}
            {programme.date_fin !== null && (
              <p>Échéance visée : {formaterDate(programme.date_fin, { dateStyle: 'long' })}</p>
            )}
            {programme.objectif_kcal !== null && (
              <p>
                Objectif calorique :{' '}
                <span className="chiffre">{entier.format(programme.objectif_kcal)}</span> kcal/j
              </p>
            )}
          </div>
        )}
        <Link
          href="/reglages/programme"
          className="mt-3 flex min-h-11 items-center justify-center rounded-lg border border-trait text-sm text-graphite transition duration-150 hover:border-ardoise active:bg-trait"
        >
          {programme === null ? 'Créer un programme' : 'Changer de programme'}
        </Link>
      </Carte>

      {vue !== null && (
        <Carte>
          <Libelle>Dépense énergétique</Libelle>
          <div className="mt-2">
            <Chiffre
              valeur={entier.format(Math.round(vue.bilan.depenseRetenueKcal))}
              unite="kcal/j"
              taille="moyen"
            />
          </div>
          <p className="mt-2 text-sm text-ardoise">
            {vue.bilan.depenseIssueDuReel
              ? 'Recalculée sur vos données réelles. Elle a remplacé l’estimation par formule.'
              : 'Estimée par la formule de Mifflin-St Jeor. C’est un point de départ, pas une vérité — elle sera corrigée dès que vos données le permettront.'}
          </p>
          <p className="mt-2 text-sm text-ardoise">
            Fiabilité : <span className="chiffre">{Math.round(vue.bilan.fiabilite * 100)} %</span>{' '}
            des jours de la fenêtre de 28 jours sont renseignés.
          </p>
        </Carte>
      )}

      <Carte>
        <Libelle>Jours non renseignés</Libelle>
        <p className="mt-2 text-sm text-graphite">
          {profil === null ? '—' : MODES[profil.mode_jours_manquants]}
        </p>
        <p className="mt-2 text-sm text-ardoise">
          Ce réglage change la façon dont les jours sans saisie entrent dans le cumul. Il ne
          change jamais le taux de complétude : un jour estimé n’est pas un jour renseigné.
        </p>
      </Carte>

      <Carte>
        <Libelle>Mode discret</Libelle>
        <p className="mt-2 text-sm text-graphite">
          {profil?.mode_discret === true ? 'Activé' : 'Désactivé'}
        </p>
        <p className="mt-2 text-sm text-ardoise">
          Masque les valeurs caloriques et n’affiche que la complétude et la tendance.
        </p>
      </Carte>

      <Carte>
        <Libelle>Vos données</Libelle>
        <p className="mt-2 text-sm text-ardoise">
          Votre poids et votre alimentation sont des données de santé. Elles sont hébergées
          dans l’Union européenne et ne sont transmises à aucun outil tiers.
        </p>
        <p className="mt-2 text-sm text-ardoise">
          L’export et la suppression du compte arrivent en phase 3.
        </p>
      </Carte>

      <form action={seDeconnecter}>
        <Bouton type="submit" variante="discret">
          Se déconnecter
        </Bouton>
      </form>

      <p className="pb-4 text-center text-xs text-ardoise">
        Symbio mesure et restitue. Il ne donne aucun conseil médical ni nutritionnel.
      </p>
    </main>
  );
}

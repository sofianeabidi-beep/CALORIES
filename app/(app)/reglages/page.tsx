import Link from 'next/link';
import { seDeconnecter } from '@/lib/actions/compte';
import { creerClientServeur } from '@/lib/supabase/server';
import { Carte, Libelle } from '@/components/ui/primitives';

const MODES = {
  neutre: 'Neutre — le jour est exclu du cumul et compté comme non renseigné',
  estime: 'Estimé — le jour prend la moyenne des 7 derniers jours renseignés',
  strict: 'Strict — déficit nul, l’apport est réputé égal à la dépense',
} as const;

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

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
      <h1 className="text-xl font-light text-graphite">Réglages</h1>

      <Carte>
        <Libelle>Compte</Libelle>
        <p className="mt-2 text-sm text-graphite">{user?.email}</p>
      </Carte>

      <Carte>
        <Libelle>Programme actif</Libelle>
        {programme === null ? (
          <p className="mt-2 text-sm text-ardoise">Aucun programme en cours.</p>
        ) : (
          <p className="mt-2 text-sm text-graphite">
            {programme.libelle ?? programme.type} — depuis le {programme.date_debut},
            départ à <span className="chiffre">{programme.poids_depart_kg}</span> kg
          </p>
        )}
        <Link
          href="/reglages/programme"
          className="mt-3 flex min-h-11 items-center justify-center rounded-lg border border-trait text-sm text-graphite"
        >
          {programme === null ? 'Créer un programme' : 'Changer de programme'}
        </Link>
      </Carte>

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
        <button
          type="submit"
          className="min-h-11 w-full rounded-lg border border-trait px-4 py-3 text-base text-graphite"
        >
          Se déconnecter
        </button>
      </form>

      <p className="pb-4 text-center text-xs text-ardoise">
        Caloryes mesure et restitue. Il ne donne aucun conseil médical ni nutritionnel.
      </p>
    </main>
  );
}

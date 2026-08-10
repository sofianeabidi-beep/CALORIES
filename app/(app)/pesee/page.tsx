import { redirect } from 'next/navigation';
import { creerClientServeur } from '@/lib/supabase/server';
import { lisserPesees } from '@/lib/calcul';
import { formaterDate } from '@/lib/dates-app';
import { FormulairePesee } from '@/components/saisie/formulaire-pesee';
import { Carte, Libelle } from '@/components/ui/primitives';

const uneDecimale = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export default async function Pesee() {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) redirect('/connexion');

  const { data: brutes } = await supabase
    .from('pesee')
    .select('*')
    .eq('user_id', user.id)
    .is('supprime_le', null)
    .order('date', { ascending: true });

  const pesees = lisserPesees(
    (brutes ?? []).map((p) => ({ date: p.date, poidsKg: Number(p.poids_kg) })),
  );

  const recentes = pesees.slice(-10).reverse();
  const derniere = pesees[pesees.length - 1];

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
      <h1 className="text-xl font-light text-graphite">Pesée</h1>

      {/* Prérempli avec la dernière valeur : d'un jour à l'autre le
          poids bouge de quelques centaines de grammes, taper trois
          chiffres identiques chaque matin est une friction inutile. */}
      <FormulairePesee poidsPrecedentKg={derniere?.poidsKg} />

      <Carte>
        <Libelle>Dernières pesées</Libelle>
        {recentes.length === 0 ? (
          <p className="mt-2 text-sm text-ardoise">Aucune pesée enregistrée.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {recentes.map((pesee) => (
              <li key={pesee.date} className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-ardoise">
                  {formaterDate(pesee.date, { day: 'numeric', month: 'short' })}
                </span>
                <span className="flex items-baseline gap-3">
                  <span
                    className={`chiffre text-sm ${
                      pesee.aberrante ? 'text-signal' : 'text-graphite'
                    }`}
                  >
                    {uneDecimale.format(pesee.poidsKg)} kg
                  </span>
                  <span className="chiffre w-20 text-right text-sm text-ardoise">
                    {pesee.moyenneMobile7jKg === null
                      ? '—'
                      : `moy. ${uneDecimale.format(pesee.moyenneMobile7jKg)}`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {recentes.some((p) => p.aberrante) && (
          <p className="mt-3 border-t border-trait pt-2 text-sm text-ardoise">
            Les valeurs en rouge s’écartent de plus de 2 kg de votre moyenne. Elles sont
            conservées mais exclues du calcul, le temps que vous les confirmiez.
          </p>
        )}
      </Carte>
    </main>
  );
}

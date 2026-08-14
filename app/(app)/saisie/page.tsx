import { Suspense } from 'react';
import { FormulaireSaisie, type EntreeAModifier } from '@/components/saisie/formulaire-saisie';
import { Carte } from '@/components/ui/primitives';
import { creerClientServeur } from '@/lib/supabase/server';

/**
 * L'entrée n'est jamais lue par son seul id : `entree` porte la RLS,
 * mais filtrer aussi par `user_id` évite qu'un id d'un autre compte,
 * même refusé par la RLS, laisse deviner qu'il existe (le `maybeSingle`
 * renverrait `null` dans les deux cas, mais autant ne pas en dépendre).
 */
async function lireEntreeAModifier(id: string): Promise<EntreeAModifier | null> {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return null;

  const { data: entree } = await supabase
    .from('entree')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .is('supprime_le', null)
    .maybeSingle();
  if (entree === null) return null;

  const { data: journee } = await supabase
    .from('journee')
    .select('date')
    .eq('id', entree.journee_id)
    .maybeSingle();
  if (journee === null) return null;

  return {
    id: entree.id,
    date: journee.date,
    libelle: entree.libelle,
    repas: entree.repas,
    quantite: Number(entree.quantite),
    unite: entree.unite,
    kcal: Number(entree.kcal),
    proteinesG: entree.proteines_g === null ? null : Number(entree.proteines_g),
    glucidesG: entree.glucides_g === null ? null : Number(entree.glucides_g),
    lipidesG: entree.lipides_g === null ? null : Number(entree.lipides_g),
  };
}

/**
 * Écran de saisie — et de correction.
 *
 * Le formulaire lit `useSearchParams` pour préremplir le repas depuis
 * l'écran Aujourd'hui : Next impose alors une frontière Suspense, sans
 * quoi toute la page bascule en rendu client. `editId`, lui, se lit ici
 * plutôt que côté client : il faut l'entrée d'origine avant le premier
 * rendu du formulaire, pas après.
 */
export default async function Saisie({
  searchParams,
}: {
  searchParams: Promise<{ editId?: string }>;
}) {
  const { editId } = await searchParams;
  const entreeAModifier = editId === undefined ? null : await lireEntreeAModifier(editId);

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <h1 className="font-voice mb-4 text-xl text-graphite">
        {entreeAModifier === null ? 'Ajouter un repas' : 'Modifier l’entrée'}
      </h1>

      <Suspense
        fallback={
          <Carte>
            <p className="text-sm text-ardoise">Chargement du formulaire…</p>
          </Carte>
        }
      >
        <FormulaireSaisie entreeAModifier={entreeAModifier} />
      </Suspense>
    </main>
  );
}

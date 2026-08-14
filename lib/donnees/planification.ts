import 'server-only';

import type { DateIso } from '@/lib/calcul';
import { creerClientServeur } from '@/lib/supabase/server';
import type { LignePlanificationSemaine } from '@/lib/supabase/types';

/** Plan existant pour une semaine donnée (clé `semaine_debut`), ou `null` s'il n'y en a pas encore. */
export async function lirePlanificationSemaine(
  semaineDebut: DateIso,
): Promise<LignePlanificationSemaine | null> {
  const supabase = await creerClientServeur();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return null;

  const { data } = await supabase
    .from('planification_semaine')
    .select('*')
    .eq('user_id', user.id)
    .eq('semaine_debut', semaineDebut)
    .maybeSingle();

  return data;
}

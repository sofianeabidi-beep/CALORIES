import 'server-only';

import type { DateIso } from '@/lib/calcul';
import { creerClientServeur } from '@/lib/supabase/server';
import type { Repas } from '@/lib/supabase/types';

export interface EntreeHistorique {
  readonly id: string;
  readonly repas: Repas;
  readonly libelle: string;
  readonly quantite: number;
  readonly unite: string;
  readonly kcal: number;
}

export interface JourHistorique {
  readonly date: DateIso;
  readonly statut: 'renseigne' | 'estime' | 'manquant';
  readonly apportKcal: number;
  readonly deficitKcal: number | null;
  readonly entrees: readonly EntreeHistorique[];
}

export interface VueHistorique {
  readonly jours: readonly JourHistorique[];
  readonly aEncorePlus: boolean;
}

const LIMITE_PAR_DEFAUT = 14;

/**
 * Historique jour par jour pour `/bilan/historique`.
 *
 * `journee` porte déjà le déficit et l'apport agrégés (recalculés en
 * amont, voir le commentaire dans `lib/donnees/journee.ts`) — pas de
 * recalcul à la volée ici, seulement une lecture et un regroupement.
 *
 * Pagination par curseur de date plutôt que `offset` : un `offset`
 * décale tout si une entrée est ajoutée entre deux pages, un curseur
 * sur `date` reste stable.
 */
export async function lireHistoriqueJournees(options?: {
  avant?: DateIso;
  limite?: number;
}): Promise<VueHistorique | null> {
  const limite = options?.limite ?? LIMITE_PAR_DEFAUT;
  const supabase = await creerClientServeur();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return null;

  let requete = supabase
    .from('journee')
    .select('id, date, statut, apport_kcal, deficit_kcal')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(limite + 1);

  if (options?.avant !== undefined) {
    requete = requete.lt('date', options.avant);
  }

  const { data: journees } = await requete;
  const lignesJournee = journees ?? [];
  const aEncorePlus = lignesJournee.length > limite;
  const page = lignesJournee.slice(0, limite);

  if (page.length === 0) {
    return { jours: [], aEncorePlus: false };
  }

  const dateParId = new Map(page.map((j) => [j.id, j.date] as const));

  const { data: entreesReponse } = await supabase
    .from('entree')
    .select('id, repas, libelle, quantite, unite, kcal, journee_id')
    .eq('user_id', user.id)
    .is('supprime_le', null)
    .in(
      'journee_id',
      page.map((j) => j.id),
    )
    .order('saisi_le', { ascending: true });

  const entreesParDate = new Map<string, EntreeHistorique[]>();

  for (const e of entreesReponse ?? []) {
    const date = dateParId.get(e.journee_id);
    if (date === undefined) continue;
    const liste = entreesParDate.get(date) ?? [];
    liste.push({
      id: e.id,
      repas: e.repas,
      libelle: e.libelle,
      quantite: Number(e.quantite),
      unite: e.unite,
      kcal: Number(e.kcal),
    });
    entreesParDate.set(date, liste);
  }

  const jours: JourHistorique[] = page.map((j) => ({
    date: j.date,
    statut: j.statut,
    apportKcal: Number(j.apport_kcal),
    deficitKcal: j.deficit_kcal === null ? null : Number(j.deficit_kcal),
    entrees: entreesParDate.get(j.date) ?? [],
  }));

  return { jours, aEncorePlus };
}

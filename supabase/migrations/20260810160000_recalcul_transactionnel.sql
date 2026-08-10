-- Recalcul transactionnel (spec §6.8).
--
-- La spec exige que le recalcul s'exécute dans une transaction. La
-- version précédente enchaînait plusieurs allers-retours PostgREST : une
-- coupure au milieu laissait des instantanés partiellement à jour.
--
-- **Le calcul reste en TypeScript.** Seules les écritures descendent
-- ici. Réimplémenter Mifflin-St Jeor, le lissage à 5 %, la dépense
-- réelle et les trois modes de jours manquants en plpgsql dupliquerait
-- la logique la plus critique du produit dans un second langage non
-- testé — et le moteur doit de toute façon tourner côté client pour que
-- les indicateurs restent justes hors ligne (§8).
--
-- Cette fonction ne décide rien : elle applique, en une transaction, ce
-- que le moteur a calculé.

create or replace function public.appliquer_recalcul(
  p_programme_id uuid,
  p_pesees jsonb,
  p_journees jsonb,
  p_instantanes jsonb
)
returns int
language plpgsql
-- `security invoker` : la RLS s'applique. Une fonction `security
-- definer` ici donnerait à chaque utilisateur le pouvoir d'écrire chez
-- les autres, ce qui viderait de son sens tout le travail sur la RLS.
security invoker
set search_path = public
as $$
declare
  v_user uuid := (select auth.uid());
  v_ecrits int;
begin
  if v_user is null then
    raise exception 'Aucune session : recalcul impossible.'
      using errcode = 'insufficient_privilege';
  end if;

  -- 1. Moyenne mobile et marquage des pesées aberrantes.
  update public.pesee p
  set moyenne_mobile_7j_kg = nullif(e ->> 'moyenne_mobile_7j_kg', '')::numeric,
      aberrante = (e ->> 'aberrante')::boolean
  from jsonb_array_elements(coalesce(p_pesees, '[]'::jsonb)) e
  where p.user_id = v_user
    and p.date = (e ->> 'date')::date;

  -- 2. Agrégats dénormalisés de `journee`.
  update public.journee j
  set programme_id = p_programme_id,
      apport_kcal = (e ->> 'apport_kcal')::numeric,
      proteines_g = (e ->> 'proteines_g')::numeric,
      glucides_g = (e ->> 'glucides_g')::numeric,
      lipides_g = (e ->> 'lipides_g')::numeric,
      depense_retenue_kcal = (e ->> 'depense_retenue_kcal')::numeric,
      deficit_kcal = nullif(e ->> 'deficit_kcal', '')::numeric,
      statut = e ->> 'statut'
  from jsonb_array_elements(coalesce(p_journees, '[]'::jsonb)) e
  where j.user_id = v_user
    and j.date = (e ->> 'date')::date;

  -- 3. Instantanés. `upsert` sur la clé naturelle : rejouer le recalcul
  --    écrase la ligne au lieu d'en créer une seconde.
  insert into public.instantane_calcul (
    user_id, programme_id, date,
    deficit_cumul_kcal, kg_theoriques, kg_reels, ecart_kg,
    depense_reelle_kcal, depense_retenue_kcal, depense_issue_du_reel,
    fiabilite, allure_kg_semaine, completude,
    jours_renseignes, jours_total, projection_date, calcule_le
  )
  select
    v_user,
    p_programme_id,
    (e ->> 'date')::date,
    (e ->> 'deficit_cumul_kcal')::numeric,
    (e ->> 'kg_theoriques')::numeric,
    nullif(e ->> 'kg_reels', '')::numeric,
    nullif(e ->> 'ecart_kg', '')::numeric,
    nullif(e ->> 'depense_reelle_kcal', '')::numeric,
    (e ->> 'depense_retenue_kcal')::numeric,
    (e ->> 'depense_issue_du_reel')::boolean,
    (e ->> 'fiabilite')::numeric,
    nullif(e ->> 'allure_kg_semaine', '')::numeric,
    (e ->> 'completude')::numeric,
    (e ->> 'jours_renseignes')::int,
    (e ->> 'jours_total')::int,
    nullif(e ->> 'projection_date', '')::date,
    now()
  from jsonb_array_elements(coalesce(p_instantanes, '[]'::jsonb)) e
  on conflict (user_id, programme_id, date) do update
  set deficit_cumul_kcal = excluded.deficit_cumul_kcal,
      kg_theoriques = excluded.kg_theoriques,
      kg_reels = excluded.kg_reels,
      ecart_kg = excluded.ecart_kg,
      depense_reelle_kcal = excluded.depense_reelle_kcal,
      depense_retenue_kcal = excluded.depense_retenue_kcal,
      depense_issue_du_reel = excluded.depense_issue_du_reel,
      fiabilite = excluded.fiabilite,
      allure_kg_semaine = excluded.allure_kg_semaine,
      completude = excluded.completude,
      jours_renseignes = excluded.jours_renseignes,
      jours_total = excluded.jours_total,
      projection_date = excluded.projection_date,
      calcule_le = excluded.calcule_le;

  get diagnostics v_ecrits = row_count;
  return v_ecrits;
end;
$$;

comment on function public.appliquer_recalcul(uuid, jsonb, jsonb, jsonb) is
  'Applique en une transaction les écritures d''un recalcul. Le calcul lui-même reste dans lib/calcul/, qui doit aussi tourner côté client hors ligne.';

revoke all on function public.appliquer_recalcul(uuid, jsonb, jsonb, jsonb) from public;
grant execute on function public.appliquer_recalcul(uuid, jsonb, jsonb, jsonb) to authenticated;

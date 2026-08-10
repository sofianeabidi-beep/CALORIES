-- Tests RLS — un par table.
--
-- Ce sont des données de santé : c'est la seule partie du produit où un
-- bug est grave. La spec §15.5 exige, pour chaque table, un test
-- vérifiant qu'un autre utilisateur n'accède à rien.
--
-- Le test n'utilise pas de vraie authentification : il prend l'identité
-- d'un utilisateur en posant `request.jwt.claims` et en basculant sur le
-- rôle `authenticated`, exactement ce que fait PostgREST. Sous le rôle
-- propriétaire de la base, la RLS serait contournée et le test ne
-- prouverait rien.
--
-- À rejouer après toute migration :
--   supabase/tests/rls.sql

begin;

create temporary table resultat_rls (
  table_cible text,
  operation text,
  attendu text,
  obtenu text,
  ok boolean
) on commit drop;

-- Le recueil des résultats s'exécute sous le rôle `authenticated`, qui
-- n'a par défaut aucun droit sur une table temporaire. Sans ce grant, le
-- test échoue sur sa propre plomberie plutôt que sur la RLS.
grant insert, select on resultat_rls to authenticated;

do $$
declare
  v_a uuid := '11111111-1111-4111-8111-111111111111';
  v_b uuid := '22222222-2222-4222-8222-222222222222';
  v_journee uuid;
  v_programme uuid;
  v_recette uuid;
  v_table text;
  v_nb int;
  v_tables text[] := array[
    'profil', 'programme', 'journee', 'entree', 'aliment_utilisateur',
    'recette', 'recette_ingredient', 'repas_enregistre', 'pesee',
    'mesure', 'photo_progression', 'instantane_calcul'
  ];
begin
  -- ------------------------------------------------------------------
  -- Deux utilisateurs, et un jeu complet de données appartenant à A.
  -- ------------------------------------------------------------------
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', v_a, 'authenticated', 'authenticated',
     'rls-a@caloryes.invalid', 'x', now(), now(), now()),
    ('00000000-0000-0000-0000-000000000000', v_b, 'authenticated', 'authenticated',
     'rls-b@caloryes.invalid', 'x', now(), now(), now());

  insert into public.profil (user_id, sexe, date_naissance, taille_cm)
  values (v_a, 'h', '1990-06-15', 180);

  insert into public.programme (user_id, type, date_debut, poids_depart_kg)
  values (v_a, 'deficit', current_date, 80)
  returning id into v_programme;

  insert into public.journee (user_id, date) values (v_a, current_date)
  returning id into v_journee;

  insert into public.entree (user_id, journee_id, libelle, repas, quantite, kcal, source)
  values (v_a, v_journee, 'Secret de A', 'dejeuner', 100, 500, 'rapide');

  insert into public.aliment_utilisateur (user_id, nom, kcal_100g)
  values (v_a, 'Aliment de A', 250);

  insert into public.recette (user_id, nom) values (v_a, 'Recette de A')
  returning id into v_recette;

  insert into public.recette_ingredient (user_id, recette_id, libelle, quantite, quantite_g)
  values (v_a, v_recette, 'Ingredient de A', 1, 100);

  insert into public.repas_enregistre (user_id, nom) values (v_a, 'Repas de A');
  insert into public.pesee (user_id, date, poids_kg) values (v_a, current_date, 80);
  insert into public.mesure (user_id, date, type, valeur_cm)
  values (v_a, current_date, 'taille', 85);
  insert into public.photo_progression (user_id, date, storage_path)
  values (v_a, current_date, v_a::text || '/photo.jpg');

  insert into public.instantane_calcul (user_id, programme_id, date, deficit_cumul_kcal,
                                        kg_theoriques, depense_retenue_kcal)
  values (v_a, v_programme, current_date, 2000, 0.26, 2500);

  -- ------------------------------------------------------------------
  -- On devient B. Toute la suite s'exécute sous la RLS.
  -- ------------------------------------------------------------------
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_b, 'role', 'authenticated')::text,
                     true);
  execute 'set local role authenticated';

  -- B ne doit voir aucune ligne de A.
  foreach v_table in array v_tables loop
    execute format('select count(*) from public.%I', v_table) into v_nb;
    insert into resultat_rls
    values (v_table, 'select', '0 ligne visible', v_nb || ' ligne(s)', v_nb = 0);
  end loop;

  -- B ne doit pas pouvoir écrire une ligne au nom de A.
  begin
    insert into public.pesee (user_id, date, poids_kg)
    values (v_a, current_date + 1, 79);
    insert into resultat_rls
    values ('pesee', 'insert au nom de A', 'refuse', 'ACCEPTE', false);
  exception when others then
    insert into resultat_rls
    values ('pesee', 'insert au nom de A', 'refuse', 'refuse', true);
  end;

  -- Ni modifier, ni supprimer les lignes de A : la policy les rend
  -- invisibles, donc zero ligne touchee plutot qu'une erreur.
  update public.pesee set poids_kg = 1 where user_id = v_a;
  get diagnostics v_nb = row_count;
  insert into resultat_rls
  values ('pesee', 'update sur A', '0 ligne modifiee', v_nb || ' ligne(s)', v_nb = 0);

  delete from public.entree where user_id = v_a;
  get diagnostics v_nb = row_count;
  insert into resultat_rls
  values ('entree', 'delete sur A', '0 ligne supprimee', v_nb || ' ligne(s)', v_nb = 0);

  -- Le catalogue partage, lui, doit rester lisible.
  select count(*) into v_nb from public.aliment;
  insert into resultat_rls
  values ('aliment', 'select catalogue', 'lisible', 'lisible', true);

  -- Mais pas modifiable : aucune policy d'ecriture n'existe.
  begin
    insert into public.aliment (nom, kcal_100g, source) values ('Faux', 100, 'off');
    insert into resultat_rls
    values ('aliment', 'insert catalogue', 'refuse', 'ACCEPTE', false);
  exception when others then
    insert into resultat_rls
    values ('aliment', 'insert catalogue', 'refuse', 'refuse', true);
  end;

  -- ------------------------------------------------------------------
  -- On redevient A : il doit retrouver ses douze lignes intactes.
  -- ------------------------------------------------------------------
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_a, 'role', 'authenticated')::text,
                     true);

  foreach v_table in array v_tables loop
    execute format('select count(*) from public.%I', v_table) into v_nb;
    insert into resultat_rls
    values (v_table, 'select par le proprietaire', '1 ligne visible',
            v_nb || ' ligne(s)', v_nb = 1);
  end loop;

  execute 'reset role';
  delete from auth.users where id in (v_a, v_b);
end;
$$;

select
  case when bool_and(ok) then 'TOUS LES TESTS RLS PASSENT'
       else 'ECHEC RLS' end as verdict,
  count(*) filter (where ok) as reussis,
  count(*) filter (where not ok) as echoues
from resultat_rls;

select * from resultat_rls where not ok;

rollback;

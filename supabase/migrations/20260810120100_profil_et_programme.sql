-- Profil utilisateur et programmes de régime.
--
-- Les garde-fous de la section 9 de la spec sont implémentés ici en
-- base, par trigger. C'est la première des trois couches exigées : la
-- validation Zod et l'interface ne dispensent pas de celle-ci, parce
-- qu'un appel direct à l'API les contourne toutes les deux.

create table public.profil (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  sexe text not null check (sexe in ('h', 'f')),
  date_naissance date not null,
  taille_cm int not null check (taille_cm between 100 and 250),
  niveau_activite text not null default 'sedentaire'
    check (niveau_activite in ('sedentaire', 'leger', 'modere', 'soutenu', 'tres_soutenu')),
  mode_jours_manquants text not null default 'neutre'
    check (mode_jours_manquants in ('neutre', 'estime', 'strict')),
  unite_poids text not null default 'kg' check (unite_poids in ('kg', 'lb')),
  mode_discret boolean not null default false,
  -- Consentement au traitement de données de santé (RGPD art. 9),
  -- distinct de l'acceptation des CGU. Les deux sont horodatés.
  consentement_sante_le timestamptz,
  cgu_acceptees_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profil is
  'Un profil par utilisateur. Données de santé : RLS obligatoire.';
comment on column public.profil.date_naissance is
  'Sert au métabolisme de base et au contrôle des 18 ans.';
comment on column public.profil.mode_discret is
  'Masque les valeurs caloriques, n''affiche que complétude et tendance.';

-- Âge minimum de 18 ans (spec §9). En trigger et non en check : la
-- contrainte dépend de la date du jour, donc n'est pas immutable.
create or replace function public.verifier_age_profil()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.date_naissance > (current_date - interval '18 years') then
    raise exception 'Age minimum de 18 ans requis.'
      using errcode = 'check_violation', hint = 'age_minimum';
  end if;
  return new;
end;
$$;

create trigger profil_verifier_age
  before insert or update of date_naissance on public.profil
  for each row execute function public.verifier_age_profil();

create trigger profil_touch_updated_at
  before update on public.profil
  for each row execute function public.touch_updated_at();

create table public.programme (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  libelle text,
  type text not null check (type in ('deficit', 'surplus', 'maintien')),
  date_debut date not null,
  date_fin date,
  poids_depart_kg numeric(5, 2) not null check (poids_depart_kg between 30 and 400),
  poids_cible_kg numeric(5, 2) check (poids_cible_kg between 30 and 400),
  allure_cible_kg_semaine numeric(4, 3),
  objectif_kcal int,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint programme_dates_coherentes check (date_fin is null or date_fin >= date_debut)
);

comment on table public.programme is
  'Une période de régime. Les cumuls se calculent par programme, jamais depuis l''inscription.';

-- Un seul programme actif par utilisateur.
create unique index programme_un_seul_actif
  on public.programme (user_id)
  where actif;

create index programme_user_date on public.programme (user_id, date_debut desc);

-- Garde-fous de la section 9. Un check ne peut pas lire une autre
-- table : il faut un trigger pour croiser `programme` et `profil`.
create or replace function public.verifier_gardefous_programme()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_sexe text;
  v_taille_cm int;
  v_plancher_kcal int;
  v_imc_cible numeric;
  v_allure_max numeric;
begin
  select sexe, taille_cm into v_sexe, v_taille_cm
  from public.profil
  where user_id = new.user_id;

  if not found then
    raise exception 'Profil introuvable : renseignez votre profil avant de créer un programme.'
      using errcode = 'foreign_key_violation', hint = 'profil_requis';
  end if;

  -- Plancher calorique : 1 200 kcal (femme), 1 500 kcal (homme).
  if new.objectif_kcal is not null then
    v_plancher_kcal := case v_sexe when 'f' then 1200 else 1500 end;
    if new.objectif_kcal < v_plancher_kcal then
      raise exception 'Objectif calorique sous le plancher de % kcal.', v_plancher_kcal
        using errcode = 'check_violation', hint = 'plancher_calorique';
    end if;
  end if;

  -- Aucun poids cible conduisant à un IMC inférieur à 18,5.
  if new.poids_cible_kg is not null then
    v_imc_cible := new.poids_cible_kg / ((v_taille_cm / 100.0) ^ 2);
    if v_imc_cible < 18.5 then
      raise exception 'Poids cible conduisant à un IMC de %, inférieur au minimum de 18,5.',
        round(v_imc_cible, 1)
        using errcode = 'check_violation', hint = 'imc_minimum';
    end if;
  end if;

  -- Allure limitée à 1 % du poids corporel par semaine, dans les deux
  -- sens : une prise de masse trop rapide est bornée comme une perte.
  if new.allure_cible_kg_semaine is not null then
    v_allure_max := 0.01 * new.poids_depart_kg;
    if abs(new.allure_cible_kg_semaine) > v_allure_max then
      raise exception 'Allure de % kg/semaine au-delà du maximum de % kg/semaine.',
        abs(new.allure_cible_kg_semaine), round(v_allure_max, 3)
        using errcode = 'check_violation', hint = 'allure_maximale';
    end if;
  end if;

  return new;
end;
$$;

create trigger programme_verifier_gardefous
  before insert or update on public.programme
  for each row execute function public.verifier_gardefous_programme();

create trigger programme_touch_updated_at
  before update on public.programme
  for each row execute function public.touch_updated_at();

-- Base d'aliments : catalogue partagé, créations utilisateur, recettes.
--
-- `aliment` est la seule table non rattachée à un utilisateur : c'est un
-- cache d'Open Food Facts et de CIQUAL, alimenté par le serveur.

create table public.aliment (
  id uuid primary key default gen_random_uuid(),
  code_barres text unique,
  nom text not null,
  marque text,
  kcal_100g numeric(6, 1) not null check (kcal_100g >= 0),
  proteines_100g numeric(6, 2) check (proteines_100g >= 0),
  glucides_100g numeric(6, 2) check (glucides_100g >= 0),
  lipides_100g numeric(6, 2) check (lipides_100g >= 0),
  fibres_100g numeric(6, 2) check (fibres_100g >= 0),
  sucres_100g numeric(6, 2) check (sucres_100g >= 0),
  sel_100g numeric(6, 3) check (sel_100g >= 0),
  satures_100g numeric(6, 2) check (satures_100g >= 0),
  -- Liste de { libelle, grammes } : « 1 tranche » = 30 g.
  portions jsonb not null default '[]'::jsonb,
  source text not null check (source in ('off', 'ciqual')),
  source_ref text,
  qualite_score int check (qualite_score between 0 and 100),
  rafraichi_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  recherche tsvector generated always as (
    to_tsvector(
      'french',
      public.f_unaccent(coalesce(nom, '') || ' ' || coalesce(marque, ''))
    )
  ) stored
);

comment on table public.aliment is
  'Catalogue partagé (Open Food Facts, CIQUAL). Lecture par tout utilisateur authentifié, écriture serveur uniquement. Open Food Facts est publiée sous licence ODbL : attribution obligatoire dans l''application.';

create index aliment_recherche_gin on public.aliment using gin (recherche);
create index aliment_nom_trgm on public.aliment using gin (nom extensions.gin_trgm_ops);

create trigger aliment_touch_updated_at
  before update on public.aliment
  for each row execute function public.touch_updated_at();

-- Aliments créés ou corrigés par un utilisateur. Toujours prioritaires
-- dans les résultats de recherche.
create table public.aliment_utilisateur (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Renseigné quand il s'agit de la correction d'un aliment public.
  aliment_source_id uuid references public.aliment (id) on delete set null,
  code_barres text,
  nom text not null,
  marque text,
  kcal_100g numeric(6, 1) not null check (kcal_100g >= 0),
  proteines_100g numeric(6, 2) check (proteines_100g >= 0),
  glucides_100g numeric(6, 2) check (glucides_100g >= 0),
  lipides_100g numeric(6, 2) check (lipides_100g >= 0),
  fibres_100g numeric(6, 2) check (fibres_100g >= 0),
  sucres_100g numeric(6, 2) check (sucres_100g >= 0),
  sel_100g numeric(6, 3) check (sel_100g >= 0),
  satures_100g numeric(6, 2) check (satures_100g >= 0),
  portions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  recherche tsvector generated always as (
    to_tsvector(
      'french',
      public.f_unaccent(coalesce(nom, '') || ' ' || coalesce(marque, ''))
    )
  ) stored
);

create index aliment_utilisateur_user on public.aliment_utilisateur (user_id, nom);
create index aliment_utilisateur_recherche_gin
  on public.aliment_utilisateur using gin (recherche);

create trigger aliment_utilisateur_touch_updated_at
  before update on public.aliment_utilisateur
  for each row execute function public.touch_updated_at();

create table public.recette (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nom text not null,
  portions int not null default 1 check (portions > 0),
  poids_total_g numeric(7, 2) check (poids_total_g > 0),
  -- Valeurs par portion, recalculées à chaque modification d'ingrédient.
  kcal_portion numeric(7, 1),
  proteines_portion_g numeric(6, 2),
  glucides_portion_g numeric(6, 2),
  lipides_portion_g numeric(6, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recette_user on public.recette (user_id, nom);

create trigger recette_touch_updated_at
  before update on public.recette
  for each row execute function public.touch_updated_at();

create table public.recette_ingredient (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recette_id uuid not null references public.recette (id) on delete cascade,
  aliment_id uuid references public.aliment (id) on delete set null,
  aliment_utilisateur_id uuid references public.aliment_utilisateur (id) on delete set null,
  libelle text not null,
  quantite numeric(7, 2) not null check (quantite > 0),
  unite text not null default 'g',
  quantite_g numeric(7, 2) not null check (quantite_g > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recette_ingredient_recette on public.recette_ingredient (recette_id);

create trigger recette_ingredient_touch_updated_at
  before update on public.recette_ingredient
  for each row execute function public.touch_updated_at();

-- Un ensemble d'entrées rejouable en un geste : le petit-déjeuner
-- habituel doit se saisir en moins de 5 secondes (critère §14).
create table public.repas_enregistre (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nom text not null,
  repas_par_defaut text
    check (repas_par_defaut in ('petit_dejeuner', 'dejeuner', 'diner', 'collation')),
  contenu jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index repas_enregistre_user on public.repas_enregistre (user_id, nom);

create trigger repas_enregistre_touch_updated_at
  before update on public.repas_enregistre
  for each row execute function public.touch_updated_at();

-- Journal alimentaire, pesées, mesures et instantanés de calcul.

create table public.journee (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  programme_id uuid references public.programme (id) on delete set null,
  date date not null,
  -- Colonnes agrégées, dénormalisées et recalculées à chaque écriture.
  -- Ne pas les calculer à la volée en lecture : le tableau de bord doit
  -- s'afficher en une requête.
  apport_kcal numeric(7, 1) not null default 0,
  proteines_g numeric(6, 2) not null default 0,
  glucides_g numeric(6, 2) not null default 0,
  lipides_g numeric(6, 2) not null default 0,
  depense_retenue_kcal numeric(7, 1),
  deficit_kcal numeric(7, 1),
  statut text not null default 'manquant'
    check (statut in ('renseigne', 'estime', 'manquant')),
  -- Enregistrée et affichée, mais n'entre dans aucun cumul : la dépense
  -- réelle recalculée la contient déjà. Voir CLAUDE.md.
  activite_kcal numeric(6, 1) not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journee_unique_par_jour unique (user_id, date)
);

comment on column public.journee.activite_kcal is
  'Activité déclarée. Affichée mais hors calcul du déficit : la dépense retenue l''inclut déjà.';

create index journee_user_date on public.journee (user_id, date desc);
create index journee_programme on public.journee (programme_id, date desc);

create trigger journee_touch_updated_at
  before update on public.journee
  for each row execute function public.touch_updated_at();

create table public.entree (
  -- UUID généré par le client : c'est ce qui rend la synchronisation
  -- idempotente. Rejouer une écriture ne crée jamais de doublon.
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  journee_id uuid not null references public.journee (id) on delete cascade,
  aliment_id uuid references public.aliment (id) on delete set null,
  aliment_utilisateur_id uuid references public.aliment_utilisateur (id) on delete set null,
  recette_id uuid references public.recette (id) on delete set null,
  libelle text not null,
  repas text not null
    check (repas in ('petit_dejeuner', 'dejeuner', 'diner', 'collation')),
  quantite numeric(7, 2) not null check (quantite > 0),
  unite text not null default 'g',
  quantite_g numeric(7, 2) check (quantite_g > 0),
  -- Valeurs figées à la saisie. Si la base d'aliments est corrigée six
  -- mois plus tard, l'historique ne se réécrit pas : c'est une exigence
  -- de justesse et de confiance, pas une optimisation.
  kcal numeric(7, 1) not null check (kcal >= 0),
  proteines_g numeric(6, 2) check (proteines_g >= 0),
  glucides_g numeric(6, 2) check (glucides_g >= 0),
  lipides_g numeric(6, 2) check (lipides_g >= 0),
  source text not null
    check (source in ('off', 'ciqual', 'utilisateur', 'recette', 'rapide')),
  saisi_le timestamptz not null default now(),
  -- Suppression logique : un `delete` ferait ressusciter l'entrée au
  -- prochain passage de la file d'attente d'un autre appareil (spec §8).
  supprime_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.entree.supprime_le is
  'Suppression logique horodatée, pour que la synchro multi-appareils ne ressuscite pas une entrée effacée.';

create index entree_journee on public.entree (journee_id) where supprime_le is null;
create index entree_user_saisi on public.entree (user_id, saisi_le desc);

create trigger entree_touch_updated_at
  before update on public.entree
  for each row execute function public.touch_updated_at();

create table public.pesee (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  poids_kg numeric(5, 2) not null check (poids_kg between 30 and 400),
  moyenne_mobile_7j_kg numeric(5, 2),
  -- Enregistrée, marquée, exclue de la moyenne. Jamais rejetée.
  aberrante boolean not null default false,
  confirmee boolean not null default false,
  source text not null default 'manuelle' check (source in ('manuelle', 'import')),
  supprime_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pesee_unique_par_jour unique (user_id, date)
);

comment on column public.pesee.confirmee is
  'Une pesée aberrante est proposée à la confirmation de l''utilisateur plutôt qu''écrasée.';

create index pesee_user_date on public.pesee (user_id, date desc);

create trigger pesee_touch_updated_at
  before update on public.pesee
  for each row execute function public.touch_updated_at();

create table public.mesure (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  type text not null,
  valeur_cm numeric(5, 1) not null check (valeur_cm > 0),
  supprime_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mesure_unique_par_type_et_jour unique (user_id, date, type)
);

create index mesure_user_date on public.mesure (user_id, date desc);

create trigger mesure_touch_updated_at
  before update on public.mesure
  for each row execute function public.touch_updated_at();

create table public.photo_progression (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  -- Chemin dans le bucket privé, toujours préfixé par l'identifiant de
  -- l'utilisateur. Aucun accès direct : URL signée générée côté serveur.
  storage_path text not null unique,
  angle text check (angle in ('face', 'profil', 'dos')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index photo_progression_user_date on public.photo_progression (user_id, date desc);

create trigger photo_progression_touch_updated_at
  before update on public.photo_progression
  for each row execute function public.touch_updated_at();

-- Photographie quotidienne des indicateurs : affichage en une requête,
-- et trace de ce qui a effectivement été montré à l'utilisateur.
create table public.instantane_calcul (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  programme_id uuid not null references public.programme (id) on delete cascade,
  date date not null,
  deficit_cumul_kcal numeric(9, 1) not null,
  kg_theoriques numeric(5, 2) not null,
  kg_reels numeric(5, 2),
  ecart_kg numeric(5, 2),
  depense_reelle_kcal numeric(7, 1),
  depense_retenue_kcal numeric(7, 1) not null,
  depense_issue_du_reel boolean not null default false,
  fiabilite numeric(3, 2) not null default 0,
  allure_kg_semaine numeric(4, 3),
  -- La spec écrit « complétude » avec accent ; un identifiant SQL
  -- accentué impose des guillemets partout. Nom sans accent, valeur
  -- inchangée.
  completude numeric(4, 3) not null default 0,
  jours_renseignes int not null default 0,
  jours_total int not null default 0,
  projection_date date,
  calcule_le timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint instantane_unique_par_jour unique (user_id, programme_id, date)
);

comment on table public.instantane_calcul is
  'Un instantané par jour et par programme. Aucun indicateur cumulé ne s''affiche sans sa complétude.';

create index instantane_user_programme_date
  on public.instantane_calcul (user_id, programme_id, date desc);

create trigger instantane_calcul_touch_updated_at
  before update on public.instantane_calcul
  for each row execute function public.touch_updated_at();

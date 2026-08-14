-- Planification hebdomadaire de repas et liste de courses, générées par IA.
--
-- Une ligne par utilisateur et par semaine (lundi de début) : régénérer
-- écrase le plan de la semaine en cours plutôt que d'empiler des
-- versions. `plan` et `liste_courses` restent en jsonb, comme
-- `repas_enregistre.contenu` ou `aliment.portions` : un contenu généré
-- par IA et affiché tel quel n'a pas besoin d'un schéma relationnel.

create table public.planification_semaine (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  semaine_debut date not null,
  nb_repas_jour int not null check (nb_repas_jour in (3, 4)),
  objectif_kcal_jour numeric(7, 1) not null check (objectif_kcal_jour > 0),
  -- { jours: [{ jour, repas: [{ repas, libelle, kcalEstime }] }] }
  plan jsonb not null,
  -- [{ categorie, item, quantite }]
  liste_courses jsonb not null,
  -- { "categorie::item": true } — clés cochées, absentes sinon.
  courses_cochees jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planification_unique_semaine unique (user_id, semaine_debut)
);

create index planification_user_semaine on public.planification_semaine (user_id, semaine_debut desc);

create trigger planification_touch_updated_at
  before update on public.planification_semaine
  for each row execute function public.touch_updated_at();

-- RLS posée ici plutôt que dans l'ancien fichier central de policies
-- (20260810120400_rls.sql) : ce fichier a déjà été appliqué en
-- production, on n'y touche pas rétroactivement. Mêmes quatre policies,
-- même modèle « une ligne appartient à un utilisateur ».
alter table public.planification_semaine enable row level security;

create policy "lecture proprietaire" on public.planification_semaine
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "insertion proprietaire" on public.planification_semaine
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "modification proprietaire" on public.planification_semaine
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "suppression proprietaire" on public.planification_semaine
  for delete to authenticated
  using ((select auth.uid()) = user_id);

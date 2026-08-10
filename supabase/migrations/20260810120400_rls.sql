-- Row Level Security.
--
-- Ce sont des données de santé. Une table sans policy est un bug
-- bloquant, pas une dette technique. Le modèle est simple et uniforme :
-- chaque ligne appartient à un utilisateur, et `auth.uid()` est la seule
-- autorité.
--
-- `aliment` fait exception : catalogue partagé, lisible par tout
-- utilisateur authentifié, écrit uniquement par le serveur.

alter table public.profil enable row level security;
alter table public.programme enable row level security;
alter table public.journee enable row level security;
alter table public.entree enable row level security;
alter table public.aliment enable row level security;
alter table public.aliment_utilisateur enable row level security;
alter table public.recette enable row level security;
alter table public.recette_ingredient enable row level security;
alter table public.repas_enregistre enable row level security;
alter table public.pesee enable row level security;
alter table public.mesure enable row level security;
alter table public.photo_progression enable row level security;
alter table public.instantane_calcul enable row level security;

-- Les tables appartenant à un utilisateur suivent toutes le même
-- modèle. Une boucle plutôt que treize paires copiées-collées : une
-- policy oubliée à la relecture serait invisible.
do $$
declare
  v_table text;
  v_tables text[] := array[
    'profil',
    'programme',
    'journee',
    'entree',
    'aliment_utilisateur',
    'recette',
    'recette_ingredient',
    'repas_enregistre',
    'pesee',
    'mesure',
    'photo_progression',
    'instantane_calcul'
  ];
begin
  foreach v_table in array v_tables loop
    execute format(
      'create policy "lecture proprietaire" on public.%I
         for select to authenticated
         using ((select auth.uid()) = user_id)',
      v_table
    );

    execute format(
      'create policy "insertion proprietaire" on public.%I
         for insert to authenticated
         with check ((select auth.uid()) = user_id)',
      v_table
    );

    execute format(
      'create policy "modification proprietaire" on public.%I
         for update to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)',
      v_table
    );

    execute format(
      'create policy "suppression proprietaire" on public.%I
         for delete to authenticated
         using ((select auth.uid()) = user_id)',
      v_table
    );
  end loop;
end;
$$;

-- Catalogue partagé : lecture pour tout utilisateur authentifié.
-- Aucune policy d'écriture n'est créée : `service_role` contourne la RLS
-- et reste le seul à pouvoir alimenter la table. Un utilisateur qui veut
-- corriger une valeur passe par `aliment_utilisateur`.
create policy "lecture authentifiee" on public.aliment
  for select to authenticated
  using (true);

comment on policy "lecture authentifiee" on public.aliment is
  'Catalogue public. Écriture réservée au serveur : aucune policy insert/update/delete n''existe.';

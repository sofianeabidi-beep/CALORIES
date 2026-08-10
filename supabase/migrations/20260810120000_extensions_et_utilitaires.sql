-- Extensions et utilitaires partagés.
--
-- Les extensions vont dans le schéma `extensions`, convention Supabase :
-- les laisser dans `public` les exposerait à l'API PostgREST.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- `unaccent` n'est pas marquée immutable, ce qui interdit son usage
-- direct dans une colonne générée ou un index. Cette enveloppe l'est :
-- le dictionnaire est figé par son nom qualifié, donc le résultat ne
-- dépend plus d'un `search_path` qui pourrait changer.
create or replace function public.f_unaccent(texte text)
returns text
language sql
immutable
strict
parallel safe
set search_path = extensions, public
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, texte)
$$;

comment on function public.f_unaccent(text) is
  'Version immutable de unaccent, utilisable en colonne générée et en index.';

-- Tenue automatique de `updated_at`. Rien ne garantit qu'un client la
-- mette à jour, et la synchronisation multi-appareils en dépend.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.touch_updated_at() is
  'Trigger BEFORE UPDATE : force updated_at à now().';

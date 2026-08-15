-- Photo de profil, optionnelle.
--
-- Bucket public, à la différence de `progression` (privé) : une photo de
-- profil n'est pas une donnée de santé au même titre qu'une photo de
-- suivi corporel, et la servir en URL publique évite de générer une URL
-- signée à chaque affichage. L'écriture reste restreinte au propriétaire
-- via le préfixe {user_id}/ du chemin, même modèle que `progression`.
--
-- Chemin fixe sans extension, {user_id}/avatar : un seul objet par
-- utilisateur quel que soit le format envoyé (upsert + content-type
-- explicite à l'upload), pas de fichier orphelin en cas de changement de
-- format entre deux envois.

alter table public.profil
  add column photo_url text;

comment on column public.profil.photo_url is
  'URL publique de la photo de profil, dans le bucket avatars. NULL tant que non renseignée.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "depot photo proprietaire" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "remplacement photo proprietaire" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "suppression photo proprietaire" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

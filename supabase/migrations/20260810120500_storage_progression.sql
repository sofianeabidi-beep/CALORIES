-- Bucket privé des photos de progression.
--
-- Chemin imposé : {user_id}/{photo_id}.jpg — l'identité se dérive du
-- premier segment. Aucun objet public, aucun accès direct : tout
-- téléchargement passe par une URL signée générée côté serveur, valable
-- cinq minutes.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'progression',
  'progression',
  false,
  10485760, -- 10 Mo
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "lecture photos proprietaire" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'progression'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "depot photos proprietaire" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'progression'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "remplacement photos proprietaire" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'progression'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'progression'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "suppression photos proprietaire" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'progression'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

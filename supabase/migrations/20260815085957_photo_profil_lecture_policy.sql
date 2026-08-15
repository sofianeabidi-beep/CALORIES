-- Policy de lecture manquante sur le bucket avatars, découverte en
-- vérifiant l'upload en conditions réelles : `upload(..., { upsert: true })`
-- échouait avec « new row violates row-level security policy » alors que
-- la policy d'insertion et le chemin étaient corrects — l'upsert du
-- service Storage a besoin de pouvoir lire l'objet existant (ou son
-- absence) avant d'écrire, ce que ne permettait aucune policy select
-- pour ce bucket.

create policy "lecture photo proprietaire" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

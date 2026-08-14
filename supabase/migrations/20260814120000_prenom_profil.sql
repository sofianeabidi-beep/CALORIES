-- Prénom optionnel, affiché en tête de l'écran Aujourd'hui.
--
-- Recueilli en Réglages, jamais à l'inscription — même raison que la
-- taille (20260812120000) : moins de champs pour ouvrir un compte.
-- NULL tant que non renseigné ; l'email sert de repli à l'affichage.

alter table public.profil
  add column prenom text check (prenom is null or char_length(prenom) between 1 and 60);

comment on column public.profil.prenom is
  'Optionnel, saisi depuis Réglages. NULL tant que non renseigné — l''email sert de repli à l''affichage.';

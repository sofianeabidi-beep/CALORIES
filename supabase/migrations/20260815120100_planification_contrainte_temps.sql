-- Mémorise la contrainte de temps choisie à la génération, pour que les
-- recettes ouvertes depuis le plan (« Voir la recette ») restent
-- cohérentes avec ce qui a été demandé (rapide vs élaboré) sans le
-- redemander à l'utilisateur à chaque fois.

alter table public.planification_semaine
  add column contrainte_temps text not null default 'rapide'
    check (contrainte_temps in ('rapide', 'elabore'));

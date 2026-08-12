-- Une source de plus pour `entree` : les valeurs nutritionnelles
-- estimées par IA à partir d'une description libre (plat maison sans
-- code-barres ni fiche CIQUAL). Distincte de 'rapide' : l'interface a
-- besoin de savoir qu'un chiffre est une estimation à vérifier, pas une
-- valeur sûre — même principe d'honnêteté que `depense_issue_du_reel`
-- sur `instantane_calcul`.

alter table public.entree drop constraint entree_source_check;

alter table public.entree add constraint entree_source_check
  check (source = any (array[
    'off', 'ciqual', 'utilisateur', 'recette', 'rapide', 'estimation_ia'
  ]));

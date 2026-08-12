-- La taille se recueille désormais à la création du programme, plus à
-- l'inscription (décision produit du 2026-08-12) : moins de champs pour
-- ouvrir un compte, la taille arrive au moment où elle sert vraiment
-- (garde-fou d'IMC cible, dépense de Mifflin-St Jeor du programme).

alter table public.profil alter column taille_cm drop not null;

-- Renforce le trigger de garde-fous en conséquence. Sans ce contrôle
-- explicite, un poids cible arrivant avant que la taille soit connue
-- comparerait un IMC à `null` — en SQL, `null < 18.5` ne vaut ni vrai
-- ni faux, l'exception ne se déclencherait jamais et le garde-fou
-- serait silencieusement contourné plutôt que bloqué.
create or replace function public.verifier_gardefous_programme()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_sexe text;
  v_taille_cm int;
  v_plancher_kcal int;
  v_imc_cible numeric;
  v_allure_max numeric;
begin
  select sexe, taille_cm into v_sexe, v_taille_cm
  from public.profil
  where user_id = new.user_id;

  if not found then
    raise exception 'Profil introuvable : renseignez votre profil avant de créer un programme.'
      using errcode = 'foreign_key_violation', hint = 'profil_requis';
  end if;

  if v_taille_cm is null then
    raise exception 'Taille manquante : renseignez-la pour créer un programme.'
      using errcode = 'check_violation', hint = 'taille_requise';
  end if;

  if new.objectif_kcal is not null then
    v_plancher_kcal := case v_sexe when 'f' then 1200 else 1500 end;
    if new.objectif_kcal < v_plancher_kcal then
      raise exception 'Objectif calorique sous le plancher de % kcal.', v_plancher_kcal
        using errcode = 'check_violation', hint = 'plancher_calorique';
    end if;
  end if;

  if new.poids_cible_kg is not null then
    v_imc_cible := new.poids_cible_kg / ((v_taille_cm / 100.0) ^ 2);
    if v_imc_cible < 18.5 then
      raise exception 'Poids cible conduisant à un IMC de %, inférieur au minimum de 18,5.',
        round(v_imc_cible, 1)
        using errcode = 'check_violation', hint = 'imc_minimum';
    end if;
  end if;

  if new.allure_cible_kg_semaine is not null then
    v_allure_max := 0.01 * new.poids_depart_kg;
    if abs(new.allure_cible_kg_semaine) > v_allure_max then
      raise exception 'Allure de % kg/semaine au-delà du maximum de % kg/semaine.',
        abs(new.allure_cible_kg_semaine), round(v_allure_max, 3)
        using errcode = 'check_violation', hint = 'allure_maximale';
    end if;
  end if;

  return new;
end;
$$;

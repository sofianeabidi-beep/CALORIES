-- Compte d'essai pour le parcours Playwright authentifié.
--
-- Pourquoi en SQL plutôt que par le formulaire d'inscription : GoTrue
-- refuse les domaines de test (`.test`, `example.com`), et si la
-- confirmation par courriel est active, `signUp` ne rend pas de session.
-- Un test qui dépend d'un envoi de courriel n'est pas un test.
--
-- **Change le mot de passe ci-dessous avant de l'exécuter**, et ne
-- réutilise jamais un mot de passe réel : ce compte contient des données
-- de santé et sa création contourne le parcours normal.
--
-- Puis :
--   CALORYES_E2E_EMAIL=essai@caloryes.invalid \
--   CALORYES_E2E_MOTDEPASSE=… \
--   npm run e2e
--
-- Pour le supprimer, la cascade fait le reste :
--   delete from auth.users where email = 'essai@caloryes.invalid';

\set email 'essai@caloryes.invalid'
\set motdepasse 'a-remplacer'

with nouvel_utilisateur as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    -- GoTrue lit ces colonnes comme des chaînes non nulles : les
    -- laisser à NULL fait échouer l'authentification avec un message
    -- qui ne désigne pas la cause.
    confirmation_token, recovery_token, email_change_token_new,
    email_change_token_current, email_change, phone_change,
    phone_change_token, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data
  )
  values (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
    'authenticated', 'authenticated', :'email',
    extensions.crypt(:'motdepasse', extensions.gen_salt('bf')),
    now(), now(), now(), '', '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
  )
  returning id
), profil_cree as (
  -- Homme de 36 ans, 180 cm : le profil du scénario de référence, celui
  -- dont les chiffres sont vérifiables à la main dans les tests.
  insert into public.profil (user_id, sexe, date_naissance, taille_cm,
                             niveau_activite, mode_jours_manquants,
                             consentement_sante_le, cgu_acceptees_le)
  select id, 'h', '1990-06-15', 180, 'modere', 'neutre', now(), now()
  from nouvel_utilisateur
  returning user_id
)
insert into public.programme (user_id, libelle, type, date_debut,
                              poids_depart_kg, poids_cible_kg,
                              allure_cible_kg_semaine)
select user_id, 'Essai', 'deficit', current_date, 80, 75, -0.5
from profil_cree
returning user_id, id as programme_id;

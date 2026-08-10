# Caloryes

Suivi calorique raisonnant en **capital cumulé** plutôt qu'en journées isolées.

Quatre chiffres, et un seul qui compte vraiment :

1. le déficit ou le surplus cumulé depuis le début du programme ;
2. sa conversion en kilos théoriques ;
3. **la confrontation aux kilos réellement mesurés** ;
4. le taux de complétude des données, qui conditionne la validité des trois autres.

Le point 3 est le produit. L'écart entre théorie et réalité n'est pas une erreur à masquer :
il permet de recalculer la dépense énergétique réelle de l'utilisateur, toujours différente
de ce qu'une formule prédit.

Spécifications : [`MD/SPEC-CLAUDE-CODE-calories.md`](MD/SPEC-CLAUDE-CODE-calories.md) et
[`MD/brief-suivi-calorique.md`](MD/brief-suivi-calorique.md).
Conventions et décisions d'architecture : [`CLAUDE.md`](CLAUDE.md).

## Prérequis

- Node 20.9 ou plus. **Node 22 LTS recommandé** : sous 20.19, Vitest 4 ne démarre pas et le
  projet est tenu en Vitest 3 pour cette raison.
- Un compte Supabase et un projet en **région UE** — ce sont des données de santé.

## Installation

```bash
npm install
cp .env.example .env.local
```

Renseigner `.env.local` avec les valeurs du projet Supabase (Settings → API).
`SUPABASE_SERVICE_ROLE_KEY` ne doit jamais être préfixée `NEXT_PUBLIC_` ni importée depuis
un composant client : elle contourne la RLS.

## Base de données

Les migrations sont versionnées dans `supabase/migrations/`. **Aucune modification de schéma
ne passe par l'interface Supabase** : elle serait perdue au prochain déploiement et
invisible en revue.

```bash
npx supabase link --project-ref <ref-du-projet>
npx supabase db push
```

Pour repartir de zéro en local (nécessite Docker) :

```bash
npx supabase start
npx supabase db reset
```

## Développement

```bash
npm run dev
```

## Vérification

```bash
npm run verify
```

Enchaîne `typecheck`, `lint` et les tests avec couverture. Le seuil de **100 % sur
`lib/calcul/`** est imposé par `vitest.config.ts` : une ligne non couverte fait échouer la
commande. C'est délibéré — une erreur dans le moteur est invisible et se propage à tous les
chiffres du produit.

```bash
npm run e2e      # parcours Playwright, cible mobile 375 px
```

## Structure

```
app/          routes App Router — (auth) et (app)
lib/calcul/   moteur pur : ni Supabase, ni réseau, ni horloge, ni locale
lib/supabase/ clients navigateur / serveur / middleware
lib/actions/  une Server Action par domaine
lib/validations/ schémas Zod partagés client et serveur
components/   saisie/ bilan/ ui/
supabase/migrations/  migrations versionnées et datées
tests/calcul/ tests unitaires du moteur
tests/e2e/    Playwright
```

## Avancement

**Phase 1 terminée et vérifiée contre une base réelle.** Projet Supabase `caloryes`,
région `eu-west-3` (Paris).

Vérifié le 2026-08-10, application lancée et pilotée de bout en bout :

- les six migrations passent sur une base vierge ;
- les treize tables portent la RLS, quatre policies chacune sauf `aliment` (lecture seule
  authentifiée, écriture serveur) ;
- les huit garde-fous se déclenchent en base — âge, plancher calorique par sexe, IMC cible,
  allure dans les deux sens, unicité du programme actif ;
- les trois garde-fous remontent aussi dans l'interface, chacun sur son champ, avec les
  valeurs calculées (59,9 kg pour 1,80 m, 0,80 kg/semaine à 80 kg, 1 500 kcal) ;
- la chaîne de calcul est juste et recalculable à la main : profil homme 36 ans, 180 cm,
  niveau modéré → `(10×80 + 6,25×180 − 5×36 + 5) × 1,55 = 2 712,5 kcal`, moins 600 kcal
  saisis = **2 112,5 kcal de déficit**, soit 0,27 kg théoriques ;
- une pesée à 79,4 kg réduit la dépense à 2 703 kcal et l'écart théorie/réel est interprété
  dans le bon sens ;
- la suppression du compte efface tout par cascade.

### Tests RLS

`supabase/tests/rls.sql` — **29 tests, tous verts**. Deux utilisateurs, un jeu complet de
données appartenant à A, et la vérification que B ne voit ni ne touche rien : lecture à
zéro ligne sur les douze tables, écriture au nom de A refusée, modification et suppression
sans effet. Puis A retrouve ses douze lignes intactes.

Le test prend l'identité d'un utilisateur en posant `request.jwt.claims` et en basculant sur
le rôle `authenticated`, exactement comme PostgREST. Sous le rôle propriétaire la RLS serait
contournée et le test ne prouverait rien. Il se termine par un `rollback` : la base est
rendue telle quelle.

À rejouer après toute migration, en collant le contenu du fichier dans le SQL Editor du
dashboard.

### Parcours authentifié

`tests/e2e/journee.spec.ts` suit une journée de bout en bout : connexion, vérification de la
dépense de Mifflin-St Jeor, saisie d'un repas, répercussion exacte sur le restant, et
présence de la complétude à côté du cumul.

Il a besoin d'un compte de test — voir `supabase/tests/compte-essai.sql`, à exécuter après
avoir changé le mot de passe qu'il contient. Sans les variables ci-dessous le parcours est
ignoré, pour que `npm run e2e` reste vert sur une machine sans compte de test.

```bash
CALORYES_E2E_EMAIL=essai@caloryes.invalid CALORYES_E2E_MOTDEPASSE=… npm run e2e
```

Reste à faire avant la phase 2 : tester l'inscription avec un domaine de courriel accepté
par Supabase.

Voir `CLAUDE.md` pour les décisions prises et les points ouverts.

## Licences des sources de données

Le catalogue d'aliments s'appuiera (phase 2) sur **Open Food Facts**, publiée sous licence
**ODbL** : attribution obligatoire dans l'application, et partage à l'identique de toute base
dérivée redistribuée. À faire valider avant toute mise en production commerciale.

**CIQUAL** (ANSES) sert de référence pour les aliments bruts et cuisinés.

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

Phase 1 en cours. Voir `CLAUDE.md` pour les décisions prises et les points ouverts.

## Licences des sources de données

Le catalogue d'aliments s'appuiera (phase 2) sur **Open Food Facts**, publiée sous licence
**ODbL** : attribution obligatoire dans l'application, et partage à l'identique de toute base
dérivée redistribuée. À faire valider avant toute mise en production commerciale.

**CIQUAL** (ANSES) sert de référence pour les aliments bruts et cuisinés.

# Caloryes — conventions et décisions

Application de suivi calorique raisonnant en **capital cumulé** et non en journées isolées.
Documents de référence : `MD/SPEC-CLAUDE-CODE-calories.md` et `MD/brief-suivi-calorique.md`.
Ils font autorité. Ce fichier ne les résume pas : il consigne les conventions et les
**écarts assumés**.

## Les deux choses à ne jamais dégrader

1. **La rapidité de saisie.** Moins de 10 s pour un repas habituel. Jamais de spinner
   bloquant sur une saisie.
2. **L'honnêteté des indicateurs.** Aucun indicateur cumulé ne s'affiche sans son taux de
   complétude. Un déficit calculé sur 40 % des jours ne vaut rien et l'utilisateur doit le
   voir.

Ce sont les deux raisons d'exister du produit.

## Conventions de nommage

**Le domaine métier est en français, le code technique en anglais.** Règle tenue jusqu'au
bout, sans exception ponctuelle.

- Domaine (français) : `journee`, `pesee`, `deficit_kcal`, `depenseRetenue`,
  `calculerDeficitCumule`, routes `/aujourdhui`, `/bilan`.
- Technique (anglais) : `useState`, `createClient`, `middleware`, `export default`,
  `describe`/`it`, noms de fichiers de config.
- SQL : `snake_case` français, sans accent dans les identifiants.
- TypeScript : `camelCase` pour les variables, `PascalCase` pour les types et composants.

Les colonnes SQL et les champs TypeScript portent le **même nom** (`deficit_kcal` ↔
`deficitKcal`) pour rendre le mapping mécanique.

**Les unités sont dans le nom.** `poidsKg`, `tailleCm`, `apportKcal`, `quantiteG`. Une
variable numérique sans unité dans son nom est un bug en puissance : le moteur mélange des
kcal, des kg et des grammes.

## Commandes

```bash
npm run dev            # serveur de développement
npm run build          # build de production
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run test           # vitest, une passe
npm run test:coverage  # vitest + couverture (seuils imposés)
npm run e2e            # playwright
npm run verify         # typecheck + lint + couverture — à passer avant d'annoncer une tâche finie
```

## Structure

```
app/          routes App Router — (auth) et (app)
lib/calcul/   moteur pur : aucun import de Supabase, de React, ni d'horloge
lib/supabase/ clients navigateur / serveur / middleware
lib/actions/  une Server Action par domaine
lib/validations/ schémas Zod partagés client et serveur
lib/local/    Dexie, outbox, synchronisation (phase 2)
components/   saisie/ bilan/ ui/
supabase/migrations/  migrations versionnées et datées
tests/calcul/ tests unitaires du moteur
tests/e2e/    Playwright
```

## Règles d'architecture

- **`lib/calcul/` est une bibliothèque pure.** Aucun accès base ni réseau, aucun
  `Date.now()`, aucune dépendance à la locale. Toute date entre en `YYYY-MM-DD`. La date du
  jour est **toujours un paramètre**, jamais lue depuis l'horloge : c'est ce qui rend le
  moteur testable et reproductible. Couverture 100 %, seuil imposé par `vitest.config.ts`.
- **Toutes les mutations passent par des Server Actions ou des Route Handlers**, avec
  validation Zod côté serveur — jamais côté client seulement.
- **RLS activée sur toutes les tables sans exception.** Une table sans policy est un bug
  bloquant. Ce sont des données de santé.
- **La `service_role key` ne quitte jamais le serveur.** Aucun secret préfixé `NEXT_PUBLIC_`.
- **Migrations uniquement par fichier daté** dans `supabase/migrations/`. Aucune
  modification de schéma via l'interface Supabase.
- **Les valeurs nutritionnelles sont figées à la saisie.** Si la base d'aliments est
  corrigée six mois plus tard, l'historique ne se réécrit pas.
- **Les identifiants créés côté client sont des UUID clients**, pour rendre la
  synchronisation idempotente.
- **Aucune donnée de santé vers un outil analytique tiers.**

## Décisions prises, et pourquoi

### Le déficit n'intègre pas l'activité saisie

```
deficit_jour = depense_retenue − apport_enregistre
```

La spec §6.4 écrit `+ activite_kcal`. **Écart assumé**, validé par le commanditaire le
2026-08-10.

Raison : la fonction différenciante (§6.3) recalcule `depense_reelle` par bilan énergétique
inverse, à partir de l'apport et de la variation de poids réelle. Cette valeur **contient
déjà toute l'activité par construction**. Dès que `fiabilite ≥ 0,6` elle remplace
l'estimation dans tous les calculs — ajouter `activite_kcal` par-dessus compterait l'activité
deux fois à partir de ce basculement. Et l'ajouter seulement en mode estimation créerait
exactement le saut d'indicateur que la règle de lissage à 5 % existe pour éviter.

`activite_kcal` reste en base et s'affiche sur la journée, mais n'entre dans aucun cumul.

*Limite connue* : une séance exceptionnelle ne bouge pas le déficit du jour. Si l'activité
est habituelle, le TDEE recalculé la capte sur la fenêtre de 28 jours. Si le besoin d'une
sensibilité au jour le jour se confirme, la bonne réponse est un **override ponctuel de
`depense_retenue`**, pas un champ additif.

### `supprime_le` ajouté dès la première migration

Le §8 impose des suppressions logiques horodatées pour que la synchro multi-appareils ne
ressuscite pas une entrée effacée. Aucune table du §4 ne porte la colonne. Ajoutée
d'emblée sur `entree`, `pesee` et `mesure` : gratuit maintenant, reprise de données plus tard.

### Portée RGPD réduite en phase 1

Choix du commanditaire (2026-08-10) : « personnel d'abord, commercial ensuite ».
Schéma complet et RLS complète **dès maintenant** — la partie coûteuse à rattraper.
Reportés en phase 3 : export JSON/CSV, fonction de purge, cron d'entretien, durées de
conservation. À rouvrir avant toute commercialisation.

## Points ouverts

- **Objectifs cycliques** (objectif différent le week-end, brief §4.2) : absents du schéma
  de la spec. À trancher avant la phase 2, ça change la table `programme`.
- **Licence ODbL d'Open Food Facts** : attribution obligatoire et partage à l'identique de
  toute base dérivée redistribuée. À valider avant mise en production commerciale (phase 2).
- **Textes des garde-fous et signaux d'alerte** : libellés provisoires. Doivent être relus
  par un professionnel de santé avant mise en production.

## Méthode

- Le moteur de calcul et ses tests **avant** l'interface.
- Les migrations **avant** le code qui les utilise.
- Un test RLS par table, vérifiant qu'un autre utilisateur n'accède à rien.
- `npm run verify` passé avant d'annoncer qu'une tâche est terminée. Si ça échoue, le dire.
- Commits atomiques, messages en français, un commit par tâche fonctionnelle.
- Ne pas surdimensionner : pas d'abstraction anticipée, pas d'état global tant que React
  Query et les Server Components suffisent, pas de dépendance sans justification.

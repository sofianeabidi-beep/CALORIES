# Bilan — Application de suivi calorique et de pilotage de régime

> Spécification de développement à donner à Claude Code.
> Lis ce document en entier, ainsi que le brief produit `brief-suivi-calorique.md`, avant d'écrire la moindre ligne de code. Applique ensuite la méthode de travail décrite en section 15.

---

## 1. Ce qu'on construit

Une application de suivi alimentaire qui raisonne en **capital cumulé** plutôt qu'en journées isolées.

Les applications existantes savent enregistrer les repas d'une journée. Elles répondent mal à la question qui compte sur trois à douze mois de régime : *où j'en suis vraiment, et est-ce que ça marche ?*

Le produit répond par quatre chiffres :

1. le déficit ou le surplus calorique **cumulé depuis le début du programme** ;
2. sa **conversion en kilos théoriques** ;
3. la **confrontation aux kilos réellement mesurés** ;
4. le **taux de complétude** des données, qui conditionne la validité des trois précédents.

**Le point 3 est le produit.** L'écart entre théorie et réalité n'est pas une erreur à masquer : il permet de recalculer la dépense énergétique réelle de l'utilisateur, toujours différente de ce qu'une formule prédit. Aucune application grand public ne l'exploite correctement. Si une décision d'implémentation doit être arbitrée, elle se tranche en faveur de la justesse et de la lisibilité de ces quatre indicateurs.

**Hors périmètre absolu** : coaching nutritionnel, recommandations thérapeutiques, interprétation médicale, réseau social, programmes sportifs, plans de repas générés.

---

## 2. Stack imposée

| Élément | Choix |
|---|---|
| Framework | Next.js App Router + TypeScript strict |
| Rendu | PWA installable, mobile-first |
| Style | Tailwind CSS + composants maison |
| Base de données | Supabase (PostgreSQL), région UE |
| Authentification | Supabase Auth |
| Fichiers | Supabase Storage, bucket privé |
| Hébergement | Vercel, région UE |
| Stockage local | IndexedDB via Dexie |
| Validation | Zod, schémas partagés client et serveur |
| Tests | Vitest (moteur de calcul et logique métier) + Playwright (parcours critiques) |

### Contraintes non négociables

- **RLS activée sur toutes les tables sans exception.** Une table sans policy est un bug bloquant. Les données de poids et d'alimentation sont des données de santé.
- **La `service_role key` ne quitte jamais le serveur.** Aucun secret préfixé `NEXT_PUBLIC_`.
- **Le moteur de calcul est une bibliothèque pure**, sans accès base ni réseau, dans `lib/calcul/`. Entrées → sorties, entièrement testable, couverture de tests exigée à 100 % sur ce dossier.
- **Toutes les mutations passent par des Server Actions ou des Route Handlers.**
- **Migrations versionnées** dans `supabase/migrations/`. Aucune modification de schéma via l'interface Supabase.
- **Aucune donnée de santé transmise à un outil analytique tiers.** Si de la mesure d'usage est nécessaire, elle est anonyme et ne contient ni poids, ni calories, ni aliments.
- `@supabase/ssr` pour la gestion des sessions par cookie.

---

## 3. Architecture

```
Client (PWA)
  ├── IndexedDB : cache aliments, journées récentes, file d'attente d'écriture
  ├── Service worker : coquille applicative hors ligne + synchronisation différée
  └── État serveur : React Query, avec optimisme systématique sur la saisie
        │
Server Actions / Route Handlers  (validation Zod → écriture Supabase)
        │
Supabase Postgres  (RLS) ─── Storage (photos, privé)
        │
Recalcul : déclenché après écriture, sur la plage de dates impactée uniquement
```

**Principe directeur : le local fait foi pendant la saisie.** L'utilisateur enregistre un repas debout dans une cuisine, souvent sans réseau. L'écriture est immédiate en local, affichée immédiatement, puis poussée au serveur. Jamais de spinner bloquant sur une saisie.

---

## 4. Modèle de données

Schéma `public`. Extensions : `pg_trgm`, `unaccent`, `pgcrypto`.

Toutes les tables portent `user_id uuid not null default auth.uid()` référençant `auth.users(id)` en `on delete cascade`, `created_at`, `updated_at`.
Tous les identifiants de lignes créées côté client sont des **UUID générés par le client**, pour rendre la synchronisation idempotente.

### `profil`
`user_id pk`, `sexe text check in ('h','f')`, `date_naissance date`, `taille_cm int`,
`niveau_activite text check in ('sedentaire','leger','modere','soutenu','tres_soutenu')`,
`mode_jours_manquants text check in ('neutre','estime','strict') default 'neutre'`,
`unite_poids text default 'kg'`, `mode_discret boolean default false`,
`consentement_sante_le timestamptz`, `cgu_acceptees_le timestamptz`.

`date_naissance` sert au calcul du métabolisme de base **et** au contrôle d'âge. Contrainte : âge ≥ 18 ans.

### `programme`
Une période de régime. Les cumuls se calculent **par programme**, jamais depuis l'inscription.
`id`, `user_id`, `libelle text`, `type text check in ('deficit','surplus','maintien')`,
`date_debut date not null`, `date_fin date null`,
`poids_depart_kg numeric(5,2)`, `poids_cible_kg numeric(5,2) null`,
`allure_cible_kg_semaine numeric(4,3) null`, `objectif_kcal int null`,
`actif boolean default true`.

Contrainte : un seul programme actif par utilisateur (index unique partiel).
Contraintes de garde-fou, en base et non seulement dans l'application :
- `objectif_kcal >= 1200` si `profil.sexe = 'f'`, `>= 1500` si `'h'` — implémenté par trigger, le check ne pouvant pas lire une autre table ;
- `abs(allure_cible_kg_semaine) <= 0.01 * poids_depart_kg` ;
- IMC cible calculé ≥ 18,5 — trigger utilisant `profil.taille_cm`.

### `journee`
Une ligne par jour et par utilisateur, créée à la première saisie.
`id`, `user_id`, `programme_id fk`, `date date not null`,
`apport_kcal numeric(7,1)`, `proteines_g`, `glucides_g`, `lipides_g`,
`depense_retenue_kcal numeric(7,1)`, `deficit_kcal numeric(7,1)`,
`statut text check in ('renseigne','estime','manquant')`,
`activite_kcal numeric(6,1) default 0`, `note text`.
Unicité sur `(user_id, date)`.

Les colonnes agrégées sont **dénormalisées et recalculées** à chaque modification d'entrée. Ne pas les calculer à la volée en lecture : le tableau de bord doit s'afficher en une requête.

### `entree`
`id`, `user_id`, `journee_id fk`, `aliment_id fk null`, `aliment_utilisateur_id fk null`, `recette_id fk null`,
`libelle text not null`, `repas text check in ('petit_dejeuner','dejeuner','diner','collation')`,
`quantite numeric(7,2)`, `unite text`, `quantite_g numeric(7,2)`,
`kcal numeric(7,1)`, `proteines_g`, `glucides_g`, `lipides_g`,
`source text check in ('off','ciqual','utilisateur','recette','rapide')`, `saisi_le timestamptz`.

**Les valeurs nutritionnelles sont figées à la saisie.** Si la base d'aliments est corrigée six mois plus tard, l'historique ne se réécrit pas. C'est une exigence de justesse et de confiance, pas une optimisation.

### `aliment`
Cache local des aliments issus d'Open Food Facts et de CIQUAL.
`id`, `code_barres text unique null`, `nom text`, `marque text`,
`kcal_100g numeric(6,1)`, `proteines_100g`, `glucides_100g`, `lipides_100g`,
`fibres_100g`, `sucres_100g`, `sel_100g`, `satures_100g`,
`portions jsonb` (liste `{libelle, grammes}`), `source text check in ('off','ciqual')`,
`source_ref text`, `qualite_score int`, `rafraichi_le timestamptz`, `recherche tsvector`.

Table **partagée**, non rattachée à un utilisateur : lecture publique pour les utilisateurs authentifiés, écriture réservée au serveur.

### `aliment_utilisateur`
Aliments créés ou corrigés par un utilisateur. Mêmes colonnes nutritionnelles, plus `aliment_source_id fk null` quand il s'agit de la correction d'un aliment public.

### `recette` et `recette_ingredient`
`recette` : `id`, `user_id`, `nom`, `portions int`, `poids_total_g`, valeurs nutritionnelles calculées par portion.
`recette_ingredient` : référence d'aliment, quantité, unité.

### `repas_enregistre`
Un ensemble d'entrées rejouable en un geste. `id`, `user_id`, `nom`, `repas_par_defaut`, `contenu jsonb`.

### `pesee`
`id`, `user_id`, `date date`, `poids_kg numeric(5,2)`, `moyenne_mobile_7j numeric(5,2)`,
`aberrante boolean default false`, `source text check in ('manuelle','import')`.
Unicité sur `(user_id, date)`.

### `mesure`
`id`, `user_id`, `date`, `type text` (taille, hanches, bras, cuisse…), `valeur_cm numeric(5,1)`.

### `photo_progression`
`id`, `user_id`, `date`, `storage_path text`, `angle text`. Bucket privé, URL signée à 5 minutes, jamais d'objet public.

### `instantane_calcul`
Photographie quotidienne des indicateurs, pour un affichage en une requête et pour garder trace de ce qui a été montré à l'utilisateur.
`id`, `user_id`, `programme_id`, `date`,
`deficit_cumul_kcal numeric(9,1)`, `kg_theoriques numeric(5,2)`, `kg_reels numeric(5,2)`,
`ecart_kg numeric(5,2)`, `depense_reelle_kcal numeric(7,1)`, `fiabilite numeric(3,2)`,
`allure_kg_semaine numeric(4,3)`, `complétude numeric(4,3)`,
`jours_renseignes int`, `jours_total int`, `projection_date date null`,
`calcule_le timestamptz`.

### Index
- `aliment.recherche` en GIN ; `aliment.nom` en GIN `gin_trgm_ops` ; `aliment.code_barres` unique.
- `journee (user_id, date desc)` ; `entree (journee_id)` ; `pesee (user_id, date desc)` ; `instantane_calcul (user_id, programme_id, date desc)`.

---

## 5. Sécurité, RLS et RGPD

### RLS
Modèle simple : chaque ligne appartient à un utilisateur.

```sql
create policy "lecture proprietaire" on <table>
  for select using (auth.uid() = user_id);
create policy "ecriture proprietaire" on <table>
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

`aliment` fait exception : `select` ouvert aux utilisateurs authentifiés, `insert` et `update` réservés au rôle serveur.

**Storage** : bucket `progression` privé, chemin `{user_id}/{photo_id}.jpg`, policies dérivant l'identité du premier segment. Aucun accès direct : tout téléchargement passe par une URL signée générée côté serveur.

### RGPD — à implémenter, pas à documenter seulement

- **Consentement explicite** aux données de santé à l'inscription, distinct de l'acceptation des CGU, horodaté en base.
- **Export complet** en JSON et CSV, déclenchable par l'utilisateur depuis les réglages, livré en moins d'une minute.
- **Suppression du compte** en deux clics, avec confirmation. Effacement effectif de toutes les données, y compris Storage, sous 30 jours. Écrire une fonction de purge testée, ne pas se reposer sur le seul `on delete cascade`.
- **Durées de conservation** documentées dans le code et appliquées par tâche planifiée.
- Chiffrement au repos et en transit — assuré par Supabase, à vérifier et documenter.

---

## 6. Le moteur de calcul

Dossier `lib/calcul/`. Fonctions pures, aucune dépendance à Supabase, à `Date.now()` ni à la locale. Toute date entre sous forme de chaîne `YYYY-MM-DD`. Couverture de tests 100 %.

### 6.1 Métabolisme de base — Mifflin-St Jeor

```
homme : 10 × poids_kg + 6,25 × taille_cm − 5 × age + 5
femme : 10 × poids_kg + 6,25 × taille_cm − 5 × age − 161
```

Retenue plutôt que Harris-Benedict, plus précise sur les populations actuelles.

### 6.2 Dépense totale estimée

`dépense_estimée = métabolisme_base × facteur_activité`

| Niveau | Facteur |
|---|---|
| sédentaire | 1,20 |
| léger | 1,375 |
| modéré | 1,55 |
| soutenu | 1,725 |
| très soutenu | 1,90 |

Cette valeur est un **point de départ**, affichée comme telle dans l'interface, jamais présentée comme une vérité.

### 6.3 Dépense réelle recalculée — la fonction différenciante

À partir de 14 jours de données, sur une fenêtre glissante de 28 jours :

```
dépense_réelle ≈ apport_moyen_quotidien
                 + (Δ moyenne_mobile_poids sur la fenêtre × 7700 / nb_jours)
```

Conditions de calcul :
- au moins 14 jours renseignés dans la fenêtre ;
- au moins 2 pesées espacées de 10 jours minimum ;
- `fiabilite` = jours renseignés / jours de la fenêtre, exposée à l'interface.

Dès que `fiabilite ≥ 0,6`, la dépense réelle **remplace** l'estimation dans tous les calculs, avec mention explicite du changement à l'utilisateur.

Lissage : ne jamais faire varier la dépense retenue de plus de 5 % d'un jour à l'autre, pour éviter des sauts d'indicateurs déroutants.

### 6.4 Déficit et conversion

```
déficit_jour   = dépense_retenue − apport_enregistré + activité_kcal
déficit_cumulé = Σ déficits journaliers du programme
kg_théoriques  = déficit_cumulé / 7700
```

Le coefficient de 7 700 kcal par kilo de masse grasse est une **approximation**. L'interface le dit, sans note de bas de page illisible. Une partie des variations de poids à court terme relève de l'eau et du glycogène.

### 6.5 Jours non renseignés

Le point qui casse tous les compteurs cumulés. Trois modes, réglés dans le profil :

| Mode | Comportement |
|---|---|
| `neutre` *(défaut)* | Le jour est exclu du cumul et compté comme non renseigné |
| `estime` | Le jour prend la moyenne des 7 derniers jours renseignés, marqué `estime` |
| `strict` | Déficit nul : l'apport est réputé égal à la dépense |

**Le taux de complétude est affiché en permanence à côté de tout indicateur cumulé.** Un déficit cumulé calculé sur 40 % des jours ne vaut rien et l'utilisateur doit le voir. Cette règle ne se négocie pas au moment de l'intégration graphique.

### 6.6 Poids

- Moyenne mobile sur 7 jours, affichée par défaut ; les pesées brutes sont accessibles à la demande.
- Valeur aberrante si l'écart avec la moyenne mobile dépasse 2 kg : la pesée est enregistrée, marquée `aberrante`, exclue de la moyenne, et l'utilisateur est invité à confirmer.
- Tendance en kg/semaine et en pourcentage du poids corporel.

### 6.7 Projection

Rythme réel des 28 derniers jours, jamais l'objectif théorique. Restituée sous forme de fourchette (optimiste / médiane / prudente). **Masquée** si moins de 21 jours de données ou si le rythme récent est incompatible avec l'objectif — mieux vaut n'afficher aucune date qu'une date fausse.

### 6.8 Recalcul

Modifier une entrée du 3 mars invalide tous les cumuls postérieurs. Après chaque écriture, recalculer `journee` puis `instantane_calcul` **de la date impactée jusqu'à aujourd'hui**, jamais tout l'historique. Opération idempotente, exécutée dans une transaction, déclenchée depuis la Server Action après confirmation de l'écriture.

---

## 7. Base d'aliments et recherche

### Sources
- **Open Food Facts** — produits de marque et codes-barres. Gratuit, forte couverture française. Publiée sous licence **ODbL** : attribution obligatoire, et partage à l'identique de toute base dérivée redistribuée. Afficher l'attribution dans l'application et signaler ce point au commanditaire avant mise en production.
- **CIQUAL (ANSES)** — aliments bruts et cuisinés, importé en `seed.sql`, référence de qualité supérieure.
- **Créations utilisateur** — toujours prioritaires dans les résultats.

### Stratégie
Ne jamais interroger Open Food Facts en direct depuis le client sur le chemin critique de la recherche. Recherche locale d'abord dans `aliment` ; en cas de code-barres inconnu, appel serveur à Open Food Facts, mise en cache dans `aliment`, réponse à l'utilisateur. Prévoir la dégradation : si la source est indisponible, proposer la saisie manuelle plutôt qu'une erreur.

### Recherche
Fonction `rechercher_aliment(p_query text, p_limite int)` combinant `websearch_to_tsquery('french', unaccent(...))` et similarité trigramme sur le nom. Classement : créations de l'utilisateur, puis fréquence d'usage personnelle, puis pertinence textuelle, puis qualité de la fiche. Résultats en moins de 150 ms.

### Code-barres
`BarcodeDetector` natif quand disponible, repli sur ZXing en WebAssembly. Autorisation caméra demandée au moment de l'usage, jamais à l'installation.

---

## 8. Hors ligne et synchronisation

C'est la partie la plus délicate du projet. À traiter en phase 2 avec attention, pas à bricoler en fin de parcours.

**File d'attente sortante.** Toute écriture est d'abord inscrite dans une table `outbox` d'IndexedDB avec un UUID client, puis appliquée à l'état local, puis affichée. Un worker vide la file dès que le réseau revient.

**Idempotence.** Les Server Actions font des `upsert` sur l'UUID client. Rejouer une opération ne crée jamais de doublon.

**Conflits.** Dernière écriture gagnante par entrée, jamais par journée : deux appareils qui ajoutent chacun un aliment au déjeuner doivent conserver les deux. Une suppression est un `supprime_le` horodaté, pas un `delete`, pour ne pas ressusciter une entrée effacée sur un autre appareil.

**Cache de lecture.** Les 30 derniers jours et les 200 aliments les plus utilisés sont maintenus en local et interrogeables hors ligne.

**Recalcul hors ligne.** Le moteur de calcul étant une bibliothèque pure, il tourne côté client sur les données locales : les indicateurs restent justes sans réseau, puis sont confirmés par le serveur à la synchronisation.

---

## 9. Garde-fous — implémentation à trois niveaux

Chaque règle est appliquée **en base**, **dans la validation Zod** et **dans l'interface**. Une seule des trois couches ne suffit pas.

- Objectif calorique jamais inférieur à **1 200 kcal** (femme) ou **1 500 kcal** (homme). Si le calcul descend plus bas, plafonner et inviter à consulter un professionnel de santé.
- Aucun poids cible conduisant à un **IMC inférieur à 18,5**.
- Allure limitée à **1 % du poids corporel par semaine**.
- **Aucune mécanique punitive** : pas de série à préserver, pas de notification culpabilisante, pas de comparaison entre utilisateurs. La régularité se valorise sur la moyenne glissante.
- **Mode discret** : masque les valeurs caloriques et n'affiche que la complétude et la tendance.
- **Signaux d'alerte** — restriction sévère prolongée, jours à zéro répétés, objectif limite : message de soutien mesuré et orientation vers des ressources, sans blocage brutal ni ton moralisateur. Ces textes doivent être relus par un professionnel avant mise en production ; utiliser des libellés provisoires et le signaler.
- **Âge minimum 18 ans**, contrôlé à l'inscription.
- **Aucune allégation médicale** dans l'application, la fiche du store ou la communication.

---

## 10. Interface et direction visuelle

### Principe

C'est un **instrument de mesure**, pas un coach. Les chiffres sont les héros ; l'ornement est absent. L'application est ouverte quatre à six fois par jour, quelques secondes, souvent d'une seule main.

Choix délibéré : **ne pas colorer les jours en vert et rouge.** Déficit et surplus sont des directions, pas des verdicts moraux. Le bleu marque le déficit, l'ambre le surplus, aucun des deux ne signifie « bien » ou « mal ». Le rouge est réservé aux garde-fous et aux erreurs, où il est rare et donc lisible.

### Jetons

```
--graphite:  #1A1D21   texte principal
--ardoise:   #5B6470   texte secondaire
--papier:    #F4F5F3   fond
--surface:   #FFFFFF   cartes
--trait:     #DDE0DC   filets
--deficit:   #1F6F78   déficit, direction descendante
--surplus:   #C77B30   surplus, direction montante
--signal:    #B3402F   garde-fous et erreurs uniquement
```

Mode sombre **obligatoire** et de qualité égale : une part importante des saisies a lieu le soir.

### Typographie

Chiffres en vedette : grandes valeurs en graisse légère, `font-variant-numeric: tabular-nums` partout où des nombres s'alignent ou s'animent. Libellés en petites capitales interlettrées. Sans-serif système, aucun chargement de police distante sur le chemin critique.

### Écrans

- **Aujourd'hui** — écran d'accueil : restant du jour, repas, bouton de saisie omniprésent.
- **Saisie** — recherche, scan, favoris, récents, repas enregistrés. Objectif : moins de 10 secondes pour un repas habituel, moins de 5 pour un repas enregistré.
- **Bilan** — les quatre indicateurs cumulés, courbes de poids et de déficit, écart théorique/réel commenté en une phrase.
- **Historique** — calendrier, journée détaillée, corrections rétroactives.
- **Réglages** — profil, programme, mode de jours manquants, mode discret, export, suppression du compte.

Accessibilité : navigation clavier complète, contraste AA, cibles tactiles de 44 px minimum, `prefers-reduced-motion` respecté, libellés associés à chaque champ, valeurs annoncées correctement aux lecteurs d'écran.

---

## 11. Structure de projet

```
app/
  (auth)/
  (app)/
    aujourdhui/
    saisie/
    bilan/
    historique/[date]/
    reglages/
  api/
    aliments/recherche/route.ts
    aliments/code-barres/[code]/route.ts
    export/route.ts
    cron/entretien/route.ts
lib/
  calcul/            moteur pur — index.ts, depense.ts, deficit.ts, poids.ts,
                     projection.ts, completude.ts, gardefous.ts
  supabase/          client.ts, server.ts, middleware.ts
  actions/           une Server Action par domaine
  validations/       schémas Zod partagés
  local/             Dexie, outbox, synchronisation
  aliments/          intégration Open Food Facts, normalisation
components/
  saisie/ bilan/ ui/
supabase/
  migrations/
  seed.sql           catégories, CIQUAL, aliments de démonstration
tests/
  calcul/            tests unitaires exhaustifs
  e2e/               Playwright
```

---

## 12. Environnement et déploiement

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        serveur uniquement
NEXT_PUBLIC_SITE_URL=
CRON_SECRET=
OFF_USER_AGENT=                   Open Food Facts exige un User-Agent identifiant
```

Livrer : `.env.example` documenté, `vercel.json` avec la tâche planifiée d'entretien, `manifest.json` et icônes PWA, service worker, et un `README.md` couvrant la création du projet Supabase, l'application des migrations, l'import CIQUAL, le lancement local et le déploiement.

---

## 13. Phases

Chaque phase se termine par une application qui se lance, se déploie et se teste.

**Phase 1 — Le squelette juste.** Next.js, Supabase, migrations complètes, RLS et tests de policies, authentification, profil, programme, saisie manuelle d'aliments, pesées, moteur de calcul intégralement testé, écran Aujourd'hui.
*Livrable : on suit une journée de bout en bout et les chiffres sont vérifiables à la main.*

**Phase 2 — Le produit utilisable.** Import CIQUAL, intégration Open Food Facts, recherche, scan de code-barres, favoris, récents, repas enregistrés, recettes, hors ligne et synchronisation, écran Bilan avec les quatre indicateurs et la dépense réelle recalculée.
*Livrable : utilisable au quotidien sans frustration.*

**Phase 3 — La profondeur.** Historique et courbes, projections, bilans hebdomadaires, mensurations et photos, exports RGPD, suppression de compte, garde-fous complets, mode discret, mode sombre.

**Phase 4 — L'échelle.** Abonnements, empaquetage natif via Capacitor, Apple Santé et Google Fit, notifications, widgets.

---

## 14. Critères d'acceptation

- Enregistrer un repas habituel prend moins de 10 secondes, moins de 5 pour un repas enregistré.
- Le scan d'un produit alimentaire français courant retourne une fiche exploitable dans plus de 85 % des cas.
- Le déficit cumulé est recalculable à la main depuis l'export CSV et donne exactement le même résultat.
- Après 28 jours de données complètes, la dépense recalculée s'écarte de moins de 10 % de la valeur déduite manuellement du bilan énergétique.
- **Aucun indicateur cumulé ne s'affiche jamais sans son taux de complétude.**
- Une saisie effectuée hors ligne est présente et intacte après retour du réseau, sans doublon, y compris si l'application a été fermée entre-temps.
- Modifier une entrée vieille de trois semaines met à jour tous les indicateurs postérieurs en moins de 2 secondes.
- Aucun objectif ne peut être créé sous les planchers de la section 9, quelle que soit la voie de saisie, y compris par appel direct à l'API.
- Un utilisateur ne peut accéder à aucune donnée d'un autre utilisateur, ni par l'interface, ni par appel direct, ni par URL de Storage.
- La suppression du compte efface effectivement toutes les données sous 30 jours, Storage compris. Test automatisé exigé.
- L'application est utilisable d'une seule main sur un écran de 375 px, et lisible en mode sombre.

---

## 15. Méthode de travail attendue

1. **Commence par un plan.** Lis cette spécification et le brief produit, puis propose un découpage de la phase 1 en tâches vérifiables. Attends validation avant de coder.
2. **Écris un `CLAUDE.md`** dès le premier commit : conventions (domaine métier en français, code technique en anglais — tiens cette règle jusqu'au bout), commandes de test et de lint, structure, décisions d'architecture. Tiens-le à jour.
3. **Le moteur de calcul avant l'interface.** Écris `lib/calcul/` et ses tests en premier, avec des jeux de données de référence vérifiables à la main. Tout le reste en dépend, et une erreur ici est invisible et grave.
4. **Les migrations avant le code.** Toute évolution de schéma passe par un fichier daté, testé localement.
5. **Teste la RLS explicitement.** Pour chaque table, un test vérifiant qu'un autre utilisateur n'accède à rien. Ce sont des données de santé : c'est la seule partie où un bug est grave.
6. **Vérifie avant d'affirmer.** Build, lint et tests passés avant d'annoncer qu'une tâche est terminée. Si quelque chose échoue, dis-le.
7. **Commits atomiques**, messages en français, un commit par tâche fonctionnelle.
8. **Signale les arbitrages.** Si cette spécification est ambiguë ou si une contrainte technique la contredit, arrête-toi et pose la question plutôt que de choisir silencieusement.
9. **Ne surdimensionne pas.** Pas d'abstraction anticipée, pas de gestionnaire d'état global tant que React Query et les Server Components suffisent, pas de dépendance ajoutée sans justification.
10. **Ne dégrade jamais deux choses** sous la pression du planning : la rapidité de saisie, et l'honnêteté des indicateurs. Ce sont les deux raisons d'exister du produit.

---

## 16. À trancher avant la phase 3

À poser au commanditaire, ne pas décider seul :

1. **Produit commercial ou usage personnel ?** Cette spécification suppose un produit destiné à la vente. Un usage strictement personnel allège fortement les sections 5 et 9.
2. **La PWA suffit-elle en v1**, ou le natif est-il exigé dès le lancement ? La PWA est retenue par défaut : pas de validation de store, une seule base de code, mise en production immédiate.
3. Compte **mono-utilisateur**, ou partage avec un coach ou un nutritionniste ?
4. Le suivi des **macronutriments** est-il central ou secondaire ? Il change la densité de l'écran de saisie.
5. Faut-il une **reprise de données** depuis une application existante pour convertir des utilisateurs déjà engagés ailleurs ?
6. Qui **relit les textes** liés aux garde-fous et aux signaux d'alerte ? Un professionnel doit valider ces formulations avant la mise en production.
7. **Modèle économique** : freemium, et si oui, quelle frontière exacte entre gratuit et payant ?

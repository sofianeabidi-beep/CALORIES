# Brief produit — Application de suivi calorique et de pilotage de régime

> Document de cadrage. Les hypothèses par défaut sont signalées par `[hypothèse]` et doivent être confirmées avant le développement. Les arbitrages ouverts sont listés en section 13.

---

## 1. La promesse

Les applications de suivi alimentaire existantes savent enregistrer ce qu'on mange. Elles savent mal répondre à la seule question qui compte quand on suit un régime sur plusieurs mois :

> **« Où j'en suis vraiment, et est-ce que ça marche ? »**

Elles raisonnent en journées isolées : objectif du jour, calories restantes du jour, séquence de jours réussis. Le suivi cumulé, quand il existe, se limite à une courbe de poids.

Le produit à construire raisonne en **capital** :

- combien de calories de déficit ai-je accumulé depuis le début ;
- combien de kilos cela représente en théorie ;
- combien en ai-je réellement perdu ;
- et que m'apprend l'écart entre les deux.

**C'est le troisième point qui fait le produit.** L'écart entre la perte théorique et la perte réelle n'est pas une erreur à masquer : c'est l'information la plus utile de tout le système. Il permet de recalculer la dépense énergétique réelle de l'utilisateur, qui est toujours différente de celle qu'une formule prédit. Aucune application grand public ne l'exploite correctement aujourd'hui.

**Ce que le produit n'est pas** : ni un coach nutritionnel, ni un outil de diagnostic, ni un réseau social, ni un programme sportif. Il ne prescrit rien, il mesure et il restitue.

---

## 2. Utilisateurs

**Profil principal** `[hypothèse]` — adulte qui suit un objectif de poids sur 3 à 12 mois, déjà familier du principe du déficit calorique, agacé par l'imprécision des outils existants. Il pèse ses aliments au moins partiellement, se pèse régulièrement, et veut comprendre ses chiffres plutôt qu'on lui dise quoi faire.

**Profil secondaire** — l'utilisateur en phase de stabilisation ou de prise de masse. Le produit doit traiter le surplus exactement comme le déficit, sans que ce soit un mode dégradé.

**Hors cible en v1** — les mineurs, les personnes en suivi médical, les sportifs de haut niveau, les utilisateurs qui veulent qu'on décide à leur place.

**Contexte d'usage** : quatre à six ouvertures par jour, très courtes, sur téléphone, souvent d'une seule main, parfois debout dans une cuisine ou au restaurant. La saisie doit être plus rapide que dans les applications existantes ou le produit sera abandonné en deux semaines, quels que soient ses indicateurs.

---

## 3. Le moteur de calcul

C'est le cœur technique. Il doit être implémenté dans une couche isolée, testée unitairement, indépendante de l'interface.

### 3.1 Dépense énergétique estimée

Métabolisme de base par la formule de **Mifflin-St Jeor**, retenue pour sa précision supérieure à Harris-Benedict sur les populations actuelles. Multiplication par un facteur d'activité déclaré pour obtenir la dépense totale journalière.

Cette estimation n'est qu'un **point de départ**. Elle est affichée comme telle, jamais comme une vérité.

### 3.2 Dépense énergétique réelle, recalculée

À partir de 14 jours de données, le système recalcule la dépense réelle par bilan énergétique inverse :

```
dépense réelle ≈ apport moyen quotidien + (variation de poids sur la période × 7700 / nombre de jours)
```

Sur une fenêtre glissante de 28 jours, en utilisant la **moyenne mobile du poids** et non les pesées brutes.

Cette valeur remplace progressivement l'estimation théorique dans tous les calculs, avec un indicateur de fiabilité fonction du nombre de jours renseignés. C'est la fonctionnalité différenciante du produit : l'application apprend le métabolisme réel de l'utilisateur au lieu de lui imposer une formule.

### 3.3 Déficit cumulé et conversion en kilos

```
déficit du jour     = dépense retenue − apport enregistré
déficit cumulé      = somme des déficits journaliers depuis le début du programme
kilos théoriques    = déficit cumulé / 7700
```

Le coefficient de **7 700 kcal par kilo de masse grasse** est une approximation communément admise. Le produit doit le dire clairement plutôt que de le présenter comme exact : la composition de la perte varie, et une partie des variations de poids à court terme relève de l'eau et du glycogène, pas de la masse grasse.

**Traitement des jours non renseignés** — le point qui casse tous les compteurs cumulés. Trois modes, choisis par l'utilisateur, valeur par défaut « neutre » :

| Mode | Comportement |
|---|---|
| Neutre `[défaut]` | Le jour est ignoré dans le cumul et signalé comme non renseigné |
| Estimé | Le jour prend la moyenne des 7 derniers jours renseignés, et est marqué comme estimé |
| Strict | Le jour compte comme un apport égal à la dépense, soit un déficit nul |

Le taux de complétude est affiché en permanence à côté du cumul. Un déficit cumulé calculé sur 40 % des jours ne vaut rien, et l'utilisateur doit le voir.

### 3.4 Poids

- Moyenne mobile sur 7 jours, affichée par défaut. Les pesées brutes ne sont visibles qu'à la demande.
- Détection des valeurs aberrantes (écart supérieur à 2 kg d'un jour à l'autre) : demander confirmation plutôt que d'écraser la courbe.
- Tendance hebdomadaire en kg/semaine et en pourcentage du poids corporel.

### 3.5 Projection

Date estimée d'atteinte de l'objectif, calculée sur le rythme réel des 28 derniers jours et non sur l'objectif théorique. Fourchette plutôt que date unique. La projection est masquée tant que les données sont insuffisantes — mieux vaut ne rien afficher qu'un chiffre faux.

### 3.6 Le tableau de bord

Quatre indicateurs, pas quinze. Le reste est accessible mais en second rang.

1. **Déficit cumulé** en kcal, et sa conversion en kg théoriques
2. **Théorique contre réel** — les kilos calculés face aux kilos mesurés, avec l'écart et son interprétation en une phrase
3. **Rythme actuel** en kg/semaine, et la projection
4. **Complétude** — pourcentage de jours renseignés, la donnée qui conditionne la validité de tout le reste

---

## 4. Fonctionnalités

### 4.1 Saisie — la fonction vitale

Objectif : enregistrer un repas habituel en moins de 10 secondes.

- **Recherche d'aliment** avec résultats instantanés, tolérante aux accents et aux fautes
- **Scan de code-barres**, indispensable sur produits industriels
- **Favoris et récents** en tête de recherche, personnalisés par utilisateur et par moment de la journée
- **Repas enregistrés** — un petit-déjeuner habituel se rejoue en un geste
- **Recettes maison** avec calcul automatique par portion
- **Duplication** d'une journée ou d'un repas antérieur
- **Portions** en grammes, en unités et en mesures usuelles

Saisie hors ligne obligatoire, avec synchronisation différée. On mange souvent là où le réseau est mauvais.

### 4.2 Objectifs

Poids cible et échéance, ou allure souhaitée en kg/semaine — les deux entrées calculent la même chose et doivent rester cohérentes. Objectif calorique dérivé, ajustable manuellement. Répartition en macronutriments optionnelle, jamais imposée.

Objectifs cycliques possibles : un objectif différent en semaine et le week-end, le cumul restant hebdomadaire. Cette souplesse est ce qui distingue un outil réaliste d'un outil qu'on abandonne le premier samedi.

### 4.3 Suivi complémentaire

Poids, tour de taille et mensurations, photos de progression (stockage privé, jamais partagé par défaut), activité physique — saisie manuelle en v1, import de montre connectée en v3.

### 4.4 Historique et restitution

Vue calendaire avec code couleur, courbes de poids et de déficit cumulé, bilan hebdomadaire et mensuel, export CSV et PDF. L'export est une exigence, pas une option : c'est ce qui permet à l'utilisateur de partager ses données avec un professionnel de santé, et c'est aussi une obligation de portabilité au titre du RGPD.

---

## 5. Base d'aliments — la décision structurante

C'est le choix qui détermine la qualité perçue du produit et son coût récurrent.

| Source | Nature | Points forts | Limites |
|---|---|---|---|
| **Open Food Facts** | Base ouverte collaborative | Gratuite, très forte couverture des produits français, codes-barres, API | Qualité variable, données parfois incomplètes, licence ODbL à respecter |
| **CIQUAL (ANSES)** | Table officielle française | Référence pour les aliments bruts et cuisinés, fiabilité élevée | Pas de produits de marque, pas de codes-barres |
| **API commerciales** | Nutritionix, Edamam, Spoonacular | Qualité homogène, données structurées | Coût à l'appel, couverture française inégale |

**Recommandation** `[hypothèse]` : Open Food Facts pour les produits de marque et le scan, CIQUAL pour les aliments bruts, plus les créations de l'utilisateur. Aucun coût variable, couverture française excellente.

**Attention juridique** : Open Food Facts est publiée sous licence ODbL. L'usage est libre, y compris commercial, mais la licence impose l'attribution et le partage à l'identique de toute base dérivée redistribuée. À faire valider avant le lancement — c'est précisément le genre de point qui se traite en amont et coûte cher en aval.

Prévoir un mécanisme de correction : quand un utilisateur corrige une valeur nutritionnelle manifestement fausse, la correction alimente sa base personnelle et peut être proposée en contribution à Open Food Facts.

---

## 6. Garde-fous — non négociables

Une application de suivi calorique peut faire du mal si elle est mal conçue. Ces règles ne sont pas de la prudence excessive : elles conditionnent la validation par les stores d'applications et limitent l'exposition juridique.

- **Plancher calorique.** Le produit ne propose jamais un objectif inférieur à 1 200 kcal pour une femme ou 1 500 kcal pour un homme. Si le calcul descend plus bas, il est plafonné et l'utilisateur est invité à consulter un professionnel de santé.
- **Plancher de poids cible.** Aucun objectif conduisant à un IMC inférieur à 18,5 n'est accepté.
- **Plafond d'allure.** Pas d'objectif au-delà de 1 % du poids corporel par semaine.
- **Pas de mécanique punitive.** Aucune série à ne pas briser, aucune notification culpabilisante, aucun classement entre utilisateurs. Le produit valorise la régularité sur la moyenne glissante, jamais la perfection quotidienne.
- **Mode discret.** Une option masque les valeurs caloriques et n'affiche que la complétude et la tendance, pour les utilisateurs à qui les chiffres font du mal.
- **Signaux d'alerte.** Restriction sévère prolongée, objectif très bas, jours à zéro répétés : le produit affiche un message de soutien mesuré et propose des ressources, sans blocage brutal ni ton moralisateur. Faire relire ces textes par un professionnel.
- **Pas de mineurs** en v1. Vérification d'âge à l'inscription.
- **Aucune allégation médicale** nulle part — ni dans l'application, ni sur la fiche du store, ni dans la communication. Une application qui prétend diagnostiquer, prévenir ou traiter bascule dans la réglementation du dispositif médical, avec des obligations sans commune mesure.

---

## 7. Stack et architecture `[hypothèse]`

Cohérence avec l'écosystème déjà retenu :

| Élément | Choix |
|---|---|
| Application | Next.js App Router en PWA installable |
| Base de données | Supabase (PostgreSQL) |
| Authentification | Supabase Auth |
| Hébergement | Vercel, région UE |
| Fichiers | Supabase Storage, bucket privé chiffré |
| Langage | TypeScript strict |

**Une PWA d'abord** : déploiement immédiat, pas de validation de store, coût de développement unique. Le scan de code-barres fonctionne via l'API navigateur sur les appareils récents.

**Passage en natif en v3** si la traction le justifie, via Capacitor pour réutiliser le code existant. Le natif devient nécessaire dès qu'il faut les widgets d'écran d'accueil, l'intégration Apple Santé ou Google Fit, et une expérience hors ligne irréprochable.

Contraintes : RLS activée sur toutes les tables, aucune donnée d'un utilisateur accessible à un autre, moteur de calcul isolé et couvert par des tests unitaires, migrations versionnées.

---

## 8. Modèle de données

`utilisateur` — profil, sexe, date de naissance, taille, niveau d'activité, préférences d'affichage, mode de traitement des jours manquants.

`programme` — une période de régime : date de début, date de fin, type (déficit, surplus, maintien), poids de départ, poids cible, allure visée. Un utilisateur enchaîne plusieurs programmes ; les cumuls se calculent par programme, jamais depuis l'inscription.

`journee` — date, apport total, dépense retenue, déficit, statut (renseigné, estimé, manquant), taux de complétude.

`entree` — un aliment consommé : référence, quantité, unité, repas, valeurs nutritionnelles figées au moment de la saisie. **Figer les valeurs est impératif** : si la base d'aliments est corrigée six mois plus tard, l'historique ne doit pas se réécrire.

`aliment`, `aliment_utilisateur`, `recette`, `recette_ingredient`, `repas_enregistre`.

`pesee` — date, poids, moyenne mobile calculée, marqueur d'aberration.

`mesure` — mensurations, une ligne par type et par date.

`instantane_calcul` — photographie quotidienne des indicateurs calculés, pour éviter de recalculer tout l'historique à chaque ouverture et pour garder une trace de ce qui a été affiché.

---

## 9. Conformité — à traiter dès la conception

**RGPD.** Les données de poids et d'alimentation sont des données de santé au sens de l'article 9 : leur traitement exige un consentement explicite, distinct des conditions générales. Prévoir : registre des traitements, base légale documentée, durées de conservation, export et suppression du compte accessibles en deux clics depuis l'application, hébergement en Union européenne, chiffrement au repos et en transit, aucune donnée de santé transmise à un outil analytique tiers.

**Hébergement de données de santé (HDS).** La certification s'applique aux données recueillies dans un cadre de soin. Une application de bien-être hors parcours médical n'y est en principe pas soumise, mais le point mérite une validation juridique avant commercialisation.

**Statut du produit.** Rester strictement dans le champ du bien-être. Toute fonction d'interprétation médicale ou de recommandation thérapeutique ferait basculer le produit sous le règlement européen sur les dispositifs médicaux.

**Distribution.** Les stores appliquent des règles spécifiques aux applications de santé et de suivi alimentaire, notamment sur l'exactitude des données et sur l'interdiction d'encourager des comportements dangereux. Les garde-fous de la section 6 y répondent directement.

**Abonnements.** Si le modèle est payant : droit de rétractation, reconduction tacite, résiliation en ligne. Le cadre français et européen est exigeant et régulièrement contrôlé.

Ce document décrit des exigences produit, pas un avis juridique. Faites valider l'ensemble par un juriste avant le lancement.

---

## 10. Modèle économique `[hypothèse]`

Freemium. Gratuit : saisie, objectif, poids, indicateurs du jour. Payant : déficit cumulé et sa conversion, dépense énergétique recalculée, projections, historique au-delà de 90 jours, exports, recettes illimitées.

La logique est saine : la partie gratuite couvre le besoin quotidien, la partie payante couvre l'analyse dans la durée, qui est précisément la promesse du produit et ce que la concurrence fait mal.

Ordre de grandeur du marché : les acteurs installés se situent entre 40 et 90 € par an. Un tarif inférieur avec une promesse plus étroite et mieux tenue est défendable.

---

## 11. Phases

**Phase 1 — Le squelette.** Authentification, profil, programme, saisie manuelle d'aliments, poids, objectif calorique, moteur de calcul avec tests. Livrable : on suit une journée de bout en bout et les chiffres sont justes.

**Phase 2 — Le produit.** Intégration Open Food Facts et CIQUAL, scan de code-barres, favoris et repas enregistrés, recettes, hors ligne, tableau de bord des quatre indicateurs, dépense réelle recalculée. Livrable : utilisable au quotidien sans frustration.

**Phase 3 — La profondeur.** Historique et courbes, projections, bilans hebdomadaires, exports, mensurations et photos, garde-fous complets, mode discret.

**Phase 4 — L'échelle.** Abonnements, natif via Capacitor, Apple Santé et Google Fit, notifications, widgets.

---

## 12. Critères d'acceptation

- Enregistrer un repas habituel prend moins de 10 secondes, moins de 5 pour un repas enregistré.
- Le scan d'un produit alimentaire français courant retourne une fiche exploitable dans plus de 85 % des cas.
- Le déficit cumulé est recalculable à la main à partir de l'export CSV et donne le même résultat.
- Après 28 jours de données complètes, la dépense énergétique recalculée s'écarte de moins de 10 % de la valeur déduite manuellement du bilan énergétique.
- Aucun indicateur cumulé ne s'affiche sans son taux de complétude.
- Une saisie effectuée hors ligne est présente et intacte après retour du réseau.
- Aucun objectif ne peut être créé sous les planchers de la section 6, quelle que soit la voie de saisie.
- La suppression du compte efface effectivement toutes les données en moins de 30 jours, y compris les sauvegardes.
- L'application est utilisable d'une seule main sur un écran de 375 px.

---

## 13. À trancher

**Les trois qui bloquent le développement :**

1. **Usage** — produit commercial destiné à la vente, ou outil personnel ? Le brief est écrit pour un produit commercial. Un usage strictement personnel supprime les sections 9 et 10 et divise la charge par trois.
2. **Plateforme** — la PWA est-elle acceptable en v1, ou le natif est-il exigé dès le départ ?
3. **Stack** — Next.js, Supabase et Vercel, ou autre choix ?

**Les autres, à traiter avant la phase 2 :**

4. Mono-utilisateur, ou compte partagé avec un coach ou un nutritionniste ?
5. Le suivi des macronutriments est-il central ou secondaire ? Il change la densité de l'interface de saisie.
6. Faut-il gérer plusieurs programmes successifs dès la v1, ou un seul programme actif suffit-il ?
7. Une reprise de données depuis une application existante est-elle nécessaire pour convertir des utilisateurs déjà engagés ailleurs ?

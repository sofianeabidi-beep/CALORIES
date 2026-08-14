/**
 * Constantes du moteur de calcul.
 *
 * Aucune de ces valeurs n'est arbitraire : chacune vient de la spec ou
 * de la littérature. Les modifier change les chiffres montrés à
 * l'utilisateur — toucher ici impose de reprendre les tests de référence.
 */

/**
 * Équivalent énergétique d'un kilo de masse grasse.
 *
 * C'est une **approximation** communément admise, pas une constante
 * physique. La composition de la perte varie, et une partie des
 * variations de poids à court terme relève de l'eau et du glycogène.
 * L'interface doit le dire (spec §6.4) — ce n'est pas une note de bas
 * de page, c'est une condition d'honnêteté du produit.
 */
export const KCAL_PAR_KG = 7700;

/** Facteurs d'activité appliqués au métabolisme de base (spec §6.2). */
export const FACTEURS_ACTIVITE = {
  sedentaire: 1.2,
  leger: 1.375,
  modere: 1.55,
  soutenu: 1.725,
  tres_soutenu: 1.9,
} as const;

/** Fenêtre glissante du recalcul de dépense réelle (spec §6.3). */
export const FENETRE_DEPENSE_REELLE_JOURS = 28;

/** Nombre minimal de jours renseignés dans la fenêtre (spec §6.3). */
export const MIN_JOURS_RENSEIGNES_DEPENSE = 14;

/** Nombre minimal de pesées dans la fenêtre (spec §6.3). */
export const MIN_PESEES_DEPENSE = 2;

/** Écart minimal entre la première et la dernière pesée (spec §6.3). */
export const MIN_ECART_PESEES_JOURS = 10;

/**
 * Seuil de fiabilité à partir duquel la dépense réelle **remplace**
 * l'estimation dans tous les calculs (spec §6.3).
 */
export const SEUIL_FIABILITE_DEPENSE_REELLE = 0.6;

/**
 * Variation maximale de la dépense retenue d'un jour à l'autre.
 * Évite les sauts d'indicateurs déroutants (spec §6.3).
 */
export const LISSAGE_DEPENSE_MAX = 0.05;

/** Fenêtre de la moyenne mobile du poids (spec §6.6). */
export const FENETRE_MOYENNE_MOBILE_JOURS = 7;

/**
 * Au-delà de cet écart avec la moyenne mobile, la pesée est marquée
 * aberrante, exclue de la moyenne, et l'utilisateur invité à confirmer
 * (spec §6.6). Elle est enregistrée dans tous les cas.
 */
export const ECART_ABERRANT_KG = 2;

/** Fenêtre du rythme réel servant à la projection (spec §6.7). */
export const FENETRE_PROJECTION_JOURS = 28;

/**
 * En deçà, aucune projection n'est affichée : mieux vaut n'afficher
 * aucune date qu'une date fausse (spec §6.7).
 */
export const MIN_JOURS_PROJECTION = 21;

/** Jours pris en compte pour estimer un jour manquant en mode `estime`. */
export const FENETRE_ESTIMATION_JOUR_MANQUANT = 7;

/**
 * Demi-largeur de la fourchette de projection, en fraction du rythme
 * observé. La spec §6.7 impose une fourchette sans en fixer l'ampleur.
 *
 * Ces 20 % bornent l'incertitude sur le **rythme mesuré** ; ils ne
 * modélisent pas le ralentissement métabolique qui accompagne la perte
 * de poids. L'interface ne doit donc pas présenter la borne prudente
 * comme un pire cas garanti.
 */
export const MARGE_PROJECTION = 0.2;

/**
 * En deçà de ce rythme hebdomadaire, aucune projection : la division
 * ferait exploser l'échéance et afficherait une date absurde.
 */
export const RYTHME_MINIMUM_PROJECTION_KG_SEMAINE = 0.05;

/**
 * Au-delà de cet horizon, la projection est masquée. Une date à quatre
 * ans n'est pas une information, c'est un artefact de division — et la
 * spec §6.7 tranche : mieux vaut n'afficher aucune date qu'une fausse.
 */
export const HORIZON_PROJECTION_JOURS = 730;

/** Planchers caloriques absolus, par sexe (spec §9). */
export const PLANCHER_KCAL = { f: 1200, h: 1500 } as const;

/** Aucun poids cible ne peut conduire sous cet IMC (spec §9). */
export const IMC_MINIMUM = 18.5;

/** Allure maximale, en fraction du poids corporel par semaine (spec §9). */
export const ALLURE_MAX_FRACTION_POIDS = 0.01;

/** Âge minimum à l'inscription (spec §9). */
export const AGE_MINIMUM = 18;

/**
 * Fenêtre de jours considérée pour la tendance récente affichée sur
 * l'écran Aujourd'hui. Décision produit, hors spec d'origine.
 */
export const FENETRE_TENDANCE_JOURS = 7;

/**
 * En deçà de ce nombre de jours renseignés dans la fenêtre, aucune
 * tendance n'est affichée — même principe qu'ailleurs : pas assez de
 * données renseignées, pas de message plutôt qu'un message inventé.
 */
export const SEUIL_JOURS_MIN_TENDANCE = 4;

/**
 * Écart de déficit journalier au-delà duquel un jour est considéré comme
 * notable (ex. « hier c'était plus gras ») plutôt que du bruit habituel.
 */
export const SEUIL_ECART_NOTABLE_KCAL = 300;

/**
 * À partir de cette fraction de l'objectif calorique, la journée est
 * jugée « proche de l'objectif » plutôt que strictement en dessous.
 * Décision produit, hors spec d'origine.
 */
export const SEUIL_PROCHE_OBJECTIF_KCAL = 0.9;

/**
 * Repère de protéines quotidien, en grammes par kilo de poids. Valeur
 * courante dans la littérature grand public pour la perte de poids —
 * **un repère, pas une prescription médicale**, à dire clairement dans
 * l'interface. Basé sur le poids de départ du programme, faute de mieux :
 * une variation de poids depuis ne le rend pas faux, juste approximatif.
 */
export const RATIO_PROTEINES_G_PAR_KG = 1.6;

/**
 * En dessous de cette fraction du repère de protéines, l'apport du jour
 * est jugé insuffisant. Une marge existe volontairement : ne pas signaler
 * un écart de quelques grammes comme un manque.
 */
export const SEUIL_PROTEINES_SUFFISANT = 0.8;

/**
 * Équivalences caloriques des macronutriments (facteurs d'Atwater).
 * Ce sont des constantes nutritionnelles standards, pas des décisions
 * produit — contrairement au ratio de répartition ci-dessous.
 */
export const KCAL_PAR_G_PROTEINES = 4;
export const KCAL_PAR_G_GLUCIDES = 4;
export const KCAL_PAR_G_LIPIDES = 9;

/**
 * Part de l'objectif calorique allouée aux lipides pour dériver un
 * objectif en grammes, une fois les protéines couvertes par leur propre
 * repère. Le glucide prend le reste. **Décision produit arbitraire**,
 * pas une recommandation nutritionnelle validée — à ajuster si besoin.
 */
export const RATIO_LIPIDES_KCAL_OBJECTIF = 0.3;

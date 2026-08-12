/**
 * Types de la base, tenus à la main.
 *
 * **Confrontés à la sortie de `supabase gen types typescript` le
 * 2026-08-10** : mêmes colonnes, mêmes obligations à l'insertion. Ce
 * fichier reste la version de référence parce que la génération
 * automatique élargit en `string` toutes les colonnes contraintes par
 * un `check` — `sexe`, `niveau_activite`, `repas`, `statut`, `source`.
 * Or ces unions littérales sont précisément ce qui empêche de passer
 * une valeur inexistante au moteur de calcul.
 *
 * À reconfronter après toute migration :
 *
 * ```bash
 * npx supabase gen types typescript --linked
 * ```
 *
 * Seules les tables utilisées en phase 1 sont décrites. Les colonnes
 * portent le nom exact des colonnes SQL — le mapping vers le camelCase
 * du domaine se fait dans `lib/actions/`.
 *
 * **Alias de type, jamais `interface`.** postgrest-js contraint chaque
 * ligne à `Record<string, unknown>`. Un alias d'objet obtient une
 * signature d'index implicite, une `interface` non : le schéma se
 * résoudrait alors en `never`, et toute écriture serait rejetée par le
 * typage avec un message qui ne désigne pas la cause.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [cle: string]: Json | undefined }
  | Json[];

export type Sexe = 'h' | 'f';
export type NiveauActivite =
  | 'sedentaire'
  | 'leger'
  | 'modere'
  | 'soutenu'
  | 'tres_soutenu';
export type ModeJoursManquants = 'neutre' | 'estime' | 'strict';
export type StatutJournee = 'renseigne' | 'estime' | 'manquant';
export type TypeProgramme = 'deficit' | 'surplus' | 'maintien';
export type Repas = 'petit_dejeuner' | 'dejeuner' | 'diner' | 'collation';
export type SourceEntree = 'off' | 'ciqual' | 'utilisateur' | 'recette' | 'rapide';

export type LigneProfil = {
  user_id: string;
  sexe: Sexe;
  date_naissance: string;
  // Recueillie à la création du programme, plus à l'inscription : la
  // colonne est nullable entre les deux (décision produit, 2026-08-12).
  taille_cm: number | null;
  niveau_activite: NiveauActivite;
  mode_jours_manquants: ModeJoursManquants;
  unite_poids: string;
  mode_discret: boolean;
  consentement_sante_le: string | null;
  cgu_acceptees_le: string | null;
  created_at: string;
  updated_at: string;
};

export type LigneProgramme = {
  id: string;
  user_id: string;
  libelle: string | null;
  type: TypeProgramme;
  date_debut: string;
  date_fin: string | null;
  poids_depart_kg: number;
  poids_cible_kg: number | null;
  allure_cible_kg_semaine: number | null;
  objectif_kcal: number | null;
  actif: boolean;
  created_at: string;
  updated_at: string;
};

export type LigneJournee = {
  id: string;
  user_id: string;
  programme_id: string | null;
  date: string;
  apport_kcal: number;
  proteines_g: number;
  glucides_g: number;
  lipides_g: number;
  depense_retenue_kcal: number | null;
  deficit_kcal: number | null;
  statut: StatutJournee;
  activite_kcal: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type LigneEntree = {
  id: string;
  user_id: string;
  journee_id: string;
  aliment_id: string | null;
  aliment_utilisateur_id: string | null;
  recette_id: string | null;
  libelle: string;
  repas: Repas;
  quantite: number;
  unite: string;
  quantite_g: number | null;
  kcal: number;
  proteines_g: number | null;
  glucides_g: number | null;
  lipides_g: number | null;
  source: SourceEntree;
  saisi_le: string;
  supprime_le: string | null;
  created_at: string;
  updated_at: string;
};

export type LignePesee = {
  id: string;
  user_id: string;
  date: string;
  poids_kg: number;
  moyenne_mobile_7j_kg: number | null;
  aberrante: boolean;
  confirmee: boolean;
  source: 'manuelle' | 'import';
  supprime_le: string | null;
  created_at: string;
  updated_at: string;
};

export type LigneInstantaneCalcul = {
  id: string;
  user_id: string;
  programme_id: string;
  date: string;
  deficit_cumul_kcal: number;
  kg_theoriques: number;
  kg_reels: number | null;
  ecart_kg: number | null;
  depense_reelle_kcal: number | null;
  depense_retenue_kcal: number;
  depense_issue_du_reel: boolean;
  fiabilite: number;
  allure_kg_semaine: number | null;
  completude: number;
  jours_renseignes: number;
  jours_total: number;
  projection_date: string | null;
  calcule_le: string;
  created_at: string;
  updated_at: string;
};

/** Colonnes remplies par la base : jamais envoyées par le client. */
type Auto = 'created_at' | 'updated_at';

/**
 * Insertion : tout est optionnel sauf les colonnes réellement
 * obligatoires, c'est-à-dire `not null` **sans valeur par défaut** dans
 * la migration. `user_id` n'en fait jamais partie : il vaut
 * `auth.uid()` par défaut.
 */
type Insertion<Ligne, Requis extends keyof Ligne> = Partial<Omit<Ligne, Auto>> &
  Pick<Ligne, Requis>;

type Table<Ligne, Requis extends keyof Ligne> = {
  Row: Ligne;
  Insert: Insertion<Ligne, Requis>;
  Update: Partial<Omit<Ligne, Auto>>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profil: Table<LigneProfil, 'sexe' | 'date_naissance'>;
      programme: Table<LigneProgramme, 'type' | 'date_debut' | 'poids_depart_kg'>;
      journee: Table<LigneJournee, 'date'>;
      entree: Table<
        LigneEntree,
        'journee_id' | 'libelle' | 'repas' | 'quantite' | 'kcal' | 'source'
      >;
      pesee: Table<LignePesee, 'date' | 'poids_kg'>;
      instantane_calcul: Table<
        LigneInstantaneCalcul,
        | 'programme_id'
        | 'date'
        | 'deficit_cumul_kcal'
        | 'kg_theoriques'
        | 'depense_retenue_kcal'
      >;
    };
    // `Record<string, never>` et non `Record<never, never>` : postgrest-js
    // contraint ces clés à `Record<string, …>`, et un objet vide sans
    // signature d'index fait échouer la contrainte — les tables se
    // résolvent alors en `never` et toute écriture est rejetée.
    Views: Record<string, never>;
    Functions: {
      /** Applique en une transaction les écritures d'un recalcul. */
      appliquer_recalcul: {
        Args: {
          p_programme_id: string;
          p_pesees: Json;
          p_journees: Json;
          p_instantanes: Json;
        };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

/**
 * Types de la base, tenus à la main.
 *
 * `supabase gen types typescript` a besoin d'un projet accessible ; il
 * n'y en a pas encore. Ce fichier reproduit les migrations de
 * `supabase/migrations/` et **doit être régénéré** dès que le projet
 * existe :
 *
 * ```bash
 * npx supabase gen types typescript --linked > lib/supabase/types.ts
 * ```
 *
 * Seules les tables utilisées en phase 1 sont décrites. Les colonnes
 * portent le nom exact des colonnes SQL — le mapping vers le camelCase
 * du domaine se fait dans `lib/actions/`.
 */

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

export interface LigneProfil {
  user_id: string;
  sexe: Sexe;
  date_naissance: string;
  taille_cm: number;
  niveau_activite: NiveauActivite;
  mode_jours_manquants: ModeJoursManquants;
  unite_poids: string;
  mode_discret: boolean;
  consentement_sante_le: string | null;
  cgu_acceptees_le: string | null;
  created_at: string;
  updated_at: string;
}

export interface LigneProgramme {
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
}

export interface LigneJournee {
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
}

export interface LigneEntree {
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
}

export interface LignePesee {
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
}

export interface LigneInstantaneCalcul {
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
}

type Table<Ligne, Insertion, Modification> = {
  Row: Ligne;
  Insert: Insertion;
  Update: Modification;
  Relationships: [];
};

/** Colonnes remplies par la base : jamais envoyées par le client. */
type Auto = 'created_at' | 'updated_at';

export interface Database {
  public: {
    Tables: {
      profil: Table<
        LigneProfil,
        Omit<LigneProfil, Auto | 'user_id'> & { user_id?: string },
        Partial<Omit<LigneProfil, Auto>>
      >;
      programme: Table<
        LigneProgramme,
        Omit<LigneProgramme, Auto | 'id' | 'user_id'> & { id?: string; user_id?: string },
        Partial<Omit<LigneProgramme, Auto>>
      >;
      journee: Table<
        LigneJournee,
        Omit<LigneJournee, Auto | 'id' | 'user_id'> & { id?: string; user_id?: string },
        Partial<Omit<LigneJournee, Auto>>
      >;
      entree: Table<
        LigneEntree,
        Omit<LigneEntree, Auto | 'user_id' | 'saisi_le'> & {
          user_id?: string;
          saisi_le?: string;
        },
        Partial<Omit<LigneEntree, Auto>>
      >;
      pesee: Table<
        LignePesee,
        Omit<LignePesee, Auto | 'user_id'> & { user_id?: string },
        Partial<Omit<LignePesee, Auto>>
      >;
      instantane_calcul: Table<
        LigneInstantaneCalcul,
        Omit<LigneInstantaneCalcul, Auto | 'id' | 'user_id' | 'calcule_le'> & {
          id?: string;
          user_id?: string;
          calcule_le?: string;
        },
        Partial<Omit<LigneInstantaneCalcul, Auto>>
      >;
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

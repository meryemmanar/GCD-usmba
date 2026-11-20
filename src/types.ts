// ============================================================================
// TYPAGES TYPESCRIPT CONFORMES AU SCHÉMA SUPABASE USMBA DOCTORAT
// ============================================================================

export type ProfilRole = 
  | 'VISITEUR'
  | 'CANDIDAT'
  | 'DIRECTEUR_THESE'
  | 'DIRECTEUR_STRUCTURE'
  | 'AGENT_ADMIN'
  | 'ADMIN_ED';

export type StatutCandidature = 
  | 'BROUILLON'
  | 'SOUMISE'
  | 'EN_EXAMEN'
  | 'CORRECTION_DEMANDEE'
  | 'ACCEPTEE'
  | 'REFUSEE';

export type StatutIdentite = 'NON_VERIFIE' | 'A_EXAMINER' | 'CONFORME' | 'NON_CONFORME';

export type StatutValidationSujet = 'EN_ATTENTE' | 'VALIDE' | 'REJETE';

export type StatutDocument = 'NON_DEPOSE' | 'EN_ATTENTE' | 'VALIDE' | 'REJETE';

export type StatutConformiteAuto = 'CONFORME' | 'A_CORRIGER' | 'A_VERIFIER';

export interface ExtractedCandidateDocData {
  nom: string;
  prenom: string;
  cin: string;
  cne: string;
  date_naissance: string;
  lieu_naissance: string;
  filiere: string;
  email: string;
  titre_sujet: string;
}

export interface ResultatControleConformite {
  statut: StatutConformiteAuto;
  motif?: string;
  moteur?: 'PDFJS_TEXT' | 'GEMINI' | 'TESSERACT_FALLBACK';
  date_controle?: string;
  donnees_extraites?: ExtractedCandidateDocData;
  etape1_valide?: boolean;
  etape2_valide?: boolean;
  doute_detecte?: boolean;
  type_detecte?: string;
}

export const PIECES_OBLIGATOIRES = [
  'Attestation de réussite de Licence',
  'Diplôme de Master / Ingénieur',
  'Relevés de notes Master (S1-S4)',
  'Projet de recherche rédigé',
  'Curriculum Vitae détaillé',
  "Carte d'identité nationale (CIN)"
] as const;

export type TypePieceObligatoire = typeof PIECES_OBLIGATOIRES[number];

export interface SujetThese {
  id: string;
  titre: string;
  description: string;
  nombre_places: number;
  statut: 'BROUILLON' | 'PROPOSE' | 'VALIDE' | 'CLOTURE';
  propose_par: string; // Nom de l'encadrant
  encadrant_id: string;
  encadrant_origine_id?: string;
  propose_par_origine?: string;
  reaffecte_depuis_nom?: string;
  directeur_structure_reaffecte_id?: string;
  structure: string; // Laboratoire / Équipe de recherche
  etablissement: string; // FST, FS Dhar El Mahraz, FMP, FSJES, etc.
  annee: number;
  theme: string;
  validation_structure: StatutValidationSujet;
  validation_centre: StatutValidationSujet;
  validation_pole: StatutValidationSujet;
}

export interface DocumentCandidat {
  id: string;
  type: string;
  nom_fichier: string;
  taille_mo?: number;
  taille_octets?: number;
  date_depot: string;
  obligatoire: boolean;
  statut_verification: StatutDocument;
  motif_rejet?: string;
  fichier_url?: string;
  page_count?: number;
  controle_conformite?: ResultatControleConformite;
}

export interface DonneesScanCnieDeclarees {
  nom: string;
  prenom: string;
  cin: string;
  date_naissance: string;
  lieu_naissance: string;
  date_validite: string;
  adresse: string;
}

export interface Candidature {
  id: string;
  ownerId: string; // Identifiant unique du propriétaire du dossier
  reference?: string; // Référence officielle générée (ex: DOC-2026-FSDM-0142)
  personne_id: string;
  version_campagne_id: string;
  candidat_nom: string;
  candidat_prenom: string;
  candidat_cne: string;
  candidat_email: string;
  candidat_telephone?: string;
  candidat_cin?: string;
  candidat_date_naissance?: string;
  candidat_lieu_naissance?: string;
  candidat_adresse?: string;
  candidat_date_validite_cin?: string;
  donnees_scan_cnie?: DonneesScanCnieDeclarees;
  candidat_compte_nom?: string;
  candidat_compte_prenom?: string;
  candidat_filiere?: string;
  date_creation: string;
  date_soumission?: string;
  statut: StatutCandidature;
  choix_sujets: { priorite: number; sujet: SujetThese }[];
  documents: DocumentCandidat[];
  controleDocumentaireDesactive?: boolean;
  motif_correction?: string;
  reaffecte_depuis_nom?: string;
  reaffecte_vers_nom?: string;
  directeur_structure_reaffecte_id?: string;
  // Étape 1 : Directeur de Thèse
  etape1?: {
    decideur: string;
    decideur_origine?: string;
    date_convocation?: string;
    note?: number;
    resultat?: 'LISTE_PRINCIPALE' | 'LISTE_ATTENTE' | 'REJETE';
    motif_refus?: string;
  };
  // Étape 2 : Directeur de Structure
  etape2?: {
    decideur: string;
    resultat?: 'FAVORABLE' | 'DEFAVORABLE';
    motif?: string;
    date_decision?: string;
  };
}

export interface EtapeCampagne {
  numero: number;
  titre: string;
  description: string;
}

export interface VersionCampagne {
  id: string;
  campagne_id: string;
  annee_universitaire: string;
  date_ouverture: string;
  date_cloture: string;
  date_modification: string;
  motif_modification: string;
  modifie_par: string;
  nombre_max_sujets: number;
  delai_inscription_jours: number;
  taille_max_fichier_mo: number;
  format_fichier_autorise: string;
  statut: 'OUVERTE' | 'CLOTUREE';
  etapes: EtapeCampagne[];
}

export type CampagneData = VersionCampagne;

export interface EtudiantUSMBA {
  id: string;
  nom: string;
  prenom: string;
  cne: string; // CNE / Massar
  email: string; // E-mail institutionnel (@usmba.ac.ma)
  filiere: string; // Filière d'origine (Master / Cycle Ingénieur)
  cin?: string;
  etablissement?: string;
}

export interface PersonneIdentite {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  date_naissance: string;
  lieu_naissance: string;
  adresse?: string;
  date_validite_cin?: string;
  donnees_scan_cnie?: DonneesScanCnieDeclarees;
  pays: string;
  type_document_identite: 'CIN' | 'PASSEPORT' | 'SEJOUR';
  numero_document_identite: string;
  cne: string;
  filiere?: string;
  statut_identite: StatutIdentite;
  motif_identite?: string;
  scan_url: string;
}

export interface EntreeHistoriqueVersion {
  version: string;
  date: string;
  auteur: string;
  modification: string;
  motif: string;
}

export interface UserAccount {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  password?: string;
  cin?: string;
  cne?: string;
  filiere?: string;
  role: ProfilRole;
  isAcademicUSMBA: boolean;
  etablissement?: string;
  statut_compte?: 'ACTIF' | 'INACTIF';
  reaffecte_vers_id?: string;
  reaffecte_vers_nom?: string;
  controleDocumentaireDesactive?: boolean;
}

export interface NotificationItem {
  id: string;
  userId: string; // Utilisateur destinataire de la notification
  message: string;
  date: string;
  lu: boolean;
}

export const STATUT_LABELS: Record<StatutCandidature, string> = {
  BROUILLON: 'Brouillon',
  SOUMISE: 'Soumise',
  EN_EXAMEN: 'En examen',
  CORRECTION_DEMANDEE: 'À compléter',
  ACCEPTEE: 'Admis',
  REFUSEE: 'Non retenue'
};


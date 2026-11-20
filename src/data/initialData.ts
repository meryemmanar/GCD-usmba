import { SujetThese, VersionCampagne, PersonneIdentite, Candidature, UserAccount, EntreeHistoriqueVersion, EtudiantUSMBA } from '../types';

export const INITIAL_CAMPAGNE_VERSION: VersionCampagne = {
  id: 'v-2026-1',
  campagne_id: 'camp-2026',
  annee_universitaire: '2026-2027',
  date_ouverture: '2026-10-01',
  date_cloture: '2026-12-15',
  date_modification: '2026-10-01',
  motif_modification: 'Lancement officiel du cycle doctoral 2026-2027 (Session Automne)',
  modifie_par: 'Secrétariat Général du CEDoc USMBA',
  nombre_max_sujets: 3,
  delai_inscription_jours: 10,
  taille_max_fichier_mo: 5,
  format_fichier_autorise: 'PDF',
  statut: 'OUVERTE',
  etapes: [
    {
      numero: 1,
      titre: 'Sélection des sujets et dépôt du dossier',
      description: 'Choix ordonné de 1 à 3 sujets de thèse et téléversement des pièces justificatives (PDF de 5 Mo maximum).'
    },
    {
      numero: 2,
      titre: 'Évaluation par le directeur de thèse',
      description: 'Examen de recevabilité scientifique, entretien oral avec l\'encadrant et avis/notation sur 20.'
    },
    {
      numero: 3,
      titre: 'Décision de la structure de recherche',
      description: 'Délibération et arbitrage de la commission de laboratoire pour validation de la liste principale et liste d\'attente.'
    },
    {
      numero: 4,
      titre: 'Inscription définitive',
      description: 'Dépôt physique du récépissé officiel avec signature manuscrite légalisée et des pièces papier sous 10 jours ouvrés auprès du secrétariat du CEDoc.'
    }
  ]
};

export const INITIAL_SUJETS: SujetThese[] = [
  {
    id: 's-1',
    titre: "Optimisation des architectures d'apprentissage profond pour l'analyse d'images satellitaires",
    description: "Conception de modèles hybrides CNN-Transformers basse consommation pour la cartographie des ressources hydriques du bassin versant de Sebou et la détection précoce du stress hydrique agricole en milieu semi-aride.",
    nombre_places: 1,
    statut: 'VALIDE',
    propose_par: 'Pr. Karim EL AMRANI',
    encadrant_id: 'user-dt-1',
    structure: 'Laboratoire d\'Informatique et Systèmes (LIS)',
    etablissement: 'Faculté des Sciences Dhar El Mahraz',
    annee: 2026,
    theme: 'Intelligence Artificielle & Télédétection',
    validation_structure: 'VALIDE',
    validation_centre: 'VALIDE',
    validation_pole: 'VALIDE'
  },
  {
    id: 's-2',
    titre: "Élaboration de nouveaux nanocomposites biosourcés pour le traitement des effluents industriels",
    description: "Synthèse et caractérisation physico-chimique de matrices polymériques fonctionnalisées à base de biopolymères locaux pour la dépollution sélective des rejets textiles et tanniques de la région Fès-Meknès.",
    nombre_places: 2,
    statut: 'VALIDE',
    propose_par: 'Pr. Samira BENKIRANE',
    encadrant_id: 'user-dt-2',
    structure: 'Laboratoire des Matériaux, Procédés et Environnement',
    etablissement: 'FST Fès',
    annee: 2026,
    theme: 'Chimie des Matériaux & Procédés Verts',
    validation_structure: 'VALIDE',
    validation_centre: 'VALIDE',
    validation_pole: 'VALIDE'
  },
  {
    id: 's-3',
    titre: "Mécanismes moléculaires de résistance aux antibiotiques chez les souches cliniques nosocomiales",
    description: "Étude génomique, métagénomique et phénotypique des déterminants de multi-résistance aux carbapénèmes isolés en milieu hospitalier universitaire (CHU Hassan II de Fès).",
    nombre_places: 1,
    statut: 'VALIDE',
    propose_par: 'Pr. Omar TOUHAMI',
    encadrant_id: 'user-dt-3',
    structure: 'Laboratoire de Recherche Biomédicale et Thérapeutique',
    etablissement: 'Faculté de Médecine et de Pharmacie',
    annee: 2026,
    theme: 'Sciences de la Santé & Génomique',
    validation_structure: 'VALIDE',
    validation_centre: 'VALIDE',
    validation_pole: 'VALIDE'
  },
  {
    id: 's-4',
    titre: "Contrôle prédictif et gestion d'énergie dans les micro-réseaux renouvelables hybrides",
    description: "Modélisation et régulation intelligente des systèmes multi-sources photovoltaïques couplés à des unités de stockage hydrogène pour sites isolés dans le Moyen Atlas.",
    nombre_places: 1,
    statut: 'PROPOSE',
    propose_par: 'Pr. Karim EL AMRANI',
    encadrant_id: 'user-dt-1',
    structure: 'Laboratoire d\'Informatique et Systèmes (LIS)',
    etablissement: 'Faculté des Sciences Dhar El Mahraz',
    annee: 2026,
    theme: 'Énergies Renouvelables & Automatique',
    validation_structure: 'EN_ATTENTE',
    validation_centre: 'EN_ATTENTE',
    validation_pole: 'EN_ATTENTE'
  },
  {
    id: 's-5',
    titre: "Impact de la transformation numérique sur la résilience des chaînes logistiques au Maroc",
    description: "Analyse empirique des chaînes d'approvisionnement agro-industrielles et apport des technologies Blockchain et IoT dans la traçabilité agroalimentaire post-pandémie.",
    nombre_places: 2,
    statut: 'VALIDE',
    propose_par: 'Pr. Hicham TAZI',
    encadrant_id: 'user-dt-4',
    structure: 'Laboratoire d\'Économie et Gestion des Organisations',
    etablissement: 'FSJES Fès',
    annee: 2026,
    theme: 'Management & Logistique Digitale',
    validation_structure: 'VALIDE',
    validation_centre: 'VALIDE',
    validation_pole: 'VALIDE'
  },
  {
    id: 's-6',
    titre: "Sécurité et confidentialité des données dans les réseaux de véhicules connectés (IoV)",
    description: "Développement de protocoles de consensus légers et d'algorithmes cryptographiques post-quantiques pour la communication véhicule-à-infrastructure (V2I).",
    nombre_places: 1,
    statut: 'VALIDE',
    propose_par: 'Pr. Meryem CHERKAOUI',
    encadrant_id: 'user-dt-5',
    structure: 'Laboratoire des Systèmes Intelligents et Réseaux',
    etablissement: 'ENSA Fès',
    annee: 2026,
    theme: 'Cybersécurité & Réseaux Intelligents',
    validation_structure: 'VALIDE',
    validation_centre: 'VALIDE',
    validation_pole: 'VALIDE'
  }
];

export const INITIAL_ETUDIANTS_USMBA: EtudiantUSMBA[] = [
  {
    id: 'etu-usmba-1',
    nom: 'MANAR',
    prenom: 'Meryem',
    cne: 'N123456789',
    email: 'meryem.manar@usmba.ac.ma',
    filiere: 'Master Intelligence Artificielle et Science des Données',
    cin: 'CD556677',
    etablissement: 'Faculté des Sciences Dhar El Mahraz'
  },
  {
    id: 'etu-usmba-2',
    nom: 'ALAMI',
    prenom: 'Yassine',
    cne: 'N134567890',
    email: 'yassine.alami@usmba.ac.ma',
    filiere: 'Master Systèmes Intelligents et Imagerie Numérique',
    cin: 'CD654321',
    etablissement: 'Faculté des Sciences Dhar El Mahraz'
  },
  {
    id: 'etu-usmba-3',
    nom: 'BENJELLOUN',
    prenom: 'Mehdi',
    cne: 'N143098765',
    email: 'mehdi.benjelloun@usmba.ac.ma',
    filiere: 'Master Génie des Matériaux et Procédés Avancés',
    cin: 'CD712345',
    etablissement: 'FST Fès'
  },
  {
    id: 'etu-usmba-4',
    nom: 'BERRADA',
    prenom: 'Fatima-Zahra',
    cne: 'M142098765',
    email: 'fz.berrada@usmba.ac.ma',
    filiere: 'Master Biotechnologie Médicale et Génomique',
    cin: 'CB897654',
    etablissement: 'Faculté de Médecine et de Pharmacie'
  },
  {
    id: 'etu-usmba-5',
    nom: 'EL IDRISSI',
    prenom: 'Anas',
    cne: 'N138765432',
    email: 'anas.elidrissi@usmba.ac.ma',
    filiere: 'Cycle Ingénieur Cybersécurité et Systèmes Embarqués',
    cin: 'CD823456',
    etablissement: 'ENSA Fès'
  },
  {
    id: 'etu-usmba-6',
    nom: 'CHAOUI',
    prenom: 'Salma',
    cne: 'N139876543',
    email: 'salma.chaoui@usmba.ac.ma',
    filiere: 'Master Management Logistique et Stratégie Digitale',
    cin: 'CD934567',
    etablissement: 'FSJES Fès'
  }
];

export const INITIAL_IDENTITES: PersonneIdentite[] = [
  {
    id: 'p-candidat-1',
    nom: 'ALAMI',
    prenom: 'Yassine',
    email: 'yassine.alami@usmba.ac.ma',
    telephone: '+212 661 234567',
    date_naissance: '1999-04-12',
    lieu_naissance: 'Fès',
    pays: 'Maroc',
    type_document_identite: 'CIN',
    numero_document_identite: 'CD654321',
    cne: 'N134567890',
    filiere: 'Master Systèmes Intelligents et Imagerie Numérique',
    statut_identite: 'A_EXAMINER',
    scan_url: 'scan_cin_cd654321.pdf'
  },
  {
    id: 'p-candidat-2',
    nom: 'BERRADA',
    prenom: 'Fatima-Zahra',
    email: 'fz.berrada@usmba.ac.ma',
    telephone: '+212 662 987654',
    date_naissance: '2000-08-23',
    lieu_naissance: 'Meknès',
    pays: 'Maroc',
    type_document_identite: 'CIN',
    numero_document_identite: 'CB897654',
    cne: 'M142098765',
    filiere: 'Master Biotechnologie Médicale et Génomique',
    statut_identite: 'A_EXAMINER',
    scan_url: 'scan_cin_cb897654.pdf'
  }
];

export const INITIAL_CANDIDATURES: Candidature[] = [
  {
    id: 'cand-001',
    ownerId: 'user-cand-1',
    reference: 'DOC-2026-0001',
    personne_id: 'p-candidat-1',
    version_campagne_id: 'v-2026-1',
    candidat_nom: 'ALAMI',
    candidat_prenom: 'Yassine',
    candidat_cne: 'N134567890',
    candidat_email: 'yassine.alami@usmba.ac.ma',
    candidat_telephone: '+212 661 234567',
    candidat_cin: 'CD654321',
    candidat_filiere: 'Master Systèmes Intelligents et Imagerie Numérique',
    date_creation: '2026-10-10',
    date_soumission: '2026-10-15',
    statut: 'EN_EXAMEN',
    choix_sujets: [
      { priorite: 1, sujet: INITIAL_SUJETS[0] },
      { priorite: 2, sujet: INITIAL_SUJETS[1] }
    ],
    documents: [
      { id: 'd-1', type: 'Attestation de réussite de Licence', nom_fichier: 'Attestation_Licence_Alami.pdf', date_depot: '2026-10-11', obligatoire: true, statut_verification: 'VALIDE' },
      { id: 'd-2', type: 'Diplôme de Master / Ingénieur', nom_fichier: 'Diplome_Master_Alami.pdf', date_depot: '2026-10-12', obligatoire: true, statut_verification: 'VALIDE' },
      { id: 'd-3', type: 'Relevés de notes Master (S1-S4)', nom_fichier: 'Releves_Notes_S1_S4_Alami.pdf', date_depot: '2026-10-12', obligatoire: true, statut_verification: 'VALIDE' },
      { id: 'd-4', type: 'Projet de recherche rédigé', nom_fichier: 'Projet_These_Alami_v1.pdf', date_depot: '2026-10-14', obligatoire: true, statut_verification: 'EN_ATTENTE' },
      { id: 'd-5', type: 'Curriculum Vitae détaillé', nom_fichier: 'CV_Alami_Yassine.pdf', date_depot: '2026-10-14', obligatoire: true, statut_verification: 'VALIDE' },
      { id: 'd-6', type: "Carte d'identité nationale (CIN)", nom_fichier: 'CIN_Alami_Recto_Verso.pdf', date_depot: '2026-10-15', obligatoire: true, statut_verification: 'EN_ATTENTE' }
    ],
    etape1: {
      decideur: 'Pr. Karim EL AMRANI',
      date_convocation: '2026-11-12T10:00',
      note: 16.5,
      resultat: 'LISTE_PRINCIPALE'
    }
  },
  {
    id: 'cand-002',
    ownerId: 'user-cand-2',
    reference: 'DOC-2026-0002',
    personne_id: 'p-candidat-mehdi',
    version_campagne_id: 'v-2026-1',
    candidat_nom: 'BENJELLOUN',
    candidat_prenom: 'Mehdi',
    candidat_cne: 'N143098765',
    candidat_email: 'mehdi.benjelloun@usmba.ac.ma',
    candidat_telephone: '+212 662 334455',
    candidat_cin: 'CD712345',
    candidat_filiere: 'Master Génie des Matériaux et Procédés Avancés',
    date_creation: '2026-10-18',
    statut: 'BROUILLON',
    controleDocumentaireDesactive: true,
    choix_sujets: [
      { priorite: 1, sujet: INITIAL_SUJETS[1] },
      { priorite: 2, sujet: INITIAL_SUJETS[2] }
    ],
    documents: [
      {
        id: 'd-b-0',
        type: 'Attestation de réussite de Licence',
        nom_fichier: 'Attestation_Reussite_Licence_Benjelloun.pdf',
        date_depot: '2026-10-18',
        obligatoire: true,
        statut_verification: 'EN_ATTENTE',
        fichier_url: '/assets/aistudio/Attestation_Reussite_Licence_Benjelloun_07a55e74.pdf'
      },
      {
        id: 'd-b-1',
        type: 'Diplôme de Master / Ingénieur',
        nom_fichier: 'Diplome_Master_Benjelloun.pdf',
        date_depot: '2026-10-18',
        obligatoire: true,
        statut_verification: 'EN_ATTENTE',
        fichier_url: '/assets/aistudio/Diplome_Master_Benjelloun_1478611a.pdf'
      },
      {
        id: 'd-b-2',
        type: 'Relevés de notes Master (S1-S4)',
        nom_fichier: 'Releves_Notes_S1_S4_Benjelloun.pdf',
        date_depot: '2026-10-18',
        obligatoire: true,
        statut_verification: 'EN_ATTENTE',
        fichier_url: '/assets/aistudio/Releves_Notes_S1_S4_Benjelloun_efebaea8.pdf'
      },
      {
        id: 'd-b-3',
        type: 'Projet de recherche rédigé',
        nom_fichier: 'Projet_Recherche_Benjelloun.pdf',
        date_depot: '2026-10-18',
        obligatoire: true,
        statut_verification: 'EN_ATTENTE',
        fichier_url: '/assets/aistudio/Projet_Recherche_Benjelloun_ee682dc8.pdf'
      },
      {
        id: 'd-b-4',
        type: 'Curriculum Vitae détaillé',
        nom_fichier: 'CV_Detaille_Benjelloun.pdf',
        date_depot: '2026-10-18',
        obligatoire: true,
        statut_verification: 'EN_ATTENTE',
        fichier_url: '/assets/aistudio/CV_Detaille_Benjelloun_6de619cf.pdf'
      },
      {
        id: 'd-b-5',
        type: "Carte d'identité nationale (CIN)",
        nom_fichier: 'Carte_Nationale_d_Identité_Recto_Verso.Benjelloun.pdf',
        date_depot: '2026-10-18',
        obligatoire: true,
        statut_verification: 'EN_ATTENTE',
        fichier_url: '/assets/aistudio/Carte_Nationale_d_Identit__Recto_Verso.Benjelloun_fbdbf8d3.pdf'
      }
    ]
  }
];

export const DEMO_USERS: UserAccount[] = [
  {
    id: 'user-cand-1',
    nom: 'ALAMI',
    prenom: 'Yassine',
    email: 'yassine.alami@usmba.ac.ma',
    password: 'Candidat2026!',
    cin: 'CD654321',
    cne: 'N134567890',
    filiere: 'Master Systèmes Intelligents et Imagerie Numérique',
    role: 'CANDIDAT',
    isAcademicUSMBA: true,
    etablissement: 'Faculté des Sciences Dhar El Mahraz',
    statut_compte: 'ACTIF'
  },
  {
    id: 'user-cand-2',
    nom: 'BENJELLOUN',
    prenom: 'Mehdi',
    email: 'mehdi.benjelloun@usmba.ac.ma',
    password: 'Candidat2026!',
    cin: 'CD712345',
    cne: 'N143098765',
    filiere: 'Master Génie des Matériaux et Procédés Avancés',
    role: 'CANDIDAT',
    isAcademicUSMBA: true,
    etablissement: 'FST Fès',
    statut_compte: 'ACTIF',
    controleDocumentaireDesactive: true
  },
  {
    id: 'user-cand-3',
    nom: 'MANAR',
    prenom: 'Meryem',
    email: 'meryem.manar@usmba.ac.ma',
    password: 'Candidat2026!',
    cin: 'CD556677',
    cne: 'N123456789',
    filiere: 'Master Intelligence Artificielle et Science des Données',
    role: 'CANDIDAT',
    isAcademicUSMBA: true,
    etablissement: 'Faculté des Sciences Dhar El Mahraz',
    statut_compte: 'ACTIF'
  },
  // --- DIRECTEURS DE THÈSE (ENCADRANTS) ---
  {
    id: 'user-dt-1',
    nom: 'EL AMRANI',
    prenom: 'Karim (Pr)',
    email: 'karim.elamrani@usmba.ac.ma',
    password: 'These2026!',
    cin: 'CD112233',
    role: 'DIRECTEUR_THESE',
    isAcademicUSMBA: true,
    etablissement: 'Faculté des Sciences Dhar El Mahraz',
    statut_compte: 'ACTIF'
  },
  {
    id: 'user-dt-2',
    nom: 'BENKIRANE',
    prenom: 'Samira (Pr)',
    email: 'samira.benkirane@usmba.ac.ma',
    password: 'These2026!',
    cin: 'CD112234',
    role: 'DIRECTEUR_THESE',
    isAcademicUSMBA: true,
    etablissement: 'FST Fès',
    statut_compte: 'ACTIF'
  },
  {
    id: 'user-dt-3',
    nom: 'TOUHAMI',
    prenom: 'Omar (Pr)',
    email: 'omar.touhami@usmba.ac.ma',
    password: 'These2026!',
    cin: 'CD112235',
    role: 'DIRECTEUR_THESE',
    isAcademicUSMBA: true,
    etablissement: 'Faculté de Médecine et de Pharmacie',
    statut_compte: 'ACTIF'
  },
  {
    id: 'user-dt-4',
    nom: 'TAZI',
    prenom: 'Hicham (Pr)',
    email: 'hicham.tazi@usmba.ac.ma',
    password: 'These2026!',
    cin: 'CD112236',
    role: 'DIRECTEUR_THESE',
    isAcademicUSMBA: true,
    etablissement: 'FSJES Fès',
    statut_compte: 'ACTIF'
  },
  {
    id: 'user-dt-5',
    nom: 'CHERKAOUI',
    prenom: 'Meryem (Pr)',
    email: 'meryem.cherkaoui@usmba.ac.ma',
    password: 'These2026!',
    cin: 'CD112237',
    role: 'DIRECTEUR_THESE',
    isAcademicUSMBA: true,
    etablissement: 'ENSA Fès',
    statut_compte: 'ACTIF'
  },
  // --- DIRECTIONS DE STRUCTURE DE RECHERCHE ---
  {
    id: 'user-ds-1',
    nom: 'BENNANI',
    prenom: 'Mustapha (Directeur Labo)',
    email: 'mustapha.bennani@usmba.ac.ma',
    password: 'Structure2026!',
    cin: 'CB445566',
    role: 'DIRECTEUR_STRUCTURE',
    isAcademicUSMBA: true,
    etablissement: 'Laboratoire d\'Informatique et Systèmes (LIS)',
    statut_compte: 'ACTIF'
  },
  {
    id: 'user-ds-2',
    nom: 'OUAZZANI',
    prenom: 'Khalid (Directeur Labo)',
    email: 'khalid.ouazzani@usmba.ac.ma',
    password: 'Structure2026!',
    cin: 'CB445567',
    role: 'DIRECTEUR_STRUCTURE',
    isAcademicUSMBA: true,
    etablissement: 'Laboratoire des Matériaux, Procédés et Environnement',
    statut_compte: 'ACTIF'
  },
  {
    id: 'user-ds-3',
    nom: 'LAHLOU',
    prenom: 'Fouzia (Directrice Labo)',
    email: 'fouzia.lahlou@usmba.ac.ma',
    password: 'Structure2026!',
    cin: 'CB445568',
    role: 'DIRECTEUR_STRUCTURE',
    isAcademicUSMBA: true,
    etablissement: 'Laboratoire de Recherche Biomédicale et Thérapeutique',
    statut_compte: 'ACTIF'
  },
  {
    id: 'user-ds-4',
    nom: 'SQALLI',
    prenom: 'Abdelilah (Directeur Labo)',
    email: 'abdelilah.sqalli@usmba.ac.ma',
    password: 'Structure2026!',
    cin: 'CB445569',
    role: 'DIRECTEUR_STRUCTURE',
    isAcademicUSMBA: true,
    etablissement: 'Laboratoire d\'Économie et Gestion des Organisations',
    statut_compte: 'ACTIF'
  },
  {
    id: 'user-ds-5',
    nom: 'MOUMEN',
    prenom: 'Hanane (Directrice Labo)',
    email: 'hanane.moumen@usmba.ac.ma',
    password: 'Structure2026!',
    cin: 'CB445570',
    role: 'DIRECTEUR_STRUCTURE',
    isAcademicUSMBA: true,
    etablissement: 'Laboratoire des Systèmes Intelligents et Réseaux',
    statut_compte: 'ACTIF'
  },
  // --- PERSONNEL ADMINISTRATIF DU CEDOC ---
  {
    id: 'user-agent-1',
    nom: 'IDRISSI',
    prenom: 'Laila (Agent Scolarité)',
    email: 'scolarite.cedoc@usmba.ac.ma',
    password: 'Scolarite2026!',
    cin: 'CD778899',
    role: 'AGENT_ADMIN',
    isAcademicUSMBA: true,
    etablissement: 'CEDoc USMBA',
    statut_compte: 'ACTIF'
  },
  {
    id: 'user-admin-1',
    nom: 'CHRAIBI',
    prenom: 'Ahmed (Directeur CEDoc)',
    email: 'direction.cedoc@usmba.ac.ma',
    password: 'Admin2026!',
    cin: 'CD990011',
    role: 'ADMIN_ED',
    isAcademicUSMBA: true,
    etablissement: 'Présidence USMBA',
    statut_compte: 'ACTIF'
  }
];

export const INITIAL_HISTORIQUE_VERSIONS: EntreeHistoriqueVersion[] = [
  {
    version: 'v-2026-1',
    date: '2026-10-01',
    auteur: 'Secrétariat Général du CEDoc USMBA',
    modification: 'Lancement initial (Clôture: 15/12/2026, 3 sujets max, délai 10 jours ouvrés, max 5 Mo)',
    motif: 'Lancement officiel du cycle doctoral 2026-2027 (Session Automne)'
  }
];


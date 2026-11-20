import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  AlertTriangle, 
  CheckCircle2, 
  UploadCloud, 
  FileText, 
  Trash2, 
  Eye, 
  Plus, 
  RefreshCw,
  ShieldCheck, 
  X, 
  GraduationCap, 
  Check,
  Layers,
  AlertCircle,
  FileCheck2,
  Clock,
  Sparkles,
  User,
  Download,
  Lock,
  BookOpen,
  ArrowRight,
  Camera
} from 'lucide-react';
import { Candidature, DocumentCandidat, ResultatControleConformite, StatutCandidature, VersionCampagne, SujetThese, PIECES_OBLIGATOIRES, TypePieceObligatoire } from '../types';
import { formatDateJJMMAAAA } from '../utils/dateUtils';
import { BadgeCampagne } from './BadgeCampagne';
import { validatePdfFile, generateSamplePdf, generateCharteThesesPdf, generateFicheD1Pdf, generateRecepissePdf, downloadFile, formatTailleFichier } from '../utils/pdfUtils';
import {
  verifyUploadedPdfCompliance,
  verifyPdfUrlCompliance,
  decodePdfDataUrlToBytes,
  toResultatControleConformite
} from '../utils/documentVerificationUtils';
import { ModalVisualiseurPdf } from './ModalVisualiseurPdf';
import { ModalScanCNIE, CnieScanCompletePayload } from './ModalScanCNIE';
import {
  RawCnieExtraction,
  compareExtractedNameWithAccount,
  validateCnieExtraction
} from '../utils/cnieExtractionUtils';
import { CatalogueView } from './CatalogueView';

export type CandidatSubTab = 'CHOIX_SUJETS' | 'SYNTHESE' | 'PIECES' | 'DOCS_GENERES';

interface CandidatViewProps {
  candidature: Candidature;
  campagne: VersionCampagne;
  sujetsCatalogue?: SujetThese[];
  activeSubTab?: CandidatSubTab;
  onChangeSubTab?: (tab: CandidatSubTab) => void;
  onAjouterSujetDossier?: (sujet: SujetThese) => void;
  onRetirerSujetDossier?: (sujetId: string) => void;
  onDeplacerPrioriteDossier?: (index: number, direction: 'UP' | 'DOWN') => void;
  onSelectDetailSujet?: (sujet: SujetThese) => void;
  onValiderChoixSujets?: () => void;
  onResoumettre: (id: string) => void;
  onSoumettreBrouillon: (id: string) => void;
  onAjouterDocument: (candidatureId: string, doc: DocumentCandidat) => void;
  onRemplacerDocument: (candidatureId: string, docId: string, nouveauDoc: DocumentCandidat) => void;
  onSupprimerDocument: (candidatureId: string, docId: string, pieceType?: string) => void;
  onUpdateDocumentConformite?: (candidatureId: string, docId: string, controle: ResultatControleConformite) => void;
  onUpdateIdentiteDepuisCnie?: (candidatureId: string, fields: RawCnieExtraction) => void;
  onPreviewDoc: (titre: string, code: string) => void;
}

export const CandidatView: React.FC<CandidatViewProps> = ({
  candidature,
  campagne,
  sujetsCatalogue = [],
  activeSubTab,
  onChangeSubTab,
  onAjouterSujetDossier,
  onRetirerSujetDossier,
  onDeplacerPrioriteDossier,
  onSelectDetailSujet,
  onValiderChoixSujets,
  onResoumettre,
  onSoumettreBrouillon,
  onAjouterDocument,
  onRemplacerDocument,
  onSupprimerDocument,
  onUpdateDocumentConformite,
  onUpdateIdentiteDepuisCnie,
  onPreviewDoc
}) => {
  const nbSujetsInitial = candidature.choix_sujets?.length || 0;
  const [internalTab, setInternalTab] = useState<CandidatSubTab>(
    nbSujetsInitial === 0 ? 'CHOIX_SUJETS' : 'SYNTHESE'
  );

  const nbSujets = candidature.choix_sujets?.length || 0;
  const aAuMoinsUnSujet = nbSujets >= 1;
  const bypassControle = Boolean(candidature.controleDocumentaireDesactive);

  // Si le candidat n'a choisi aucun sujet, il est obligatoirement maintenu sur le choix des sujets
  const currentTab: CandidatSubTab = !aAuMoinsUnSujet
    ? 'CHOIX_SUJETS'
    : (activeSubTab || internalTab);

  const handleSetTab = (tab: CandidatSubTab) => {
    if (!aAuMoinsUnSujet && tab !== 'CHOIX_SUJETS') {
      return;
    }
    if (tab !== 'PIECES') {
      setScanCnieModalOpen(false);
    }
    setInternalTab(tab);
    if (onChangeSubTab) {
      onChangeSubTab(tab);
    }
  };

  // État du visualiseur de PDF réel
  const [visualiseurDoc, setVisualiseurDoc] = useState<{
    docTitle: string;
    fileName: string;
    pdfUrl?: string;
    pageCount?: number;
    statut?: string;
    motifRejet?: string;
  } | null>(null);

  // État pour la confirmation de retrait d'une pièce
  const [pieceARetirer, setPieceARetirer] = useState<{ pieceType: string; docId: string } | null>(null);

  // État d'ouverture du scanner de Carte Nationale (CNIE) et des champs extraits (uniquement initialisé dans l'étape « Pièces justificatives »)
  const [scanCnieModalOpen, setScanCnieModalOpen] = useState(false);
  const [dernierScanCnieData, setDernierScanCnieData] = useState<{
    fields: RawCnieExtraction;
    engine: 'GEMINI' | 'TESSERACT_FALLBACK' | 'MANUEL';
  } | null>(null);

  // Si l'utilisateur quitte l'étape « Pièces justificatives », on ferme et démonte immédiatement le scanner CNIE
  useEffect(() => {
    if (currentTab !== 'PIECES') {
      setScanCnieModalOpen(false);
    }
  }, [currentTab]);

  // Nom d'origine du compte pour la comparaison avec le nom extrait de la CNIE
  const accountNom = candidature.candidat_compte_nom || candidature.candidat_nom;
  const accountPrenom = candidature.candidat_compte_prenom || candidature.candidat_prenom;

  // Étape « Informations personnelles » (remplies automatiquement après le scan CNIE et modifiables par le candidat)
  const initialInfoPerso: RawCnieExtraction = {
    nom: candidature.candidat_nom || '',
    prenom: candidature.candidat_prenom || '',
    cin: candidature.candidat_cin || '',
    date_naissance: candidature.candidat_date_naissance || '',
    lieu_naissance: candidature.candidat_lieu_naissance || '',
    adresse: candidature.candidat_adresse || '',
    date_validite: candidature.candidat_date_validite_cin || ''
  };
  const [infoPersoForm, setInfoPersoForm] = useState<RawCnieExtraction>(initialInfoPerso);
  const [infoPersoConfirmees, setInfoPersoConfirmees] = useState<boolean>(() =>
    validateCnieExtraction('GEMINI', initialInfoPerso).allValid
  );
  const [infoPersoSaveBanner, setInfoPersoSaveBanner] = useState<string | null>(null);
  const [infoPersoErrorBanner, setInfoPersoErrorBanner] = useState<string | null>(null);

  // Suivi de l'affichage différé des erreurs : uniquement après avoir quitté un champ (onBlur) ou après une tentative, pas dès l'ouverture de la page
  const [infoPersoTouched, setInfoPersoTouched] = useState<
    Partial<Record<keyof RawCnieExtraction, boolean>>
  >({});
  const [infoPersoAttempted, setInfoPersoAttempted] = useState<boolean>(false);

  // Validation temps réel de tous les champs obligatoires de l'étape « Informations personnelles »
  const infoPersoValidation = validateCnieExtraction('GEMINI', infoPersoForm);

  // Erreurs d'upload par pièce
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [isProcessingUpload, setIsProcessingUpload] = useState<Record<string, boolean>>({});
  const autoCheckedDocIdsRef = useRef<Set<string>>(new Set());

  // Références d'inputs de fichier masqués par type de pièce
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Contrôle automatique des pièces déjà rattachées en brouillon qui n'ont pas encore de résultat de conformité
  useEffect(() => {
    if (bypassControle) return;
    if (!onUpdateDocumentConformite) return;
    if (candidature.statut !== 'BROUILLON' && candidature.statut !== 'CORRECTION_DEMANDEE') return;

    const docsToAnalyze = candidature.documents.filter(
      (d) =>
        d.statut_verification !== 'NON_DEPOSE' &&
        Boolean(d.fichier_url) &&
        !d.controle_conformite &&
        !autoCheckedDocIdsRef.current.has(d.id)
    );

    if (docsToAnalyze.length === 0) return;

    let cancelled = false;
    docsToAnalyze.forEach((doc) => {
      autoCheckedDocIdsRef.current.add(doc.id);
      const pieceType = doc.type as TypePieceObligatoire;
      setIsProcessingUpload((prev) => ({ ...prev, [pieceType]: true }));

      verifyPdfUrlCompliance({
        fichierUrl: doc.fichier_url!,
        pageCount: doc.page_count,
        expectedType: pieceType,
        candidature
      })
        .then((res) => {
          if (cancelled) return;
          onUpdateDocumentConformite(candidature.id, doc.id, toResultatControleConformite(res));
        })
        .catch((err) => {
          console.warn('Contrôle automatique différé impossible :', err);
        })
        .finally(() => {
          if (!cancelled) {
            setIsProcessingUpload((prev) => ({ ...prev, [pieceType]: false }));
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [candidature, onUpdateDocumentConformite, bypassControle]);

  // État de chargement pour les téléchargements de PDF administratifs
  const [telechargeantDoc, setTelechargeantDoc] = useState<'charte' | 'ficheD1' | 'recepisse' | null>(null);

  // Le dossier est validé définitivement quand le statut est ACCEPTEE (Admis)
  const isDossierAdmis = candidature.statut === 'ACCEPTEE';

  // Téléchargement Charte des Thèses
  const handleTelechargerCharte = async () => {
    try {
      setTelechargeantDoc('charte');
      const { blob } = await generateCharteThesesPdf();
      downloadFile(blob, 'Charte_des_Theses_USMBA.pdf');
    } catch (err) {
      console.error("Erreur téléchargement charte :", err);
    } finally {
      setTelechargeantDoc(null);
    }
  };

  // Téléchargement Fiche d'Inscription D1 (déverrouillée après admission)
  const handleTelechargerFicheD1 = async () => {
    try {
      setTelechargeantDoc('ficheD1');
      const { blob } = await generateFicheD1Pdf(candidature, campagne);
      const safeNom = (candidature.candidat_nom || 'Candidat').replace(/\s+/g, '_');
      downloadFile(blob, `Fiche_Inscription_D1_${safeNom}.pdf`);
    } catch (err) {
      console.error("Erreur téléchargement fiche D1 :", err);
    } finally {
      setTelechargeantDoc(null);
    }
  };

  // Téléchargement Récépissé de Dépôt (PDF imprimable)
  const handleTelechargerRecepisse = async () => {
    try {
      setTelechargeantDoc('recepisse');
      const { blob } = await generateRecepissePdf(candidature, campagne);
      const safeRef = (candidature.reference || candidature.id || 'Dossier').replace(/\s+/g, '_');
      const safeNom = (candidature.candidat_nom || 'Candidat').replace(/\s+/g, '_');
      downloadFile(blob, `Recepisse_Depot_${safeRef}_${safeNom}.pdf`);
    } catch (err) {
      console.error("Erreur téléchargement récépissé :", err);
    } finally {
      setTelechargeantDoc(null);
    }
  };

  // Les 6 pièces obligatoires requises
  const totalObligatoires = PIECES_OBLIGATOIRES.length; // 6 pièces

  // Map des pièces actuellement déposées (exclut celles au statut NON_DEPOSE)
  const mapPiecesDeposees = new Map<string, DocumentCandidat>();
  candidature.documents.forEach(d => {
    if (d.statut_verification !== 'NON_DEPOSE') {
      mapPiecesDeposees.set(d.type, d);
    }
  });

  // Calcul du nombre de pièces obligatoires valablement déposées (statut !== NON_DEPOSE)
  const nbPiecesFournies = PIECES_OBLIGATOIRES.filter(type => mapPiecesDeposees.has(type)).length;
  const aSujetsValides = nbSujets >= 1 && nbSujets <= 3;
  const toutEstPret = nbPiecesFournies === totalObligatoires && aSujetsValides;

  // Déclenche le sélecteur de fichier réel
  const declencherSelecteurFichier = (pieceType: string) => {
    setUploadErrors(prev => ({ ...prev, [pieceType]: '' }));
    const input = fileInputRefs.current[pieceType];
    if (input) {
      input.value = '';
      input.click();
    }
  };

  // Traitement du fichier téléversé par le candidat (contrôle technique + contrôle de conformité du contenu en 2 étapes)
  const handleFichierSelectionne = async (pieceType: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingUpload(prev => ({ ...prev, [pieceType]: true }));
    setUploadErrors(prev => ({ ...prev, [pieceType]: '' }));

    try {
      const isCin = pieceType === "Carte d'identité nationale (CIN)";
      const maxMo = campagne?.taille_max_fichier_mo || 5;

      // 1. Contrôle technique automatique (magic bytes %PDF, taille, intégrité structurelle)
      // On diffère le blocage « 2 pages CIN » afin d'identifier d'abord si le fichier ressemble à un autre type (ex: CV renommé CIN.pdf)
      const resultat = await validatePdfFile(file, isCin, maxMo, { skipCinPageCheck: true });

      if (!resultat.valid || !resultat.bytes) {
        setUploadErrors(prev => ({ ...prev, [pieceType]: resultat.error || "Fichier invalide." }));
        return;
      }

      // 2. Contrôle de conformité du contenu du PDF en 2 étapes (type + correspondance candidat, sans jamais utiliser le nom du fichier)
      let controleConformite: ResultatControleConformite | undefined;
      if (!bypassControle) {
        const verification = await verifyUploadedPdfCompliance({
          pdfBytes: resultat.bytes,
          pageCount: resultat.pageCount || 1,
          expectedType: pieceType as TypePieceObligatoire,
          candidature
        });
        controleConformite = toResultatControleConformite(verification);

        if (verification.status === 'A_CORRIGER') {
          setUploadErrors(prev => ({
            ...prev,
            [pieceType]: verification.error || "Document à corriger : type ou données non conformes au dossier."
          }));
          return;
        }
      }

      const byteLength = resultat.byteLength ?? file.size;
      const nouveauDoc: DocumentCandidat = {
        id: `d-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: pieceType,
        nom_fichier: file.name,
        taille_octets: byteLength,
        taille_mo: byteLength / (1024 * 1024),
        date_depot: new Date().toISOString().split('T')[0],
        obligatoire: true,
        statut_verification: 'EN_ATTENTE',
        fichier_url: resultat.dataUrl,
        page_count: resultat.pageCount,
        controle_conformite: controleConformite
      };

      const docExistant = mapPiecesDeposees.get(pieceType);
      if (docExistant) {
        onRemplacerDocument(candidature.id, docExistant.id, nouveauDoc);
      } else {
        onAjouterDocument(candidature.id, nouveauDoc);
      }
    } finally {
      setIsProcessingUpload(prev => ({ ...prev, [pieceType]: false }));
    }
  };

  // Enregistrement du scan / rescan CNIE (caméra ou photo importée) avec vérification de conformité du PDF généré (Étapes 1 & 2)
  const handleScanCnieComplete = async (
    result: CnieScanCompletePayload
  ): Promise<{ valid: boolean; error?: string }> => {
    const pieceType: TypePieceObligatoire = "Carte d'identité nationale (CIN)";
    setUploadErrors(prev => ({ ...prev, [pieceType]: '' }));

    const candidaturePourControle: Candidature = {
      ...candidature,
      candidat_nom: result.extractedFields.nom || candidature.candidat_nom,
      candidat_prenom: result.extractedFields.prenom || candidature.candidat_prenom,
      candidat_cin: result.extractedFields.cin || candidature.candidat_cin,
      candidat_date_naissance: result.extractedFields.date_naissance || candidature.candidat_date_naissance,
      candidat_lieu_naissance: result.extractedFields.lieu_naissance || candidature.candidat_lieu_naissance,
      donnees_scan_cnie: result.extractedFields
    };

    let controleConformite: ResultatControleConformite | undefined;

    if (!bypassControle && !result.isManualOnly && result.dataUrl && result.nomFichier) {
      setIsProcessingUpload(prev => ({ ...prev, [pieceType]: true }));
      try {
        const pdfBytes = decodePdfDataUrlToBytes(result.dataUrl);
        const verification = await verifyUploadedPdfCompliance({
          pdfBytes,
          pageCount: result.pageCount || 1,
          expectedType: pieceType,
          candidature: candidaturePourControle
        });
        controleConformite = toResultatControleConformite(verification);

        if (verification.status === 'A_CORRIGER') {
          const errMsg =
            verification.error || "Document à corriger : ce document ne correspond pas à la CNIE du candidat.";
          setUploadErrors(prev => ({ ...prev, [pieceType]: errMsg }));
          return { valid: false, error: errMsg };
        }
      } finally {
        setIsProcessingUpload(prev => ({ ...prev, [pieceType]: false }));
      }
    }

    setDernierScanCnieData({
      fields: result.extractedFields,
      engine: result.engine
    });

    // Remplissage automatique des champs de l'étape « Informations personnelles »
    const nouveauxChamps: RawCnieExtraction = {
      nom: result.extractedFields.nom,
      prenom: result.extractedFields.prenom,
      cin: result.extractedFields.cin,
      date_naissance: result.extractedFields.date_naissance,
      lieu_naissance: result.extractedFields.lieu_naissance,
      adresse: result.extractedFields.adresse,
      date_validite: result.extractedFields.date_validite
    };
    const scanValidation = validateCnieExtraction('GEMINI', nouveauxChamps);
    setInfoPersoForm(nouveauxChamps);
    setInfoPersoAttempted(true);
    setInfoPersoConfirmees(scanValidation.allValid);
    setInfoPersoErrorBanner(null);
    setInfoPersoSaveBanner(
      scanValidation.allValid
        ? "Les champs de l'étape « Informations personnelles » ont été remplis et validés à partir de votre CNIE."
        : `Certains champs n'ont pas pu être lus et restent à compléter (${scanValidation.remainingCount} ${
            scanValidation.remainingCount > 1 ? 'champs restants' : 'champ restant'
          }).`
    );

    if (!result.isManualOnly && result.dataUrl && result.nomFichier) {
      const nouveauDoc: DocumentCandidat = {
        id: `d-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: pieceType,
        nom_fichier: result.nomFichier,
        taille_octets: result.byteLength,
        taille_mo: result.byteLength ? result.byteLength / (1024 * 1024) : result.tailleMo,
        date_depot: new Date().toISOString().split('T')[0],
        obligatoire: true,
        statut_verification: 'EN_ATTENTE',
        fichier_url: result.dataUrl,
        page_count: result.pageCount,
        controle_conformite: controleConformite
      };

      const docExistant = mapPiecesDeposees.get(pieceType);
      if (docExistant) {
        onRemplacerDocument(candidature.id, docExistant.id, nouveauDoc);
      } else {
        onAjouterDocument(candidature.id, nouveauDoc);
      }
    }

    if (onUpdateIdentiteDepuisCnie) {
      onUpdateIdentiteDepuisCnie(candidature.id, nouveauxChamps);
    }

    return { valid: true };
  };

  // Modification d'un champ de l'étape « Informations personnelles » par le candidat
  // Si le candidat modifie un champ et le vide, le bouton se désactive immédiatement de nouveau
  const handleInfoPersoFieldChange = (key: keyof RawCnieExtraction, value: string) => {
    setInfoPersoForm(prev => ({ ...prev, [key]: value }));
    setInfoPersoConfirmees(false);
    setInfoPersoSaveBanner(null);
    setInfoPersoErrorBanner(null);
  };

  const handleInfoPersoFieldBlur = (key: keyof RawCnieExtraction) => {
    setInfoPersoTouched(prev => ({ ...prev, [key]: true }));
  };

  // Tentative de validation / enregistrement (impossible de contourner même avec la touche Entrée)
  const handleConfirmerInfoPerso = () => {
    setInfoPersoAttempted(true);

    if (!infoPersoValidation.allValid) {
      setInfoPersoConfirmees(false);
      setInfoPersoSaveBanner(null);
      setInfoPersoErrorBanner(
        `Enregistrement impossible : veuillez remplir et corriger tous les champs obligatoires (${infoPersoValidation.remainingCount} ${
          infoPersoValidation.remainingCount > 1 ? 'champs restants' : 'champ restant'
        }).`
      );
      return;
    }

    const normalizedFields: RawCnieExtraction = {
      nom: infoPersoValidation.fields.nom.value,
      prenom: infoPersoValidation.fields.prenom.value,
      cin: infoPersoValidation.fields.cin.value,
      date_naissance: infoPersoValidation.fields.date_naissance.value,
      lieu_naissance: infoPersoValidation.fields.lieu_naissance.value,
      adresse: infoPersoValidation.fields.adresse.value,
      date_validite: infoPersoValidation.fields.date_validite.value
    };

    setInfoPersoForm(normalizedFields);
    if (onUpdateIdentiteDepuisCnie) {
      onUpdateIdentiteDepuisCnie(candidature.id, normalizedFields);
    }
    setInfoPersoConfirmees(true);
    setInfoPersoErrorBanner(null);
    setInfoPersoSaveBanner(
      "Vos informations personnelles sont complètes, valides et ont été enregistrées dans votre dossier."
    );
  };

  // Retirer un document (ouvre la modale de confirmation in-app sans window.confirm)
  const handleRetirerPiece = (pieceType: string, doc: DocumentCandidat) => {
    setPieceARetirer({ pieceType, docId: doc.id });
  };

  // Visualiser un document dans le visualiseur intégré réel
  const handleVoirDocument = async (doc: DocumentCandidat) => {
    let pdfUrl = doc.fichier_url;
    let pageCount = doc.page_count;

    // Si le document n'a pas encore son URL chargée (fichier de démo initial), on le génère à la volée
    if (!pdfUrl) {
      const generated = await generateSamplePdf(doc.type, `${candidature.candidat_nom} ${candidature.candidat_prenom}`, candidature.candidat_cin);
      pdfUrl = generated.dataUrl;
      pageCount = generated.pageCount;
    }

    setVisualiseurDoc({
      docTitle: doc.type,
      fileName: doc.nom_fichier,
      pdfUrl,
      pageCount: pageCount || 1,
      statut: doc.statut_verification,
      motifRejet: doc.motif_rejet
    });
  };

  // Badge du statut global du dossier
  const getStatutBadge = (statut: StatutCandidature) => {
    switch (statut) {
      case 'BROUILLON':
        return <span className="px-2.5 py-1 rounded-[6px] text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">Brouillon</span>;
      case 'SOUMISE':
        return <span className="px-2.5 py-1 rounded-[6px] text-xs font-bold bg-sky-50 text-sky-700 border border-sky-300">Soumise</span>;
      case 'EN_EXAMEN':
        return <span className="px-2.5 py-1 rounded-[6px] text-xs font-bold bg-[#f0fdfa] text-[#0f766e] border border-[#ccfbf1]">En examen</span>;
      case 'CORRECTION_DEMANDEE':
        return <span className="px-2.5 py-1 rounded-[6px] text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">À compléter</span>;
      case 'ACCEPTEE':
        return (
          <span className="px-2.5 py-1 rounded-[6px] text-xs font-bold bg-emerald-50 text-[#16a34a] border border-emerald-300 inline-flex items-center gap-1">
            <Check className="w-3.5 h-3.5 text-[#16a34a] stroke-[2.5]" />
            <span>Admis</span>
          </span>
        );
      case 'REFUSEE':
        return <span className="px-2.5 py-1 rounded-[6px] text-xs font-bold bg-rose-50 text-rose-800 border border-rose-300">Non retenue</span>;
    }
  };

  return (
    <div className="space-y-8 pb-16">
      
      {/* En-tête Principal Candidat Aéré */}
      <div className="bg-white p-6 sm:p-8 rounded-[6px] border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-serif">
                Dossier D1 : {candidature.candidat_prenom} {candidature.candidat_nom}
              </h1>
              {getStatutBadge(candidature.statut)}
              <BadgeCampagne campagne={campagne} />
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              CNE / Massar : <span className="font-mono font-bold text-slate-700">{candidature.candidat_cne || 'Non renseigné'}</span> &bull; 
              Réf. Dossier : <span className="font-mono font-bold text-slate-800">{candidature.reference || candidature.id}</span> &bull; 
              Email : <span className="text-slate-700">{candidature.candidat_email}</span>
            </p>
          </div>

          {/* Action selon le statut */}
          <div>
            {candidature.statut === 'BROUILLON' && (
              <button
                onClick={() => onSoumettreBrouillon(candidature.id)}
                disabled={!toutEstPret}
                className="bg-[#0f766e] hover:bg-[#115e59] disabled:bg-slate-200 disabled:text-slate-400 text-white px-5 py-3 rounded-[6px] text-xs sm:text-sm font-bold transition shadow-xs flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                title={!toutEstPret ? (!aSujetsValides ? "Sélectionnez entre 1 et 3 sujets de thèse." : `Les 6 pièces obligatoires doivent être téléversées (${nbPiecesFournies}/6).`) : "Soumettre définitivement mon dossier"}
              >
                <Send className="w-4 h-4" />
                <span>Soumettre définitivement mon dossier</span>
              </button>
            )}

            {candidature.statut === 'CORRECTION_DEMANDEE' && (
              <button
                onClick={() => onResoumettre(candidature.id)}
                className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-3 rounded-[6px] text-xs sm:text-sm font-bold transition shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Resoumettre le dossier révisé</span>
              </button>
            )}
          </div>
        </div>

        {/* Bandeau d'affiliation */}
        {candidature.candidat_email.endsWith('@usmba.ac.ma') ? (
          <div className="p-3.5 rounded-[6px] bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-semibold flex items-center gap-2.5 shadow-2xs">
            <GraduationCap className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Affiliation institutionnelle vérifiée &bull; Compte académique USMBA actif &bull; Éligible au dépôt de candidature D1</span>
          </div>
        ) : (
          <div className="p-3.5 rounded-[6px] bg-amber-50 border border-amber-200 text-xs text-amber-900 font-semibold flex items-center gap-2.5 shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Candidat externe &bull; Pièces d’identité à vérifier</span>
          </div>
        )}

        {/* Bandeau de notification en cas de désactivation du directeur et réaffectation du dossier */}
        {candidature.reaffecte_depuis_nom && candidature.reaffecte_vers_nom && (
          <div className="p-4 rounded-[6px] bg-amber-50 border border-amber-300 shadow-2xs flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <strong className="block font-bold text-amber-900">
                Notification de réaffectation de votre dossier :
              </strong>
              <p className="text-amber-800 leading-relaxed font-medium">
                Le compte de <strong>{candidature.reaffecte_depuis_nom}</strong> ayant été désactivé par l'administration, le suivi et l'instruction de votre dossier en attente ont été automatiquement réaffectés à <strong>{candidature.reaffecte_vers_nom}</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Bandeau de félicitations pour les candidats admis */}
        {isDossierAdmis && (
          <div className="p-4 sm:p-5 rounded-[6px] bg-emerald-50 border border-emerald-300 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[#16a34a] font-bold text-sm">
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Félicitations, vous êtes Admis(e) au Cycle Doctoral !</span>
              </div>
              <p className="text-xs text-emerald-950 font-medium">
                Votre dossier a été validé définitivement. Votre <strong>Fiche d'Inscription D1</strong> est déverrouillée ci-dessous. Veuillez la télécharger pour la signer et la remettre au CEDoc.
              </p>
            </div>
            <button
              type="button"
              onClick={handleTelechargerFicheD1}
              disabled={telechargeantDoc === 'ficheD1'}
              className="px-4 py-2.5 bg-[#0f766e] hover:bg-[#115e59] text-white rounded-[6px] font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-2xs shrink-0"
              title="Télécharger la fiche D1 officielle au format PDF imprimable"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{telechargeantDoc === 'ficheD1' ? 'Génération...' : 'Télécharger la Fiche D1 (PDF)'}</span>
            </button>
          </div>
        )}

        {/* Progression des 6 pièces obligatoires */}
        <div className="bg-slate-50 p-4 rounded-[6px] border border-slate-200 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <FileCheck2 className="w-4 h-4 text-[#0f766e]" />
              Complétude des pièces justificatives obligatoires :
            </span>
            <span className="font-mono font-bold text-slate-800">
              {nbPiecesFournies} / {totalObligatoires} pièces déposées
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${nbPiecesFournies === totalObligatoires ? 'bg-[#16a34a]' : 'bg-[#0f766e]'}`}
              style={{ width: `${(nbPiecesFournies / totalObligatoires) * 100}%` }}
            />
          </div>
          {nbPiecesFournies < totalObligatoires && (
            <p className="text-[11px] text-slate-500">
              Les 6 pièces obligatoires au format PDF sont indispensables pour autoriser la soumission définitive.
            </p>
          )}
        </div>
      </div>

      {/* Onglets de Navigation Intérieure Aérés */}
      <div className="flex flex-wrap border-b border-slate-200 gap-6 sm:gap-8 text-sm font-bold text-slate-500">
        {(candidature.statut === 'BROUILLON' || !aAuMoinsUnSujet) && (
          <button
            type="button"
            onClick={() => handleSetTab('CHOIX_SUJETS')}
            className={`pb-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              currentTab === 'CHOIX_SUJETS'
                ? 'border-[#0f766e] text-[#0f766e] font-extrabold'
                : 'border-transparent hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Choix des sujets ({nbSujets}/3)</span>
          </button>
        )}

        <button
          type="button"
          disabled={!aAuMoinsUnSujet}
          onClick={() => handleSetTab('SYNTHESE')}
          title={!aAuMoinsUnSujet ? "Veuillez choisir au moins 1 sujet pour accéder à cet onglet" : "Synthèse & Sujets"}
          className={`pb-4 border-b-2 transition-all flex items-center gap-2 ${
            !aAuMoinsUnSujet
              ? 'border-transparent text-slate-400 cursor-not-allowed opacity-70'
              : currentTab === 'SYNTHESE'
                ? 'border-[#0f766e] text-[#0f766e] font-extrabold cursor-pointer'
                : 'border-transparent hover:text-slate-800 cursor-pointer'
          }`}
        >
          {!aAuMoinsUnSujet ? <Lock className="w-3.5 h-3.5 text-slate-400" /> : <User className="w-4 h-4" />}
          <span>Synthèse &amp; Sujets ({candidature.choix_sujets.length})</span>
        </button>

        <button
          type="button"
          disabled={!aAuMoinsUnSujet}
          onClick={() => handleSetTab('PIECES')}
          title={!aAuMoinsUnSujet ? "Veuillez choisir au moins 1 sujet pour accéder à cet onglet" : "Pièces justificatives"}
          className={`pb-4 border-b-2 transition-all flex items-center gap-2 ${
            !aAuMoinsUnSujet
              ? 'border-transparent text-slate-400 cursor-not-allowed opacity-70'
              : currentTab === 'PIECES'
                ? 'border-[#0f766e] text-[#0f766e] font-extrabold cursor-pointer'
                : 'border-transparent hover:text-slate-800 cursor-pointer'
          }`}
        >
          {!aAuMoinsUnSujet ? <Lock className="w-3.5 h-3.5 text-slate-400" /> : <FileText className="w-4 h-4" />}
          <span>Pièces justificatives ({nbPiecesFournies}/{totalObligatoires})</span>
        </button>

        <button
          type="button"
          disabled={!aAuMoinsUnSujet}
          onClick={() => handleSetTab('DOCS_GENERES')}
          title={!aAuMoinsUnSujet ? "Veuillez choisir au moins 1 sujet pour accéder à cet onglet" : "Formulaires & Récépissé"}
          className={`pb-4 border-b-2 transition-all flex items-center gap-2 ${
            !aAuMoinsUnSujet
              ? 'border-transparent text-slate-400 cursor-not-allowed opacity-70'
              : currentTab === 'DOCS_GENERES'
                ? 'border-[#0f766e] text-[#0f766e] font-extrabold cursor-pointer'
                : 'border-transparent hover:text-slate-800 cursor-pointer'
          }`}
        >
          {!aAuMoinsUnSujet ? <Lock className="w-3.5 h-3.5 text-slate-400" /> : <Download className="w-4 h-4" />}
          <span>Formulaires &amp; Récépissé</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* ONGLET 0 : CHOIX DES SUJETS (OBLIGATOIRE SI AUCUN SUJET CHOISI)      */}
      {/* ==================================================================== */}
      {currentTab === 'CHOIX_SUJETS' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {!aAuMoinsUnSujet ? (
            <div className="p-4 sm:p-5 rounded-[6px] bg-amber-50 border border-amber-300 shadow-2xs flex items-start gap-3">
              <Lock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <strong className="block font-bold text-amber-950 text-sm">
                  Première connexion — Choix des sujets obligatoire :
                </strong>
                <p className="text-amber-900 leading-relaxed font-medium">
                  Vous n’avez encore sélectionné aucun sujet de thèse. Veuillez choisir <strong>au moins 1 sujet</strong> (maximum 3) ci-dessous pour débloquer l’accès aux autres onglets de votre espace candidat (<em>Synthèse &amp; Sujets</em>, <em>Pièces justificatives</em>, <em>Formulaires &amp; Récépissé</em>).
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 sm:p-5 rounded-[6px] bg-emerald-50 border border-emerald-300 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-[#16a34a] text-sm">
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>
                    {nbSujets} sujet{nbSujets > 1 ? 's' : ''} de thèse choisi{nbSujets > 1 ? 's' : ''} — Les autres onglets de votre espace sont déverrouillés
                  </span>
                </div>
                <p className="text-emerald-950 font-medium">
                  Vous pouvez ajuster vos choix (1 à 3 sujets ordonnés) ou poursuivre vers la synthèse et le dépôt de vos pièces justificatives.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  handleSetTab('SYNTHESE');
                  if (onValiderChoixSujets) onValiderChoixSujets();
                }}
                className="px-4 py-2.5 bg-[#0f766e] hover:bg-[#115e59] text-white rounded-[6px] font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-2xs shrink-0"
              >
                <span>Continuer vers mon dossier</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <CatalogueView
            sujets={sujetsCatalogue}
            panierSujets={candidature.choix_sujets.map(cs => cs.sujet)}
            onAjouterAuPanier={(sujet) => {
              if (onAjouterSujetDossier) onAjouterSujetDossier(sujet);
            }}
            onRetirerDuPanier={(id) => {
              if (onRetirerSujetDossier) onRetirerSujetDossier(id);
            }}
            onDeplacerPriorite={(idx, dir) => {
              if (onDeplacerPrioriteDossier) onDeplacerPrioriteDossier(idx, dir);
            }}
            onSelectDetail={(sujet) => {
              if (onSelectDetailSujet) onSelectDetailSujet(sujet);
            }}
            onValiderSelection={() => {
              handleSetTab('SYNTHESE');
              if (onValiderChoixSujets) onValiderChoixSujets();
            }}
          />
        </div>
      )}

      {/* ==================================================================== */}
      {/* ONGLET 1 : SYNTHÈSE DU DOSSIER                                       */}
      {/* ==================================================================== */}
      {currentTab === 'SYNTHESE' && aAuMoinsUnSujet && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          <div className="lg:col-span-2 space-y-6">
            {/* Sujets de Thèse Retenus */}
            <div className="bg-white p-6 sm:p-8 rounded-[6px] border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-base font-extrabold text-slate-900 font-serif">
                  Sujets de Thèse Postulés (Ordre de Priorité)
                </h2>
                <div className="flex items-center gap-2">
                  {candidature.statut === 'BROUILLON' && (
                    <button
                      type="button"
                      onClick={() => handleSetTab('CHOIX_SUJETS')}
                      className="text-xs font-bold text-[#0f766e] hover:underline cursor-pointer"
                    >
                      Modifier mes sujets
                    </button>
                  )}
                  <span className="text-xs font-bold text-[#0f766e] bg-[#f0fdfa] px-3 py-1 rounded-[4px] border border-[#ccfbf1]">
                    {candidature.choix_sujets.length} choix
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {candidature.choix_sujets.map((cs) => (
                  <div key={cs.sujet.id} className="p-4 rounded-[6px] bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-[4px] bg-[#0f766e] text-white font-bold text-xs">
                        Priorité {cs.priorite}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">{cs.sujet.theme}</span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm font-serif leading-snug">{cs.sujet.titre}</h3>
                    <p className="text-xs text-slate-600 line-clamp-2">{cs.sujet.description}</p>
                    <div className="pt-2 text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-200/60">
                      <span>Encadrant : <strong className="text-slate-800">{cs.sujet.propose_par}</strong></span>
                      <span>Laboratoire : <strong className="text-slate-800">{cs.sujet.structure}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* État d'avancement des pièces */}
            <div className="bg-white p-6 rounded-[6px] border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 font-serif border-b pb-2">
                Check-list des 6 Pièces Exigées
              </h3>
              <ul className="space-y-2 text-xs">
                {PIECES_OBLIGATOIRES.map((type, idx) => {
                  const doc = mapPiecesDeposees.get(type);
                  const isDepose = !!doc;
                  const controleStatut = doc?.controle_conformite?.statut;
                  const avantSoumissionSynthese =
                    candidature.statut === 'BROUILLON' || candidature.statut === 'CORRECTION_DEMANDEE';
                  return (
                    <li key={idx} className="flex items-center justify-between p-2 rounded-[4px] bg-slate-50 border border-slate-200/80">
                      <span className="text-slate-800 font-medium truncate pr-2">
                        {idx + 1}. {type}
                      </span>
                      {isDepose ? (
                        bypassControle ? (
                          avantSoumissionSynthese ? (
                            <span className="text-[#16a34a] font-bold shrink-0 flex items-center gap-1 text-[11px]">
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Fournie
                            </span>
                          ) : doc?.statut_verification === 'VALIDE' ? (
                            <span className="text-[#16a34a] font-bold shrink-0 flex items-center gap-1 text-[11px]">
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Validée
                            </span>
                          ) : doc?.statut_verification === 'REJETE' ? (
                            <span className="text-rose-700 font-bold shrink-0 flex items-center gap-1 text-[11px]">
                              <AlertCircle className="w-3.5 h-3.5" /> Rejetée
                            </span>
                          ) : (
                            <span className="text-amber-800 font-bold shrink-0 flex items-center gap-1 text-[11px]">
                              <Clock className="w-3.5 h-3.5" /> En attente de contrôle
                            </span>
                          )
                        ) : controleStatut === 'CONFORME' ? (
                          <span className="text-[#16a34a] font-bold shrink-0 flex items-center gap-1 text-[11px]">
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Conforme
                          </span>
                        ) : controleStatut === 'A_CORRIGER' ? (
                          <span className="text-rose-700 font-bold shrink-0 flex items-center gap-1 text-[11px]">
                            <AlertCircle className="w-3.5 h-3.5" /> À corriger
                          </span>
                        ) : controleStatut === 'A_VERIFIER' ? (
                          <span className="text-amber-700 font-bold shrink-0 flex items-center gap-1 text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5" /> À vérifier
                          </span>
                        ) : (
                          <span className="text-slate-600 font-bold shrink-0 flex items-center gap-1 text-[11px]">
                            <Clock className="w-3.5 h-3.5" /> À vérifier
                          </span>
                        )
                      ) : (
                        <span className="text-amber-700 font-bold shrink-0 text-[11px]">
                          À déposer
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>

              <button
                onClick={() => handleSetTab('PIECES')}
                className="w-full py-2.5 bg-[#0f766e] hover:bg-[#115e59] text-white rounded-[6px] text-xs font-bold transition shadow-xs cursor-pointer text-center block"
              >
                Gérer mes 6 pièces justificatives &rarr;
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ==================================================================== */}
      {/* CONTENU ONGLET 2 : GESTION DES 6 PIÈCES JUSTIFICATIVES OBLIGATOIRES  */}
      {/* ==================================================================== */}
      {currentTab === 'PIECES' && aAuMoinsUnSujet && (
        <div className="space-y-6">
          <div className="bg-white p-6 sm:p-8 rounded-[6px] border border-slate-200 shadow-xs space-y-2">
            <h2 className="text-lg font-bold text-slate-900 font-serif">
              Les 6 Pièces Justificatives Obligatoires (Format PDF uniquement)
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
              Chaque pièce dispose de son propre champ de téléversement ci-dessous. Le système vérifie automatiquement le format réel du fichier (PDF, max {campagne?.taille_max_fichier_mo || 5} Mo) ainsi que la conformité du contenu avec le type de pièce attendu (lecture texte et reconnaissance visuelle pour les documents scannés).
            </p>
          </div>

          {/* Grille des 6 pièces avec leur propre champ de téléversement */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PIECES_OBLIGATOIRES.map((pieceType, idx) => {
              const doc = mapPiecesDeposees.get(pieceType);
              const isDepose = !!doc && doc.statut_verification !== 'NON_DEPOSE';
              const isCin = pieceType === "Carte d'identité nationale (CIN)";
              const erreurUpload = uploadErrors[pieceType];
              const enTraitement = isProcessingUpload[pieceType];
              const avantSoumission =
                candidature.statut === 'BROUILLON' || candidature.statut === 'CORRECTION_DEMANDEE';
              const controle = bypassControle ? undefined : doc?.controle_conformite;
              const effectiveControleStatut = erreurUpload
                ? 'A_CORRIGER'
                : controle?.statut;

              return (
                <div 
                  key={pieceType} 
                  className={`bg-white rounded-[6px] border p-5 flex flex-col justify-between space-y-4 shadow-2xs transition-all ${
                    doc?.statut_verification === 'VALIDE'
                      ? 'border-emerald-300'
                      : doc?.statut_verification === 'REJETE' || effectiveControleStatut === 'A_CORRIGER'
                        ? 'border-rose-300 bg-rose-50/20'
                        : effectiveControleStatut === 'A_VERIFIER'
                          ? 'border-amber-300 bg-amber-50/15'
                          : effectiveControleStatut === 'CONFORME' || (bypassControle && avantSoumission && isDepose)
                            ? 'border-emerald-300 bg-emerald-50/10'
                            : isDepose
                              ? 'border-teal-200 bg-teal-50/15'
                              : 'border-slate-200'
                  }`}
                >
                  {/* Input file caché déclenché pour cette pièce uniquement */}
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    ref={(el) => { fileInputRefs.current[pieceType] = el; }}
                    onChange={(e) => handleFichierSelectionne(pieceType, e)}
                    className="hidden"
                  />

                  <div className="space-y-3">
                    {/* En-tête de la carte */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[#0f766e] text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 font-serif leading-snug">
                            {isCin ? 'Carte nationale (CNIE)' : pieceType}
                          </h3>
                          <span className="text-[10px] text-slate-400 font-medium">Document obligatoire &bull; PDF</span>
                        </div>
                      </div>

                      {/* Statut de la pièce : avant soumission -> résultat du contrôle (Conforme / À corriger / À vérifier) remplace « Fournie » */}
                      <div className="flex flex-col items-end gap-1">
                        {enTraitement ? (
                          <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 inline-flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>Analyse...</span>
                          </span>
                        ) : !isDepose && !erreurUpload ? (
                          <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
                            Non déposé
                          </span>
                        ) : avantSoumission ? (
                          doc?.statut_verification === 'VALIDE' ? (
                            <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-emerald-50 text-[#16a34a] border border-[#16a34a]/30 inline-flex items-center gap-1">
                              <Check className="w-3 h-3 text-[#16a34a] stroke-[2.5]" />
                              <span>Validé</span>
                            </span>
                          ) : doc?.statut_verification === 'REJETE' ? (
                            <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-300 inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              <span>Rejeté</span>
                            </span>
                          ) : bypassControle ? (
                            <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-emerald-50 text-[#16a34a] border border-[#16a34a]/30 inline-flex items-center gap-1">
                              <Check className="w-3 h-3 text-[#16a34a] stroke-[2.5]" />
                              <span>Fournie</span>
                            </span>
                          ) : effectiveControleStatut === 'CONFORME' ? (
                            <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-emerald-50 text-[#16a34a] border border-[#16a34a]/30 inline-flex items-center gap-1">
                              <Check className="w-3 h-3 text-[#16a34a] stroke-[2.5]" />
                              <span>Conforme</span>
                            </span>
                          ) : effectiveControleStatut === 'A_CORRIGER' ? (
                            <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-300 inline-flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              <span>À corriger</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>À vérifier</span>
                            </span>
                          )
                        ) : (
                          <>
                            {doc?.statut_verification === 'EN_ATTENTE' && (
                              <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                                En attente de contrôle
                              </span>
                            )}
                            {doc?.statut_verification === 'VALIDE' && (
                              <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-emerald-50 text-[#16a34a] border border-[#16a34a]/30 inline-flex items-center gap-1">
                                <Check className="w-3 h-3 text-[#16a34a] stroke-[2.5]" />
                                <span>Validé</span>
                              </span>
                            )}
                            {doc?.statut_verification === 'REJETE' && (
                              <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-300 inline-flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                <span>Rejeté</span>
                              </span>
                            )}
                            {controle?.statut === 'CONFORME' && (
                              <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-semibold bg-emerald-50/70 text-[#16a34a] border border-emerald-200">
                                Contrôle : Conforme
                              </span>
                            )}
                            {controle?.statut === 'A_VERIFIER' && (
                              <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-semibold bg-amber-50/70 text-amber-800 border border-amber-200">
                                Contrôle : À vérifier
                              </span>
                            )}
                            {controle?.statut === 'A_CORRIGER' && (
                              <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-semibold bg-rose-50/70 text-rose-700 border border-rose-200">
                                Contrôle : À corriger
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Indication obligatoire spécifique pour la CIN */}
                    {isCin && (
                      <div className="p-2.5 rounded-[4px] bg-[#f0fdfa] border border-[#ccfbf1] text-[11px] text-slate-700 space-y-1">
                        <div className="font-bold text-[#0f766e] flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5" />
                          Consigne impérative CIN &amp; Confidentialité :
                        </div>
                        <p className="leading-relaxed">
                          « Veuillez regrouper les deux faces de votre CIN (recto et verso) dans un seul fichier PDF, avec le recto en première page et le verso en deuxième page. »
                        </p>
                        <p className="text-[10px] text-teal-800 font-semibold pt-0.5">
                          Confidentialité : L&apos;image n&apos;est visible que par le candidat et le personnel autorisé du CEDoc, et n&apos;est utilisée pour aucun autre usage.
                        </p>
                      </div>
                    )}

                    {/* Détails du document si téléversé */}
                    {isDepose && doc && (
                      <div className="bg-slate-50 p-3 rounded-[4px] border border-slate-200 text-xs space-y-1 font-sans">
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="font-semibold truncate max-w-[220px]" title={doc.nom_fichier}>
                            {doc.nom_fichier}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            {formatTailleFichier(doc.taille_octets, doc.taille_mo)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>Téléversé le {formatDateJJMMAAAA(doc.date_depot)}</span>
                          {doc.page_count !== undefined && (
                            <span className="font-semibold text-[#0f766e]">
                              {doc.page_count} page{doc.page_count > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Données d'identité saisies et validées via le formulaire de scan CNIE */}
                    {isCin && (candidature.donnees_scan_cnie || dernierScanCnieData) && (() => {
                      const scanFields = candidature.donnees_scan_cnie || dernierScanCnieData!.fields;
                      return (
                        <div className="p-3 rounded-[4px] bg-white border border-slate-200 text-[11px] space-y-2">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                            <span className="font-bold text-slate-800">
                              Données déclarées et validées (CNIE) :
                            </span>
                            {dernierScanCnieData && (
                              <span className="text-[10px] font-mono font-bold text-[#0f766e]">
                                {dernierScanCnieData.engine === 'GEMINI'
                                  ? 'Gemini JSON'
                                  : dernierScanCnieData.engine === 'TESSERACT_FALLBACK'
                                    ? 'Tesseract.js (fra+ara)'
                                    : 'Saisie manuelle'}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {(
                              [
                                { label: 'Nom', val: scanFields.nom },
                                { label: 'Prénom', val: scanFields.prenom },
                                { label: 'N° CNIE', val: scanFields.cin },
                                { label: 'Naissance', val: scanFields.date_naissance },
                                { label: 'Lieu', val: scanFields.lieu_naissance },
                                { label: 'Validité', val: scanFields.date_validite },
                                { label: 'Adresse', val: scanFields.adresse }
                              ] as const
                            ).map((item) => (
                              <div
                                key={item.label}
                                className={`${item.label === 'Adresse' ? 'col-span-2' : ''} px-2 py-1 rounded-[3px] border ${
                                  item.val
                                    ? 'bg-emerald-50/40 border-emerald-200 text-slate-800'
                                    : 'bg-amber-50 border-amber-400 text-amber-900 font-semibold'
                                }`}
                              >
                                <span className="text-[10px] text-slate-500 block">{item.label}</span>
                                <span className="font-bold">
                                  {item.val || 'Vide (illisible / invalide)'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Motif de rejet en rouge si la pièce a été rejetée */}
                    {doc?.statut_verification === 'REJETE' && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-[4px] text-xs text-rose-900 space-y-1 animate-in fade-in">
                        <span className="font-bold flex items-center gap-1.5 text-rose-700">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          Commentaire de rejet :
                        </span>
                        <p className="text-[11px] leading-relaxed font-semibold text-rose-950">
                          {doc.motif_rejet || "Document non conforme aux exigences requises. Veuillez téléverser un nouveau fichier."}
                        </p>
                      </div>
                    )}

                    {/* Motif « À corriger » (rouge) issu du contrôle automatique (sur tentative d'upload ou pièce déposée) */}
                    {(erreurUpload || (controle?.statut === 'A_CORRIGER' && controle.motif)) && (
                      <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-[4px] text-xs text-rose-700 font-semibold flex items-start gap-1.5 animate-in fade-in">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <span>{erreurUpload || controle?.motif}</span>
                      </div>
                    )}

                    {/* Motif « À vérifier » (orange) en cas de doute (scan illisible, type incertain) */}
                    {!erreurUpload && controle?.statut === 'A_VERIFIER' && controle.motif && (
                      <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-[4px] text-xs text-amber-900 font-semibold flex items-start gap-1.5 animate-in fade-in">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>{controle.motif}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions réelles sur la pièce */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    {isDepose && doc ? (
                      <div className="flex flex-wrap items-center justify-between w-full gap-2">
                        {/* Bouton Voir */}
                        <button
                          type="button"
                          onClick={() => handleVoirDocument(doc)}
                          className="px-3 py-1.5 bg-[#0f766e] hover:bg-[#115e59] text-white rounded-[4px] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                          title="Voir le véritable PDF"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Voir</span>
                        </button>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* POINT 7 : Après confirmation, elle apparaît comme pièce justificative fournie, avec un bouton « Rescanner » */}
                          {isCin && (
                            <button
                              type="button"
                              onClick={() => setScanCnieModalOpen(true)}
                              className="px-3 py-1.5 bg-white border border-[#0f766e] text-[#0f766e] hover:bg-[#f0fdfa] rounded-[4px] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                              title="Rescanner ma carte nationale (CNIE)"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span>Rescanner</span>
                            </button>
                          )}

                          {/* Bouton Remplacer */}
                          <button
                            type="button"
                            disabled={enTraitement}
                            onClick={() => declencherSelecteurFichier(pieceType)}
                            className="px-3 py-1.5 bg-white border border-slate-300 hover:border-[#0f766e] hover:text-[#0f766e] text-slate-700 rounded-[4px] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50"
                            title="Téléverser une nouvelle version du PDF"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${enTraitement ? 'animate-spin' : ''}`} />
                            <span>Remplacer</span>
                          </button>

                          {/* Bouton Retirer */}
                          <button
                            type="button"
                            onClick={() => handleRetirerPiece(pieceType, doc)}
                            className="px-2.5 py-1.5 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-[4px] text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                            title="Retirer cette pièce du dossier"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Retirer</span>
                          </button>
                        </div>
                      </div>
                    ) : isCin ? (
                      /* Actions pour Carte nationale (CNIE) : Import de fichier + Bouton « Scanner ma carte nationale » côte à côte */
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                        <button
                          type="button"
                          disabled={enTraitement}
                          onClick={() => declencherSelecteurFichier(pieceType)}
                          className="w-full py-2.5 px-3 bg-[#0f766e] hover:bg-[#115e59] text-white rounded-[4px] text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50"
                        >
                          <UploadCloud className={`w-4 h-4 shrink-0 ${enTraitement ? 'animate-bounce' : ''}`} />
                          <span>{enTraitement ? 'Analyse...' : 'Importer un PDF'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setScanCnieModalOpen(true)}
                          className="w-full py-2.5 px-3 bg-white hover:bg-[#f0fdfa] text-[#0f766e] border border-[#0f766e] rounded-[4px] text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                        >
                          <Camera className="w-4 h-4 shrink-0" />
                          <span>Scanner ma carte nationale</span>
                        </button>
                      </div>
                    ) : (
                      /* Champ de téléversement pour les autres pièces non déposées */
                      <button
                        type="button"
                        disabled={enTraitement}
                        onClick={() => declencherSelecteurFichier(pieceType)}
                        className="w-full py-2.5 px-3 bg-[#0f766e] hover:bg-[#115e59] text-white rounded-[4px] text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs disabled:opacity-50"
                      >
                        <UploadCloud className={`w-4 h-4 ${enTraitement ? 'animate-bounce' : ''}`} />
                        <span>{enTraitement ? 'Analyse du fichier...' : 'Téléverser le PDF'}</span>
                      </button>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* CONTENU ONGLET 3 : FORMULAIRES & RÉCÉPISSÉ PDF                         */}
      {/* ==================================================================== */}
      {currentTab === 'DOCS_GENERES' && aAuMoinsUnSujet && (
        <div className="bg-white p-6 sm:p-8 rounded-[6px] border border-slate-200 shadow-xs space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 font-serif">Formulaires Administratifs &amp; Documents Officiels</h2>
            <p className="text-xs text-slate-500">
              Chaque carte ouvre son propre document conforme aux normes du CEDoc USMBA.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            
            {/* CARTE 1 : FICHE D'INSCRIPTION D1 (VERROUILLÉE TANT QUE LE DOSSIER N'EST PAS VALIDÉ DÉFINITIVEMENT) */}
            <div className={`p-5 rounded-[6px] border flex flex-col justify-between space-y-4 transition ${
              !isDossierAdmis
                ? 'border-slate-200 bg-slate-100/70 opacity-90'
                : 'border-emerald-300 bg-emerald-50/20 shadow-xs'
            }`}>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {isDossierAdmis ? (
                      <FileText className="w-5 h-5 text-[#0f766e]" />
                    ) : (
                      <Lock className="w-5 h-5 text-slate-400" />
                    )}
                    <span className="text-[10px] font-mono font-bold text-slate-400">FORM-F1</span>
                  </div>
                  {!isDossierAdmis ? (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-[4px] border border-amber-200">
                      Disponible après admission
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-emerald-100 text-[#16a34a] border border-[#16a34a]/30 inline-flex items-center gap-1">
                      <Check className="w-2.5 h-2.5 stroke-[2.5]" /> Déverrouillée · Admis
                    </span>
                  )}
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm font-serif">Fiche d'Inscription D1</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {!isDossierAdmis
                    ? "Accessible et téléchargeable en version officielle imprimable uniquement après validation définitive du dossier (Admission)."
                    : "Dossier validé définitivement ! Votre fiche d'inscription officielle D1 est prête à être téléchargée au format PDF imprimable pour signature."}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200/80 space-y-2">
                {!isDossierAdmis ? (
                  <div className="space-y-1.5 text-center">
                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 px-3 bg-slate-200 text-slate-400 rounded-[6px] text-xs font-bold flex items-center justify-center gap-2 cursor-not-allowed"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Disponible après admission</span>
                    </button>
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-[4px] inline-block border border-amber-200">
                      Disponible après admission
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleTelechargerFicheD1}
                      disabled={telechargeantDoc === 'ficheD1'}
                      className="w-full py-2.5 px-3 bg-[#0f766e] hover:bg-[#115e59] text-white rounded-[6px] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-2xs transition"
                      title="Télécharger la fiche D1 officielle au format PDF imprimable"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{telechargeantDoc === 'ficheD1' ? 'Génération du PDF...' : 'Télécharger la Fiche D1 (PDF)'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onPreviewDoc("Fiche d'Inscription D1", "FORM-F1")}
                      className="w-full py-2 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-[6px] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-2xs transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Consulter la fiche D1</span>
                    </button>
                  </div>
                )}
                <span className="text-[10px] text-slate-500 block text-center font-medium">
                  {isDossierAdmis ? "PDF imprimable · Signature manuscrite requise" : "Déverrouillage automatique dès admission"}
                </span>
              </div>
            </div>

            {/* CARTE 2 : CHARTE DES THÈSES */}
            <div className="p-5 rounded-[6px] border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FileText className="w-5 h-5 text-[#0f766e]" />
                  <span className="text-[10px] font-mono font-bold text-slate-400">CHARTE-D</span>
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm font-serif">Charte des Thèses de l'USMBA</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Droits et engagements réciproques du doctorant, du laboratoire et de l'encadrant, sans données personnelles, avec zones de signature.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200/80 space-y-2">
                {/* BOUTON DEMANDÉ : TÉLÉCHARGER LA CHARTE DES THÈSES EN PDF */}
                <button
                  type="button"
                  onClick={handleTelechargerCharte}
                  disabled={telechargeantDoc === 'charte'}
                  className="w-full py-2.5 px-3 bg-[#0f766e] hover:bg-[#115e59] text-white rounded-[6px] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-2xs transition"
                  title="Télécharger la Charte des thèses au format PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{telechargeantDoc === 'charte' ? 'Téléchargement...' : 'Télécharger la Charte des thèses (PDF)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onPreviewDoc("Charte des Thèses de l'USMBA", "CHARTE-D")}
                  className="w-full py-2 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-[6px] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-2xs transition"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Consulter la charte</span>
                </button>

                <span className="text-[10px] text-slate-500 block text-center font-medium">
                  Réglementation déontologique &bull; Document officiel
                </span>
              </div>
            </div>

            {/* CARTE 3 : RÉCÉPISSÉ DE DÉPÔT (Grisé si non soumis avec mention obligatoire) */}
            <div className={`p-5 rounded-[6px] border flex flex-col justify-between space-y-4 transition ${
              candidature.statut === 'BROUILLON'
                ? 'border-slate-200 bg-slate-100/70 opacity-90'
                : 'border-slate-200 bg-slate-50/50'
            }`}>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FileText className={`w-5 h-5 ${candidature.statut === 'BROUILLON' ? 'text-slate-400' : 'text-[#0f766e]'}`} />
                  <span className="text-[10px] font-mono font-bold text-slate-400">REC-2026</span>
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm font-serif">Récépissé de Dépôt de Candidature</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Référence unique, date et heure de soumission et QR code simulé.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200/80 space-y-2">
                {candidature.statut === 'BROUILLON' ? (
                  <div className="space-y-1.5 text-center">
                    <button
                      type="button"
                      disabled
                      className="w-full py-2 px-3 bg-slate-200 text-slate-400 rounded-[6px] text-xs font-bold flex items-center justify-center gap-2 cursor-not-allowed"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Disponible après soumission</span>
                    </button>
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-[4px] inline-block border border-amber-200">
                      Disponible après soumission
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleTelechargerRecepisse}
                      disabled={telechargeantDoc === 'recepisse'}
                      className="w-full py-2.5 px-3 bg-[#0f766e] hover:bg-[#115e59] text-white rounded-[6px] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-2xs transition"
                      title="Télécharger le récépissé officiel au format PDF imprimable"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{telechargeantDoc === 'recepisse' ? 'Génération du PDF...' : 'Télécharger le récépissé (PDF)'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onPreviewDoc("Récépissé de Dépôt de Candidature", "REC-2026")}
                      className="w-full py-2 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-[6px] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-2xs transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Consulter le récépissé officiel</span>
                    </button>
                  </div>
                )}
                <span className="text-[10px] text-slate-400 block text-center font-mono">
                  {candidature.statut === 'BROUILLON' ? 'Date de dépôt : Non déposé' : 'Horodatage certifié'}
                </span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Modal de confirmation de retrait d'une pièce */}
      {pieceARetirer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[6px] max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900 font-serif">
                  Retirer cette pièce justificative ?
                </h3>
                <p className="text-xs text-slate-500">
                  Confirmation de retrait du dossier
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 rounded-[6px] border border-rose-200 text-xs text-rose-900 space-y-1">
              <span className="font-bold block">Document concerné :</span>
              <p className="font-serif font-bold text-slate-900 text-sm">{pieceARetirer.pieceType}</p>
              <p className="text-[11px] text-rose-700 mt-1">
                La pièce sera immédiatement retirée de votre candidature et son statut repassera sur <strong>« Non déposé »</strong>. Vous pourrez téléverser un nouveau fichier PDF conforme à tout moment.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPieceARetirer(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[6px] text-xs font-bold cursor-pointer transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  onSupprimerDocument(candidature.id, pieceARetirer.docId, pieceARetirer.pieceType);
                  setUploadErrors(prev => ({ ...prev, [pieceARetirer.pieceType]: '' }));
                  setPieceARetirer(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-[6px] text-xs font-bold cursor-pointer transition shadow-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirmer le retrait</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visualiseur de PDF Réel Intégré */}
      {visualiseurDoc && (
        <ModalVisualiseurPdf
          isOpen={true}
          docTitle={visualiseurDoc.docTitle}
          fileName={visualiseurDoc.fileName}
          pdfUrl={visualiseurDoc.pdfUrl}
          pageCount={visualiseurDoc.pageCount}
          statut={visualiseurDoc.statut}
          motifRejet={visualiseurDoc.motifRejet}
          candidatNom={`${candidature.candidat_nom} ${candidature.candidat_prenom}`}
          cin={candidature.candidat_cin}
          onClose={() => setVisualiseurDoc(null)}
        />
      )}

      {/* Modal de Scan de la Carte Nationale (CNIE) : montée UNIQUEMENT dans l'étape « Pièces justificatives » et uniquement après clic sur « Scanner ma carte nationale » */}
      {currentTab === 'PIECES' && aAuMoinsUnSujet && scanCnieModalOpen && (
        <ModalScanCNIE
          isOpen={scanCnieModalOpen}
          accountNom={accountNom}
          accountPrenom={accountPrenom}
          initialFields={candidature.donnees_scan_cnie || dernierScanCnieData?.fields}
          onClose={() => setScanCnieModalOpen(false)}
          onScanComplete={handleScanCnieComplete}
        />
      )}

    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  User, 
  Calendar, 
  UserCheck, 
  AlertTriangle, 
  Plus, 
  X, 
  CheckCircle2, 
  FileText,
  Lock,
  Unlock,
  Eye,
  Check,
  AlertCircle,
  Edit,
  Info,
  BookOpen,
  Layers
} from 'lucide-react';
import { Candidature, SujetThese, StatutCandidature, UserAccount, DocumentCandidat, StatutDocument, PIECES_OBLIGATOIRES } from '../types';
import { formatDateJJMMAAAA } from '../utils/dateUtils';
import { ModalVisualiseurPdf } from './ModalVisualiseurPdf';
import { generateSamplePdf, formatTailleFichier } from '../utils/pdfUtils';

// Les 5 pièces académiques examinées par le directeur de thèse (la CIN relève exclusivement de la scolarité)
const PIECES_ACADEMIQUES = PIECES_OBLIGATOIRES.filter(
  (p) => p !== "Carte d'identité nationale (CIN)"
);

interface EncadrantViewProps {
  currentUser?: UserAccount | null;
  sujets: SujetThese[];
  candidatures: Candidature[];
  onUpdateStatut: (id: string, statut: StatutCandidature, extra?: Partial<Candidature>) => void;
  onUpdateDocumentStatut?: (candId: string, docId: string, statutVerif: StatutDocument, motifRejet?: string) => void;
  onAjouterSujet: (sujet: SujetThese) => void;
  onModifierSujet?: (sujet: SujetThese) => void;
  onPreviewDoc?: (titre: string, code: string, candidature: Candidature) => void;
}

export const EncadrantView: React.FC<EncadrantViewProps> = ({
  currentUser,
  sujets,
  candidatures,
  onUpdateStatut,
  onUpdateDocumentStatut,
  onAjouterSujet,
  onModifierSujet,
  onPreviewDoc
}) => {
  const [tab, setTab] = useState<'CANDIDATURES' | 'MES_SUJETS'>('CANDIDATURES');
  const [candidatureEnExamen, setCandidatureEnExamen] = useState<Candidature | null>(null);

  // Formulaire d'évaluation Étape 1
  const [dateConvocation, setDateConvocation] = useState('');
  const [noteOral, setNoteOral] = useState<number | ''>('');
  const [resultatEtape1, setResultatEtape1] = useState<'LISTE_PRINCIPALE' | 'LISTE_ATTENTE' | 'REJETE'>('LISTE_PRINCIPALE');
  const [motifRefus, setMotifRefus] = useState('');
  const [motifCorrection, setMotifCorrection] = useState('');
  const [formError, setFormError] = useState('');

  // Modal de rejet d'une pièce avec motif obligatoire
  const [modalRejetPiece, setModalRejetPiece] = useState<{
    docId: string;
    docType: string;
  } | null>(null);
  const [motifRejetPiece, setMotifRejetPiece] = useState('');

  // Visualiseur de PDF pour l'encadrant
  const [visualiseurDoc, setVisualiseurDoc] = useState<{
    docTitle: string;
    fileName: string;
    pdfUrl?: string;
    pageCount?: number;
    statut?: string;
    motifRejet?: string;
    candidatNom?: string;
  } | null>(null);

  // Modals pour la gestion des sujets
  const [isNouveauOpen, setIsNouveauOpen] = useState(false);
  const [sujetEnConsultation, setSujetEnConsultation] = useState<SujetThese | null>(null);
  const [sujetEnModification, setSujetEnModification] = useState<SujetThese | null>(null);

  // Champs de proposition / modification
  const [formSujetTitre, setFormSujetTitre] = useState('');
  const [formSujetResume, setFormSujetResume] = useState('');
  const [formSujetTheme, setFormSujetTheme] = useState('');
  const [formSujetPlaces, setFormSujetPlaces] = useState(1);
  const [formSujetError, setFormSujetError] = useState('');

  // Nom de l'encadrant actuel pour le filtrage
  const encadrantNom = currentUser?.nom || 'EL AMRANI';
  const encadrantPrenom = currentUser?.prenom || 'Karim (Pr)';

  // 1. Filtrage strict : "Mes sujets de thèse" compte UNIQUEMENT les sujets de cet encadrant (y compris ceux réaffectés)
  const mesSujets = sujets.filter((s) => {
    if (currentUser?.id && s.encadrant_id) {
      return s.encadrant_id === currentUser.id;
    }
    return s.propose_par.toLowerCase().includes(encadrantNom.toLowerCase());
  });

  // 2. Filtrage strict des dossiers :
  // - Sujet prioritaire n°1 doit être le sien (ou lui avoir été réaffecté)
  // - Statut au moins "Soumise" (jamais les brouillons)
  const dossiersFiltres = candidatures.filter((c) => {
    if (c.statut === 'BROUILLON') return false;

    const p1Item = c.choix_sujets.find(cs => cs.priorite === 1) || c.choix_sujets[0];
    if (!p1Item?.sujet) return false;

    const s = p1Item.sujet;
    if (currentUser?.id && s.encadrant_id) {
      return s.encadrant_id === currentUser.id;
    }
    return s.propose_par.toLowerCase().includes(encadrantNom.toLowerCase());
  });

  // Badge du statut global du dossier
  const getStatutBadge = (statut: StatutCandidature) => {
    switch (statut) {
      case 'BROUILLON':
        return <span className="px-2.5 py-0.5 rounded-[6px] text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">Brouillon</span>;
      case 'SOUMISE':
        return <span className="px-2.5 py-0.5 rounded-[6px] text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-300">Soumise</span>;
      case 'EN_EXAMEN':
        return <span className="px-2.5 py-0.5 rounded-[6px] text-[10px] font-bold bg-[#f0fdfa] text-[#0f766e] border border-[#ccfbf1]">En examen</span>;
      case 'CORRECTION_DEMANDEE':
        return <span className="px-2.5 py-0.5 rounded-[6px] text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">À compléter</span>;
      case 'ACCEPTEE':
        return (
          <span className="px-2.5 py-0.5 rounded-[6px] text-[10px] font-bold bg-emerald-50 text-[#16a34a] border border-[#16a34a]/30 inline-flex items-center gap-1">
            <Check className="w-3 h-3 text-[#16a34a] stroke-[2.5]" />
            <span>Admis</span>
          </span>
        );
      case 'REFUSEE':
        return <span className="px-2.5 py-0.5 rounded-[6px] text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-300">Non retenue</span>;
    }
  };

  // Libellé et style du statut d'un sujet
  const getStatutSujetBadge = (sujet: SujetThese) => {
    if (sujet.statut === 'BROUILLON') {
      return (
        <span className="px-2.5 py-0.5 rounded-[4px] text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
          Brouillon
        </span>
      );
    }
    if (sujet.validation_structure === 'VALIDE' && sujet.statut === 'VALIDE') {
      return (
        <span className="px-2.5 py-0.5 rounded-[4px] text-[10px] font-bold bg-emerald-50 text-[#16a34a] border border-emerald-300 inline-flex items-center gap-1">
          <Check className="w-3 h-3 text-[#16a34a] stroke-[2.5]" />
          <span>Accrédité</span>
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-[4px] text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
        En attente d'accréditation
      </span>
    );
  };

  // Calcul du nombre de dossiers soumis ayant retenu le sujet en choix n°1
  const getNbDossiersChoix1 = (sujetId: string) => {
    return candidatures.filter(c => {
      if (c.statut === 'BROUILLON') return false;
      const p1 = c.choix_sujets.find(cs => cs.priorite === 1) || c.choix_sujets[0];
      return p1?.sujet?.id === sujetId;
    }).length;
  };

  // Synchroniser le dossier en cours d'examen avec les dernières pièces déposées par le candidat
  useEffect(() => {
    if (!candidatureEnExamen) return;
    const latest = candidatures.find(c => c.id === candidatureEnExamen.id);
    if (latest) {
      setCandidatureEnExamen(latest);
    }
  }, [candidatures]);

  // Ouverture de la fiche d'instruction du dossier
  const handleOuvrirInstruction = (c: Candidature) => {
    const latest = candidatures.find(cand => cand.id === c.id) || c;
    setCandidatureEnExamen(latest);
    setDateConvocation(latest.etape1?.date_convocation || '');
    setNoteOral(latest.etape1?.note !== undefined ? latest.etape1.note : '');
    setResultatEtape1(latest.etape1?.resultat || 'LISTE_PRINCIPALE');
    setMotifRefus(latest.etape1?.motif_refus || '');
    setMotifCorrection(latest.motif_correction || '');
    setFormError('');
  };

  // Prise en charge du dossier (passe de SOUMISE à EN_EXAMEN)
  const handlePrendreEnCharge = () => {
    if (!candidatureEnExamen) return;
    onUpdateStatut(candidatureEnExamen.id, 'EN_EXAMEN');
    setCandidatureEnExamen(prev => prev ? { ...prev, statut: 'EN_EXAMEN' } : null);
  };

  // Validation d'une pièce par l'encadrant
  const handleValiderPiece = (docId: string) => {
    if (!candidatureEnExamen) return;
    const docsMaj = candidatureEnExamen.documents.map(d => 
      d.id === docId ? { ...d, statut_verification: 'VALIDE' as StatutDocument, motif_rejet: undefined } : d
    );
    setCandidatureEnExamen({
      ...candidatureEnExamen,
      documents: docsMaj
    });
    if (onUpdateDocumentStatut) {
      onUpdateDocumentStatut(candidatureEnExamen.id, docId, 'VALIDE');
    }
  };

  // Ouverture modal rejet pièce
  const handleOuvrirRejetPiece = (docId: string, docType: string) => {
    setModalRejetPiece({ docId, docType });
    setMotifRejetPiece('');
  };

  // Confirmation du rejet d'une pièce avec motif obligatoire
  const handleConfirmerRejetPiece = () => {
    if (!modalRejetPiece || !candidatureEnExamen) return;
    if (!motifRejetPiece.trim()) {
      alert("Le motif de rejet est obligatoire pour informer le candidat.");
      return;
    }

    const docsMaj = candidatureEnExamen.documents.map(d => 
      d.id === modalRejetPiece.docId 
        ? { ...d, statut_verification: 'REJETE' as StatutDocument, motif_rejet: motifRejetPiece.trim() } 
        : d
    );

    setCandidatureEnExamen({
      ...candidatureEnExamen,
      documents: docsMaj
    });

    if (onUpdateDocumentStatut) {
      onUpdateDocumentStatut(candidatureEnExamen.id, modalRejetPiece.docId, 'REJETE', motifRejetPiece.trim());
    }

    setModalRejetPiece(null);
    setMotifRejetPiece('');
  };

  // Ouverture du véritable PDF déposé par le candidat
  const handleOuvrirPdfDocument = async (doc: DocumentCandidat) => {
    let pdfUrl = doc.fichier_url;
    let pageCount = doc.page_count;

    if (!pdfUrl) {
      const generated = await generateSamplePdf(
        doc.type, 
        candidatureEnExamen ? `${candidatureEnExamen.candidat_nom} ${candidatureEnExamen.candidat_prenom}` : 'Candidat USMBA',
        candidatureEnExamen?.candidat_cin || 'CD654321'
      );
      pdfUrl = generated.dataUrl;
      pageCount = generated.pageCount;
    }

    setVisualiseurDoc({
      docTitle: doc.type,
      fileName: doc.nom_fichier,
      pdfUrl,
      pageCount: pageCount || 1,
      statut: doc.statut_verification,
      motifRejet: doc.motif_rejet,
      candidatNom: candidatureEnExamen ? `${candidatureEnExamen.candidat_nom} ${candidatureEnExamen.candidat_prenom}` : undefined
    });
  };

  // Enregistrement de l'évaluation Étape 1
  const validerInstructionEtape1 = () => {
    if (!candidatureEnExamen) return;

    if (resultatEtape1 === 'REJETE' && !motifRefus.trim()) {
      setFormError("Le motif de rejet est obligatoire en cas de décision défavorable.");
      return;
    }

    const nouveauStatut: StatutCandidature = resultatEtape1 === 'REJETE' ? 'REFUSEE' : 'EN_EXAMEN';

    onUpdateStatut(candidatureEnExamen.id, nouveauStatut, {
      etape1: {
        decideur: `Pr. ${encadrantNom} ${encadrantPrenom}`,
        date_convocation: dateConvocation || undefined,
        note: noteOral !== '' ? Number(noteOral) : undefined,
        resultat: resultatEtape1,
        motif_refus: resultatEtape1 === 'REJETE' ? motifRefus : undefined
      },
      motif_correction: motifCorrection || undefined
    });

    setCandidatureEnExamen(null);
  };

  // Modal Proposer un sujet : ouvrir
  const handleOuvrirProposerSujet = () => {
    setFormSujetTitre('');
    setFormSujetResume('');
    setFormSujetTheme('');
    setFormSujetPlaces(1);
    setFormSujetError('');
    setIsNouveauOpen(true);
  };

  // Modal Proposer un sujet : soumettre
  const handleSoumettreNouveauSujet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSujetTitre.trim()) {
      setFormSujetError("L'intitulé du sujet est obligatoire.");
      return;
    }
    if (!formSujetResume.trim()) {
      setFormSujetError("Le résumé du sujet est obligatoire.");
      return;
    }
    if (!formSujetTheme.trim()) {
      setFormSujetError("La thématique de recherche est obligatoire.");
      return;
    }

    const nouveau: SujetThese = {
      id: `s-${Date.now()}`,
      titre: formSujetTitre.trim(),
      description: formSujetResume.trim(),
      nombre_places: formSujetPlaces,
      statut: 'PROPOSE',
      propose_par: `Pr. ${encadrantNom}`,
      encadrant_id: currentUser?.id || 'user-dt-1',
      structure: currentUser?.etablissement || "Laboratoire d'Informatique et Systèmes (LIS)",
      etablissement: "Faculté des Sciences Dhar El Mahraz",
      annee: 2026,
      theme: formSujetTheme.trim(),
      validation_structure: 'EN_ATTENTE',
      validation_centre: 'EN_ATTENTE',
      validation_pole: 'EN_ATTENTE'
    };

    onAjouterSujet(nouveau);
    setIsNouveauOpen(false);
  };

  // Modal Modifier un sujet : ouvrir
  const handleOuvrirModifierSujet = (sujet: SujetThese) => {
    setSujetEnModification(sujet);
    setFormSujetTitre(sujet.titre);
    setFormSujetResume(sujet.description);
    setFormSujetTheme(sujet.theme);
    setFormSujetPlaces(sujet.nombre_places);
    setFormSujetError('');
  };

  // Modal Modifier un sujet : enregistrer
  // RÈGLE IMPORTANTE : lorsqu'un sujet déjà accrédité est modifié, son statut repasse automatiquement à « En attente d'accréditation »
  const handleEnregistrerModificationSujet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sujetEnModification) return;

    if (!formSujetTitre.trim() || !formSujetResume.trim() || !formSujetTheme.trim()) {
      setFormSujetError("Tous les champs sont obligatoires.");
      return;
    }

    const etaitAccredite = sujetEnModification.validation_structure === 'VALIDE';

    const sujetModifie: SujetThese = {
      ...sujetEnModification,
      titre: formSujetTitre.trim(),
      description: formSujetResume.trim(),
      theme: formSujetTheme.trim(),
      nombre_places: formSujetPlaces,
      // Si déjà accrédité, repasse obligatoirement à En attente d'accréditation
      validation_structure: etaitAccredite ? 'EN_ATTENTE' : sujetEnModification.validation_structure,
      statut: etaitAccredite ? 'PROPOSE' : sujetEnModification.statut
    };

    if (onModifierSujet) {
      onModifierSujet(sujetModifie);
    } else {
      // Fallback
      onAjouterSujet(sujetModifie);
    }

    if (etaitAccredite) {
      alert("Attention : Le sujet ayant été modifié, son statut repasse automatiquement à « En attente d'accréditation » auprès de la direction de structure.");
    }

    setSujetEnModification(null);
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* Header Encadrant Aéré */}
      <div className="bg-white p-6 sm:p-8 rounded-[6px] border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#0f766e] uppercase tracking-wider">
            <User className="w-4 h-4" />
            Espace Enseignant-Chercheur
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5 font-serif">
            Directeur de Thèse &bull; Pr. {encadrantNom}
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            {currentUser?.etablissement || "Laboratoire d'Informatique et Systèmes (LIS)"} &bull; CEDoc USMBA Fès
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setTab('CANDIDATURES')}
            className={`px-4 py-2 rounded-[6px] text-xs font-bold transition cursor-pointer ${
              tab === 'CANDIDATURES' 
                ? 'bg-[#0f766e] text-white shadow-xs' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Candidatures Reçues ({dossiersFiltres.length})
          </button>
          <button
            onClick={() => setTab('MES_SUJETS')}
            className={`px-4 py-2 rounded-[6px] text-xs font-bold transition cursor-pointer ${
              tab === 'MES_SUJETS' 
                ? 'bg-[#0f766e] text-white shadow-xs' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Mes Sujets de Thèse ({mesSujets.length})
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* ONGLET 1 : CANDIDATURES REÇUES                                       */}
      {/* ==================================================================== */}
      {tab === 'CANDIDATURES' && (
        <div className="bg-white rounded-[6px] border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 font-serif">
                Dossiers Assignés en Choix Prioritaire n°1
              </h2>
              <p className="text-xs text-slate-500">
                Seuls les dossiers soumis dont le sujet prioritaire n°1 est l'un de vos sujets apparaissent ici. Les brouillons n'apparaissent chez personne.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-[6px] bg-[#f0fdfa] text-[#0f766e] border border-[#ccfbf1]">
              {dossiersFiltres.length === 1 ? '1 dossier assigné' : `${dossiersFiltres.length} dossiers assignés`}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Candidat</th>
                  <th className="py-3.5 px-4">Réf. Dossier</th>
                  <th className="py-3.5 px-4">Sujet Retenu (Priorité 1)</th>
                  <th className="py-3.5 px-4">Pièces Déposées</th>
                  <th className="py-3.5 px-4">Statut</th>
                  <th className="py-3.5 px-4">Avis Étape 1</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dossiersFiltres.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="text-xs font-bold text-slate-700">Aucun dossier soumis sur vos sujets pour l'instant</p>
                      <p className="text-[11px] text-slate-400">Les dossiers apparaîtront dès que les candidats auront soumis définitivement leur sélection.</p>
                    </td>
                  </tr>
                ) : (
                  dossiersFiltres.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div>{c.candidat_nom} {c.candidat_prenom}</div>
                        {(c.reaffecte_depuis_nom || c.choix_sujets[0]?.sujet.reaffecte_depuis_nom) && (
                          <span className="inline-block mt-1 px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            Réaffecté ({c.reaffecte_depuis_nom || c.choix_sujets[0]?.sujet.reaffecte_depuis_nom})
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600 font-medium">
                        {c.reference || c.id}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 max-w-xs truncate font-medium">
                        {c.choix_sujets[0]?.sujet.titre || "Non spécifié"}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-700">
                          {c.documents.filter(d => d.type !== "Carte d'identité nationale (CIN)").length} / {PIECES_ACADEMIQUES.length} pièces
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {getStatutBadge(c.statut)}
                      </td>
                      <td className="py-3.5 px-4">
                        {c.etape1?.resultat ? (
                          <span className="font-bold text-[#0f766e]">
                            {c.etape1.resultat === 'LISTE_PRINCIPALE' && 'Liste Principale'}
                            {c.etape1.resultat === 'LISTE_ATTENTE' && "Liste d'Attente"}
                            {c.etape1.resultat === 'REJETE' && 'Rejeté'}
                            {c.etape1.note !== undefined && ` (${c.etape1.note}/20)`}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">En attente d'instruction</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOuvrirInstruction(c)}
                          className="bg-[#0f766e] hover:bg-[#115e59] text-white px-3.5 py-1.5 rounded-[6px] font-bold text-xs transition cursor-pointer shadow-2xs"
                        >
                          Examiner
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ONGLET 2 : GESTION DES SUJETS DE THÈSE                                */}
      {/* ==================================================================== */}
      {tab === 'MES_SUJETS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 font-serif">Mes Sujets de Thèse</h2>
              <p className="text-xs text-slate-500">
                Gérez les projets de recherche proposés au catalogue du CEDoc USMBA
              </p>
            </div>
            <button
              onClick={handleOuvrirProposerSujet}
              className="bg-[#0f766e] hover:bg-[#115e59] text-white px-4 py-2.5 rounded-[6px] text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Proposer un sujet
            </button>
          </div>

          <div className="bg-white rounded-[6px] border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Titre du Sujet</th>
                  <th className="py-3.5 px-4">Thématique</th>
                  <th className="py-3.5 px-4">Places</th>
                  <th className="py-3.5 px-4">Statut</th>
                  <th className="py-3.5 px-4 text-center">Candidats Choix n°1</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mesSujets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      Aucun sujet proposé pour l'instant. Cliquez sur « Proposer un sujet ».
                    </td>
                  </tr>
                ) : (
                  mesSujets.map((s) => {
                    const nbChoix1 = getNbDossiersChoix1(s.id);
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900 max-w-sm">
                          <div>{s.titre}</div>
                          {s.reaffecte_depuis_nom && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              Réaffecté (initialement {s.reaffecte_depuis_nom})
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                          {s.theme}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-800">
                          {s.nombre_places} place{s.nombre_places > 1 ? 's' : ''}
                        </td>
                        <td className="py-3.5 px-4">
                          {getStatutSujetBadge(s)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                            nbChoix1 > 0 
                              ? 'bg-[#f0fdfa] text-[#0f766e] border border-[#ccfbf1]' 
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {nbChoix1}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => setSujetEnConsultation(s)}
                            className="px-2.5 py-1.5 bg-white border border-slate-300 hover:border-[#0f766e] hover:text-[#0f766e] text-slate-700 rounded-[4px] font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition shadow-2xs"
                            title="Consulter le sujet complet"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#0f766e]" />
                            <span>Consulter</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOuvrirModifierSujet(s)}
                            className="px-2.5 py-1.5 bg-white border border-slate-300 hover:border-[#0f766e] hover:text-[#0f766e] text-slate-700 rounded-[4px] font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition shadow-2xs"
                            title="Modifier le sujet"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Modifier</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL / FICHE D'INSTRUCTION CANDIDAT AVEC LES 6 PIÈCES               */}
      {/* ==================================================================== */}
      {candidatureEnExamen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl max-h-[92vh] rounded-[6px] shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto animate-in fade-in">
            
            {/* Header Modal */}
            <div className="bg-[#0f766e] text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-extrabold text-base font-serif">
                  Fiche d'Instruction : {candidatureEnExamen.candidat_prenom} {candidatureEnExamen.candidat_nom}
                </h3>
                <span className="text-xs text-teal-100 font-mono">
                  Réf : {candidatureEnExamen.reference || candidatureEnExamen.id} &bull; CNE : {candidatureEnExamen.candidat_cne}
                </span>
              </div>
              <button 
                onClick={() => setCandidatureEnExamen(null)} 
                className="text-teal-200 hover:text-white cursor-pointer p-1 rounded hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              
              {formError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-[6px] text-rose-700 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Statut & Bouton de Prise en Charge */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-[6px] border border-slate-200">
                <div>
                  <span className="text-slate-500 font-bold block mb-0.5">Statut Actuel du Dossier :</span>
                  <div className="flex items-center gap-2">
                    {getStatutBadge(candidatureEnExamen.statut)}
                    {candidatureEnExamen.statut === 'SOUMISE' && (
                      <span className="text-slate-500 font-medium italic">
                        (En attente de prise en charge par l'encadrant)
                      </span>
                    )}
                  </div>
                </div>

                {candidatureEnExamen.statut === 'SOUMISE' ? (
                  <button
                    onClick={handlePrendreEnCharge}
                    className="bg-[#0f766e] hover:bg-[#115e59] text-white px-4 py-2.5 rounded-[6px] font-bold shadow-xs cursor-pointer flex items-center gap-2 transition"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>Prendre en charge le dossier</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 text-[#16a34a] font-bold bg-emerald-50 px-3 py-1 rounded-[6px] border border-[#16a34a]/30">
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Dossier pris en charge</span>
                  </div>
                )}
              </div>

              {/* SECTION 3 : LES CINQ PIÈCES ACADÉMIQUES DÉPOSÉES (LA CIN RELÈVE DE LA SCOLARITÉ) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="font-bold text-slate-900 text-sm font-serif">
                    Examen des 5 Pièces Académiques Déposées ({candidatureEnExamen.documents.filter(d => d.type !== "Carte d'identité nationale (CIN)").length}/{PIECES_ACADEMIQUES.length})
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Dossier scientifique &amp; académique (la CIN est vérifiée par le service de scolarité)
                  </span>
                </div>

                <div className="space-y-2.5">
                  {PIECES_ACADEMIQUES.map((pieceType, pIdx) => {
                    const doc = candidatureEnExamen.documents.find(d => d.type === pieceType);
                    const isDepose = !!doc;

                    return (
                      <div 
                        key={pieceType}
                        className={`p-3.5 rounded-[6px] border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                          !isDepose
                            ? 'bg-slate-50/50 border-slate-200'
                            : doc.statut_verification === 'VALIDE'
                              ? 'bg-emerald-50/20 border-emerald-200'
                              : doc.statut_verification === 'REJETE'
                                ? 'bg-rose-50/30 border-rose-200'
                                : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 truncate">
                              {pIdx + 1}. {pieceType}
                            </span>
                            {/* Statut */}
                            {!isDepose && (
                              <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-slate-200 text-slate-600">
                                Non déposé
                              </span>
                            )}
                            {isDepose && doc.statut_verification === 'VALIDE' && (
                              <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-emerald-50 text-[#16a34a] border border-[#16a34a]/30 inline-flex items-center gap-1">
                                <Check className="w-2.5 h-2.5 stroke-[2.5]" /> Validé
                              </span>
                            )}
                            {isDepose && doc.statut_verification === 'REJETE' && (
                              <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-300 inline-flex items-center gap-1">
                                <AlertTriangle className="w-2.5 h-2.5" /> Rejeté
                              </span>
                            )}
                            {isDepose && doc.statut_verification === 'EN_ATTENTE' && (
                              <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                                En attente de contrôle
                              </span>
                            )}
                          </div>

                          {isDepose && (
                            <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2">
                              <span className="truncate max-w-[240px]">{doc.nom_fichier}</span>
                              <span>&bull;</span>
                              <span>{formatTailleFichier(doc.taille_octets, doc.taille_mo)}</span>
                              <span>&bull;</span>
                              <span>Déposé le {formatDateJJMMAAAA(doc.date_depot)}</span>
                              {doc.page_count !== undefined && (
                                <span className="font-bold text-[#0f766e]">
                                  ({doc.page_count} p.)
                                </span>
                              )}
                            </div>
                          )}

                          {isDepose && doc.statut_verification === 'REJETE' && doc.motif_rejet && (
                            <p className="text-[11px] text-rose-800 font-semibold bg-rose-50 p-1.5 rounded-[4px] border border-rose-200">
                              Motif : {doc.motif_rejet}
                            </p>
                          )}
                        </div>

                        {/* Actions : Ouvrir / Valider / Rejeter */}
                        {isDepose && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOuvrirPdfDocument(doc)}
                              className="px-3 py-1.5 bg-white border border-slate-300 hover:border-[#0f766e] hover:text-[#0f766e] text-slate-700 rounded-[4px] font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                              title="Voir le véritable PDF déposé par le candidat"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#0f766e]" />
                              <span>Voir</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleValiderPiece(doc.id)}
                              className={`px-3 py-1.5 rounded-[4px] font-bold text-xs flex items-center gap-1 transition cursor-pointer shadow-2xs ${
                                doc.statut_verification === 'VALIDE'
                                  ? 'bg-[#16a34a] text-white'
                                  : 'bg-white border border-emerald-300 text-[#16a34a] hover:bg-emerald-50'
                              }`}
                              title="Valider la pièce justificative"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Valider</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOuvrirRejetPiece(doc.id, doc.type)}
                              className={`px-3 py-1.5 rounded-[4px] font-bold text-xs flex items-center gap-1 transition cursor-pointer shadow-2xs ${
                                doc.statut_verification === 'REJETE'
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-white border border-rose-300 text-rose-700 hover:bg-rose-50'
                              }`}
                              title="Rejeter la pièce justificative avec un motif"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Rejeter</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION ÉVALUATION SCIENTIFIQUE ÉTAPE 1 */}
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <h4 className="font-bold text-slate-900 text-sm font-serif">
                  Délibération &amp; Décision de l'Encadrant (Étape 1)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Convocation Entretien Oral */}
                  <div className="p-4 rounded-[6px] border border-slate-200 bg-slate-50/50 space-y-3">
                    <h5 className="font-bold flex items-center gap-2 text-slate-900">
                      <Calendar className="w-4 h-4 text-[#0f766e]" /> Convocation Entretien Oral
                    </h5>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Date et heure :</label>
                      <input
                        type="datetime-local"
                        disabled={candidatureEnExamen.statut === 'SOUMISE'}
                        value={dateConvocation}
                        onChange={(e) => setDateConvocation(e.target.value)}
                        className="w-full px-3 py-2 rounded-[6px] border border-slate-200 bg-white disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-xs focus:ring-2 focus:ring-[#0f766e] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Avis & Note */}
                  <div className="p-4 rounded-[6px] border border-slate-200 bg-slate-50/50 space-y-3">
                    <h5 className="font-bold flex items-center gap-2 text-slate-900">
                      <UserCheck className="w-4 h-4 text-[#0f766e]" /> Avis &amp; Note d'Audition
                    </h5>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Note (0 à 20) :</label>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          step="0.25"
                          disabled={candidatureEnExamen.statut === 'SOUMISE'}
                          placeholder="Ex: 16.5"
                          value={noteOral}
                          onChange={(e) => {
                            setNoteOral(e.target.value === '' ? '' : Number(e.target.value));
                            if (formError) setFormError('');
                          }}
                          className="w-full px-3 py-2 rounded-[6px] border border-slate-200 bg-white disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-xs focus:ring-2 focus:ring-[#0f766e] focus:outline-none font-bold"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Avis Étape 1 :</label>
                        <select
                          disabled={candidatureEnExamen.statut === 'SOUMISE'}
                          value={resultatEtape1}
                          onChange={(e) => setResultatEtape1(e.target.value as any)}
                          className="w-full px-3 py-2 rounded-[6px] border border-slate-200 font-bold bg-white disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-xs focus:ring-2 focus:ring-[#0f766e] focus:outline-none"
                        >
                          <option value="LISTE_PRINCIPALE">Liste Principale (LP)</option>
                          <option value="LISTE_ATTENTE">Liste d'Attente (LA)</option>
                          <option value="REJETE">Rejeté</option>
                        </select>
                      </div>
                    </div>

                    {resultatEtape1 === 'REJETE' && (
                      <div className="pt-1">
                        <label className="block text-rose-700 font-bold mb-1">
                          Motif obligatoire de rejet * :
                        </label>
                        <textarea
                          disabled={candidatureEnExamen.statut === 'SOUMISE'}
                          value={motifRefus}
                          onChange={(e) => {
                            setMotifRefus(e.target.value);
                            if (formError) setFormError('');
                          }}
                          placeholder="Motivations académiques du rejet..."
                          className="w-full p-2 rounded-[6px] border border-rose-300 text-xs bg-white"
                          rows={2}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Footer Modal */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setCandidatureEnExamen(null)}
                className="px-4 py-2 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-[6px] font-bold cursor-pointer transition text-xs"
              >
                Fermer
              </button>
              
              <button
                disabled={candidatureEnExamen.statut === 'SOUMISE'}
                onClick={validerInstructionEtape1}
                className="px-5 py-2 bg-[#0f766e] hover:bg-[#115e59] disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-[6px] font-bold shadow-xs cursor-pointer disabled:cursor-not-allowed transition text-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Enregistrer l'évaluation</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL REJET D'UNE PIÈCE AVEC MOTIF OBLIGATOIRE */}
      {modalRejetPiece && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[6px] max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-extrabold text-base text-rose-700 font-serif flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Rejeter la pièce justificative
              </h3>
              <button onClick={() => setModalRejetPiece(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Pièce concernée : <strong>{modalRejetPiece.docType}</strong>. Veuillez préciser le motif qui sera communiqué au candidat pour rectification.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Motif explicatif du rejet * :
              </label>
              <textarea
                value={motifRejetPiece}
                onChange={(e) => setMotifRejetPiece(e.target.value)}
                placeholder="Ex: Document tronqué, document illisible, diplôme non authentifié, verso manquant..."
                className="w-full text-xs p-3 border border-slate-300 rounded-[6px] focus:ring-2 focus:ring-rose-500 focus:outline-none"
                rows={3}
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setModalRejetPiece(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[6px] text-xs font-bold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmerRejetPiece}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-[6px] text-xs font-bold shadow-xs"
              >
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PROPOSER UN SUJET */}
      {isNouveauOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[6px] max-w-lg w-full p-6 sm:p-8 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-base font-extrabold text-slate-900 font-serif">Proposer un sujet de thèse</h3>
              <button onClick={() => setIsNouveauOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formSujetError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-[6px] text-xs font-semibold">
                {formSujetError}
              </div>
            )}

            <form onSubmit={handleSoumettreNouveauSujet} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold block mb-1">Titre du sujet *</label>
                <input
                  type="text"
                  value={formSujetTitre}
                  onChange={(e) => setFormSujetTitre(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-[6px]"
                  placeholder="Ex: Analyse de la résilience énergétique..."
                  required
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Résumé (Description) *</label>
                <textarea
                  value={formSujetResume}
                  onChange={(e) => setFormSujetResume(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-[6px]"
                  rows={3}
                  placeholder="Objectifs scientifiques, méthodologie et portée de la recherche..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Thématique *</label>
                  <input
                    type="text"
                    value={formSujetTheme}
                    onChange={(e) => setFormSujetTheme(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-[6px]"
                    placeholder="Ex: IA &amp; Télédétection"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Nombre de places</label>
                  <input
                    type="number"
                    min="1"
                    max="4"
                    value={formSujetPlaces}
                    onChange={(e) => setFormSujetPlaces(Number(e.target.value))}
                    className="w-full p-2.5 border border-slate-200 rounded-[6px]"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-[4px] bg-[#f0fdfa] border border-[#ccfbf1] text-[11px] text-slate-600">
                Le sujet sera soumis à la direction de structure de votre laboratoire avec le statut <strong>« En attente d'accréditation »</strong>.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button 
                  type="button"
                  onClick={() => setIsNouveauOpen(false)} 
                  className="px-4 py-2 bg-slate-100 rounded-[6px] font-bold cursor-pointer hover:bg-slate-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0f766e] hover:bg-[#115e59] text-white rounded-[6px] font-bold shadow-xs cursor-pointer"
                >
                  Proposer le sujet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL MODIFIER UN SUJET */}
      {sujetEnModification && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[6px] max-w-lg w-full p-6 sm:p-8 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-base font-extrabold text-slate-900 font-serif">Modifier le sujet de thèse</h3>
              <button onClick={() => setSujetEnModification(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formSujetError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-[6px] text-xs font-semibold">
                {formSujetError}
              </div>
            )}

            <form onSubmit={handleEnregistrerModificationSujet} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold block mb-1">Titre du sujet *</label>
                <input
                  type="text"
                  value={formSujetTitre}
                  onChange={(e) => setFormSujetTitre(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-[6px]"
                  required
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Résumé (Description) *</label>
                <textarea
                  value={formSujetResume}
                  onChange={(e) => setFormSujetResume(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-[6px]"
                  rows={3}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Thématique *</label>
                  <input
                    type="text"
                    value={formSujetTheme}
                    onChange={(e) => setFormSujetTheme(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-[6px]"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Nombre de places</label>
                  <input
                    type="number"
                    min="1"
                    max="4"
                    value={formSujetPlaces}
                    onChange={(e) => setFormSujetPlaces(Number(e.target.value))}
                    className="w-full p-2.5 border border-slate-200 rounded-[6px]"
                  />
                </div>
              </div>

              {/* Règle importante rappelée */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-[4px] text-[11px] text-amber-900 space-y-1">
                <strong className="block font-bold">Règle réglementaire USMBA :</strong>
                <p>
                  Lorsqu'un sujet déjà accrédité est modifié, son statut repasse automatiquement à <strong>« En attente d'accréditation »</strong> auprès de la direction de structure de recherche.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button 
                  type="button"
                  onClick={() => setSujetEnModification(null)} 
                  className="px-4 py-2 bg-slate-100 rounded-[6px] font-bold cursor-pointer hover:bg-slate-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0f766e] hover:bg-[#115e59] text-white rounded-[6px] font-bold shadow-xs cursor-pointer"
                >
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONSULTER UN SUJET */}
      {sujetEnConsultation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[6px] max-w-xl w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#0f766e]" />
                <h3 className="text-base font-extrabold text-slate-900 font-serif">Fiche Complète du Sujet</h3>
              </div>
              <button onClick={() => setSujetEnConsultation(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] font-bold uppercase">Intitulé</span>
                <h4 className="text-sm font-bold text-slate-900 font-serif mt-0.5">{sujetEnConsultation.titre}</h4>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-[6px] border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Thématique</span>
                  <span className="font-semibold text-slate-800">{sujetEnConsultation.theme}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Places</span>
                  <span className="font-bold text-slate-800">{sujetEnConsultation.nombre_places} place(s)</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Statut d'accréditation</span>
                  <div className="mt-0.5">{getStatutSujetBadge(sujetEnConsultation)}</div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Dossiers en choix n°1</span>
                  <span className="font-mono font-bold text-[#0f766e]">{getNbDossiersChoix1(sujetEnConsultation.id)} candidat(s)</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] font-bold uppercase mb-1">Résumé &amp; Description scientifique</span>
                <p className="p-3 bg-slate-50 rounded-[6px] border border-slate-200 text-slate-700 leading-relaxed font-sans">
                  {sujetEnConsultation.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-slate-500 text-[11px]">
                <div>Encadrant : <strong className="text-slate-800">{sujetEnConsultation.propose_par}</strong></div>
                <div>Structure : <strong className="text-slate-800">{sujetEnConsultation.structure}</strong></div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                type="button"
                onClick={() => setSujetEnConsultation(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-[6px] text-xs font-bold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visualiseur de PDF Réel Déposé */}
      {visualiseurDoc && (
        <ModalVisualiseurPdf
          isOpen={true}
          docTitle={visualiseurDoc.docTitle}
          fileName={visualiseurDoc.fileName}
          pdfUrl={visualiseurDoc.pdfUrl}
          pageCount={visualiseurDoc.pageCount}
          statut={visualiseurDoc.statut}
          motifRejet={visualiseurDoc.motifRejet}
          candidatNom={visualiseurDoc.candidatNom}
          onClose={() => setVisualiseurDoc(null)}
        />
      )}

    </div>
  );
};

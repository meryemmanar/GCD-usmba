import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  User, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  X, 
  Check, 
  Eye, 
  AlertTriangle, 
  Search, 
  Filter, 
  Download,
  Calendar,
  Layers,
  Clock,
  IdCard,
  Database,
  GraduationCap
} from 'lucide-react';
import { Candidature, PersonneIdentite, DocumentCandidat, StatutDocument, StatutIdentite, EtudiantUSMBA } from '../types';
import { INITIAL_ETUDIANTS_USMBA } from '../data/initialData';
import { formatDateJJMMAAAA } from '../utils/dateUtils';
import { ModalVisualiseurPdf } from './ModalVisualiseurPdf';
import { formatTailleFichier } from '../utils/pdfUtils';

interface AgentAdminViewProps {
  candidatures: Candidature[];
  personnes: PersonneIdentite[];
  etudiantsUSMBA?: EtudiantUSMBA[];
  onValiderDocumentStatut?: (candId: string, docId: string, statutVerif: StatutDocument, motifRejet?: string) => void;
  onValiderIdentite: (id: string, statut: 'CONFORME' | 'NON_CONFORME', motif?: string) => void;
}

interface DossierIdentiteItem {
  id: string; // personne_id ou cand.id
  candidatureId?: string;
  personneId?: string;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  nom_declare?: string;
  prenom_declare?: string;
  numero_cin: string;
  date_naissance?: string;
  lieu_naissance?: string;
  date_validite_cin?: string;
  adresse?: string;
  cne: string;
  statut_identite: StatutIdentite;
  motif_identite?: string;
  documentCin?: DocumentCandidat;
  candidatureStatut?: Candidature['statut'];
  documentsCandidature?: DocumentCandidat[];
}

export const AgentAdminView: React.FC<AgentAdminViewProps> = ({
  candidatures,
  personnes,
  etudiantsUSMBA = INITIAL_ETUDIANTS_USMBA,
  onValiderDocumentStatut,
  onValiderIdentite
}) => {
  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState<'TOUS' | 'A_EXAMINER' | 'CONFORME' | 'NON_CONFORME'>('TOUS');
  const [rechercheEtudiantsUSMBA, setRechercheEtudiantsUSMBA] = useState('');

  // État modal de consultation du PDF de la CIN (Recto + Verso)
  const [viewerPdf, setViewerPdf] = useState<{
    isOpen: boolean;
    docTitle: string;
    fileName: string;
    pdfUrl: string;
    pageCount?: number;
    statut?: string;
    motifRejet?: string;
    candidatNom: string;
    cin: string;
  }>({
    isOpen: false,
    docTitle: "Carte d'identité nationale (CIN)",
    fileName: '',
    pdfUrl: '',
    pageCount: 2,
    candidatNom: '',
    cin: ''
  });

  // État modal de rejet avec motif obligatoire
  const [modalRejet, setModalRejet] = useState<{
    isOpen: boolean;
    item: DossierIdentiteItem | null;
    motif: string;
    erreur: string;
  }>({
    isOpen: false,
    item: null,
    motif: '',
    erreur: ''
  });

  // Modal de confirmation / détails du dossier
  const [dossierDetails, setDossierDetails] = useState<DossierIdentiteItem | null>(null);

  // Modal de consultation des résultats du contrôle automatique des 6 pièces (après soumission)
  const [modalControlePieces, setModalControlePieces] = useState<DossierIdentiteItem | null>(null);

  // Fusion intelligente des données déclarées (PersonneIdentite) et des dossiers soumis (Candidature)
  const dossiersIdentite: DossierIdentiteItem[] = useMemo(() => {
    const list: DossierIdentiteItem[] = [];
    const processedPersonIds = new Set<string>();

    // 1. Parcourir toutes les candidatures (qui contiennent les documents déposés et les données validées du formulaire de scan)
    candidatures.forEach(cand => {
      const docCin = [...cand.documents]
        .reverse()
        .find(d => d.type === "Carte d'identité nationale (CIN)" && d.statut_verification !== 'NON_DEPOSE');
      // Correspondance stricte par personne_id pour éviter tout mélange avec un autre dossier
      const matchingPerson = personnes.find(p => Boolean(cand.personne_id && p.id === cand.personne_id));

      if (matchingPerson) {
        processedPersonIds.add(matchingPerson.id);
      }

      // Calcul du statut effectif
      let statut: StatutIdentite = 'A_EXAMINER';
      let motif: string | undefined = undefined;

      if (docCin) {
        if (docCin.statut_verification === 'VALIDE') {
          statut = 'CONFORME';
        } else if (docCin.statut_verification === 'REJETE') {
          statut = 'NON_CONFORME';
          motif = docCin.motif_rejet;
        } else {
          statut = matchingPerson?.statut_identite || 'A_EXAMINER';
          motif = matchingPerson?.motif_identite;
        }
      } else if (matchingPerson) {
        statut = matchingPerson.statut_identite;
        motif = matchingPerson.motif_identite;
      }

      const scanDeclare = cand.donnees_scan_cnie || matchingPerson?.donnees_scan_cnie;

      const nomDeclare = scanDeclare
        ? scanDeclare.nom
        : (cand.candidat_nom || matchingPerson?.nom || '');
      const prenomDeclare = scanDeclare
        ? scanDeclare.prenom
        : (cand.candidat_prenom || matchingPerson?.prenom || '');
      const cinDeclare = scanDeclare
        ? scanDeclare.cin
        : (cand.candidat_cin || matchingPerson?.numero_document_identite || '');
      const dateNaissanceDeclaree = scanDeclare
        ? scanDeclare.date_naissance
        : (cand.candidat_date_naissance || matchingPerson?.date_naissance);
      const lieuNaissanceDeclare = scanDeclare
        ? scanDeclare.lieu_naissance
        : (cand.candidat_lieu_naissance || matchingPerson?.lieu_naissance);
      const dateValiditeDeclaree = scanDeclare
        ? scanDeclare.date_validite
        : (cand.candidat_date_validite_cin || matchingPerson?.date_validite_cin);
      const adresseDeclaree = scanDeclare
        ? scanDeclare.adresse
        : (cand.candidat_adresse || matchingPerson?.adresse);

      list.push({
        id: cand.id,
        candidatureId: cand.id,
        personneId: matchingPerson?.id || cand.personne_id,
        nom: cand.candidat_nom || matchingPerson?.nom || '',
        prenom: cand.candidat_prenom || matchingPerson?.prenom || '',
        email: cand.candidat_email || matchingPerson?.email || '',
        telephone: cand.candidat_telephone || matchingPerson?.telephone,
        nom_declare: nomDeclare,
        prenom_declare: prenomDeclare,
        numero_cin: cinDeclare,
        date_naissance: dateNaissanceDeclaree,
        lieu_naissance: lieuNaissanceDeclare,
        date_validite_cin: dateValiditeDeclaree,
        adresse: adresseDeclaree,
        cne: cand.candidat_cne || matchingPerson?.cne || '',
        statut_identite: statut,
        motif_identite: motif,
        documentCin: docCin,
        candidatureStatut: cand.statut,
        documentsCandidature: cand.documents
      });
    });

    // 2. Ajouter les personnes qui n'ont pas encore de dossier de candidature créé
    personnes.forEach(p => {
      if (!processedPersonIds.has(p.id)) {
        const scanDeclare = p.donnees_scan_cnie;
        list.push({
          id: p.id,
          personneId: p.id,
          nom: p.nom,
          prenom: p.prenom,
          email: p.email,
          telephone: p.telephone,
          nom_declare: scanDeclare ? scanDeclare.nom : p.nom,
          prenom_declare: scanDeclare ? scanDeclare.prenom : p.prenom,
          numero_cin: scanDeclare ? scanDeclare.cin : (p.numero_document_identite || ''),
          date_naissance: scanDeclare ? scanDeclare.date_naissance : p.date_naissance,
          lieu_naissance: scanDeclare ? scanDeclare.lieu_naissance : p.lieu_naissance,
          date_validite_cin: scanDeclare ? scanDeclare.date_validite : p.date_validite_cin,
          adresse: scanDeclare ? scanDeclare.adresse : p.adresse,
          cne: p.cne || '',
          statut_identite: p.statut_identite,
          motif_identite: p.motif_identite,
          documentCin: undefined
        });
      }
    });

    return list;
  }, [candidatures, personnes]);

  // Filtrage de la base simulée d'étudiants USMBA
  const etudiantsUSMBAFiltres = useMemo(() => {
    if (!rechercheEtudiantsUSMBA.trim()) return etudiantsUSMBA;
    const q = rechercheEtudiantsUSMBA.toLowerCase().trim();
    return etudiantsUSMBA.filter(e =>
      e.nom.toLowerCase().includes(q) ||
      e.prenom.toLowerCase().includes(q) ||
      `${e.prenom} ${e.nom}`.toLowerCase().includes(q) ||
      `${e.nom} ${e.prenom}`.toLowerCase().includes(q) ||
      e.cne.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.filiere.toLowerCase().includes(q)
    );
  }, [etudiantsUSMBA, rechercheEtudiantsUSMBA]);

  // Filtrage et recherche
  const dossiersFiltres = useMemo(() => {
    return dossiersIdentite.filter(item => {
      // Filtre statut
      if (filtreStatut !== 'TOUS' && item.statut_identite !== filtreStatut) {
        return false;
      }

      // Filtre recherche
      if (recherche.trim()) {
        const q = recherche.toLowerCase().trim();
        const fullName = `${item.nom} ${item.prenom}`.toLowerCase();
        const cin = item.numero_cin.toLowerCase();
        const cne = item.cne.toLowerCase();
        const email = item.email.toLowerCase();
        return fullName.includes(q) || cin.includes(q) || cne.includes(q) || email.includes(q);
      }

      return true;
    });
  }, [dossiersIdentite, filtreStatut, recherche]);

  // Indicateurs synthétiques
  const stats = useMemo(() => {
    const total = dossiersIdentite.length;
    const aExaminer = dossiersIdentite.filter(d => d.statut_identite === 'A_EXAMINER').length;
    const conforme = dossiersIdentite.filter(d => d.statut_identite === 'CONFORME').length;
    const nonConforme = dossiersIdentite.filter(d => d.statut_identite === 'NON_CONFORME').length;
    const cinDeposees = dossiersIdentite.filter(d => !!d.documentCin).length;
    return { total, aExaminer, conforme, nonConforme, cinDeposees };
  }, [dossiersIdentite]);

  // Handler ouverture consultation du véritable PDF CIN déposé par le candidat
  const handleConsulterCin = (item: DossierIdentiteItem) => {
    const docCin = item.documentCin;
    if (!docCin || !docCin.fichier_url) return;

    setViewerPdf({
      isOpen: true,
      docTitle: "Carte d'identité nationale (CIN) · Recto & Verso",
      fileName: docCin.nom_fichier,
      pdfUrl: docCin.fichier_url,
      pageCount: docCin.page_count,
      statut: docCin.statut_verification,
      motifRejet: docCin.motif_rejet || item.motif_identite,
      candidatNom: `${item.nom} ${item.prenom}`,
      cin: item.numero_cin
    });
  };

  // Handler validation conforme
  const handleValiderConforme = (item: DossierIdentiteItem) => {
    if (item.candidatureId && item.documentCin && onValiderDocumentStatut) {
      onValiderDocumentStatut(item.candidatureId, item.documentCin.id, 'VALIDE');
    }
    if (item.personneId) {
      onValiderIdentite(item.personneId, 'CONFORME');
    }
    if (dossierDetails?.id === item.id) {
      setDossierDetails(prev => prev ? { ...prev, statut_identite: 'CONFORME', motif_identite: undefined } : null);
    }
  };

  // Handler ouverture modal de rejet avec motif
  const handleOuvrirRejet = (item: DossierIdentiteItem) => {
    setModalRejet({
      isOpen: true,
      item,
      motif: item.documentCin?.motif_rejet || item.motif_identite || '',
      erreur: ''
    });
  };

  // Handler confirmation du rejet
  const handleConfirmerRejet = () => {
    if (!modalRejet.item) return;
    if (!modalRejet.motif.trim()) {
      setModalRejet(prev => ({ ...prev, erreur: "Le motif de rejet est obligatoire pour informer le candidat." }));
      return;
    }

    const { item, motif } = modalRejet;

    if (item.candidatureId && item.documentCin && onValiderDocumentStatut) {
      onValiderDocumentStatut(item.candidatureId, item.documentCin.id, 'REJETE', motif.trim());
    }
    if (item.personneId) {
      onValiderIdentite(item.personneId, 'NON_CONFORME', motif.trim());
    }
    if (dossierDetails?.id === item.id) {
      setDossierDetails(prev => prev ? { ...prev, statut_identite: 'NON_CONFORME', motif_identite: motif.trim() } : null);
    }

    setModalRejet({ isOpen: false, item: null, motif: '', erreur: '' });
  };

  return (
    <div className="space-y-6 pb-16">
      {/* BANDEAU SUPÉRIEUR ACCUEIL SERVICE */}
      <div className="bg-white p-6 sm:p-7 rounded-[6px] border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-bold text-[#0f766e] uppercase tracking-wider font-mono">
          <ShieldCheck className="w-4 h-4 text-[#0f766e]" />
          Service Scolarité &amp; Contrôle d'Identité CEDoc
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1 font-serif">
          Contrôle d'Identité &amp; Traitement des Cartes Nationales (CIN)
        </h1>
        <p className="text-xs text-slate-600 font-medium max-w-3xl mt-1 leading-relaxed">
          Espace exclusif réservé au service de scolarité pour vérifier la conformité des pièces d'identité scannées 
          (CIN recto-verso) déposées par les candidats, valider l'authenticité de l'état civil déclaré et prévenir toute tentative d'usurpation.
        </p>
      </div>

      {/* CARTES INDICATEURS CLÉS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-[6px] border border-amber-200 shadow-xs bg-amber-50/20">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-[11px] font-semibold">À Examiner</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-900 font-serif">
            {stats.aExaminer}
          </div>
          <p className="text-[10px] text-amber-700 mt-1">En attente de traitement scolarité</p>
        </div>

        <div className="bg-white p-4 rounded-[6px] border border-emerald-200 shadow-xs bg-emerald-50/20">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-[11px] font-semibold">Validées &bull; Conformes</span>
            <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
          </div>
          <div className="text-2xl font-black text-[#16a34a] font-serif">
            {stats.conforme}
          </div>
          <p className="text-[10px] text-emerald-700 mt-1">Identités vérifiées et attestées</p>
        </div>

        <div className="bg-white p-4 rounded-[6px] border border-rose-200 shadow-xs bg-rose-50/20">
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="text-[11px] font-semibold">Rejetées &bull; Non Conformes</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-700 font-serif">
            {stats.nonConforme}
          </div>
          <p className="text-[10px] text-rose-600 mt-1">Motif transmis au candidat</p>
        </div>
      </div>

      {/* TABLEAU PRINCIPAL DE GESTION DES CIN */}
      <div className="bg-white rounded-[6px] border border-slate-200 shadow-xs overflow-hidden">
        {/* FILTRES & RECHERCHE */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher par nom, CIN, CNE, email..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-[6px] border border-slate-200 bg-white focus:ring-2 focus:ring-[#0f766e] focus:outline-none"
              />
              {recherche && (
                <button
                  type="button"
                  onClick={() => setRecherche('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setFiltreStatut('TOUS')}
              className={`px-3 py-1.5 rounded-[4px] text-xs font-bold transition cursor-pointer shrink-0 ${
                filtreStatut === 'TOUS'
                  ? 'bg-[#0f766e] text-white shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Tous ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setFiltreStatut('A_EXAMINER')}
              className={`px-3 py-1.5 rounded-[4px] text-xs font-bold transition cursor-pointer shrink-0 ${
                filtreStatut === 'A_EXAMINER'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-white border border-slate-200 text-amber-800 hover:bg-amber-50'
              }`}
            >
              À examiner ({stats.aExaminer})
            </button>
            <button
              type="button"
              onClick={() => setFiltreStatut('CONFORME')}
              className={`px-3 py-1.5 rounded-[4px] text-xs font-bold transition cursor-pointer shrink-0 ${
                filtreStatut === 'CONFORME'
                  ? 'bg-[#16a34a] text-white shadow-2xs'
                  : 'bg-white border border-slate-200 text-[#16a34a] hover:bg-emerald-50'
              }`}
            >
              Conformes ({stats.conforme})
            </button>
            <button
              type="button"
              onClick={() => setFiltreStatut('NON_CONFORME')}
              className={`px-3 py-1.5 rounded-[4px] text-xs font-bold transition cursor-pointer shrink-0 ${
                filtreStatut === 'NON_CONFORME'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-white border border-slate-200 text-rose-700 hover:bg-rose-50'
              }`}
            >
              Rejetées ({stats.nonConforme})
            </button>
          </div>
        </div>

        {/* LISTE DES DOSSIERS D'IDENTITÉ */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Candidat &amp; Contact</th>
                <th className="py-3.5 px-4">Données Déclarées</th>
                <th className="py-3.5 px-4">Pièce CIN Déposée</th>
                <th className="py-3.5 px-4">Statut Contrôle</th>
                <th className="py-3.5 px-4 text-right">Actions de Traitement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dossiersFiltres.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <ShieldCheck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-bold text-slate-700">Aucun dossier d'identité trouvé</p>
                    <p className="text-[11px] text-slate-400">Ajustez les termes de votre recherche ou le filtre de statut sélectionné.</p>
                  </td>
                </tr>
              ) : (
                dossiersFiltres.map((item) => {
                  const doc = item.documentCin;
                  const isDepose = !!doc;
                  const estConforme = item.statut_identite === 'CONFORME';
                  const estRejete = item.statut_identite === 'NON_CONFORME';
                  const estEnAttente = item.statut_identite === 'A_EXAMINER';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Candidat */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 font-serif text-sm">
                          {item.nom} {item.prenom}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {item.email}
                        </div>
                        {item.telephone && (
                          <div className="text-[10px] text-slate-400">
                            Tél: {item.telephone}
                          </div>
                        )}
                      </td>

                      {/* Données déclarées (uniquement les champs du formulaire de scan CNIE validés par le candidat, sans aucune information inventée ou ajoutée) */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5 text-[11px]">
                          {item.nom_declare && (
                            <div>
                              <span className="text-slate-400 text-[10px]">Nom :</span>{' '}
                              <span className="font-bold text-slate-800">{item.nom_declare}</span>
                            </div>
                          )}
                          {item.prenom_declare && (
                            <div>
                              <span className="text-slate-400 text-[10px]">Prénom :</span>{' '}
                              <span className="font-bold text-slate-800">{item.prenom_declare}</span>
                            </div>
                          )}
                          {item.numero_cin && (
                            <div className="font-mono">
                              <span className="text-slate-400 text-[10px] font-sans">CIN :</span>{' '}
                              <span className="font-bold text-[#0f766e]">{item.numero_cin}</span>
                            </div>
                          )}
                          {item.date_naissance && (
                            <div>
                              <span className="text-slate-400 text-[10px]">Date de naissance :</span>{' '}
                              <span className="text-slate-700 font-medium">{formatDateJJMMAAAA(item.date_naissance)}</span>
                            </div>
                          )}
                          {item.lieu_naissance && (
                            <div>
                              <span className="text-slate-400 text-[10px]">Lieu de naissance :</span>{' '}
                              <span className="text-slate-700 font-medium">{item.lieu_naissance}</span>
                            </div>
                          )}
                          {item.date_validite_cin && (
                            <div>
                              <span className="text-slate-400 text-[10px]">Date de validité :</span>{' '}
                              <span className="text-slate-700 font-medium">{formatDateJJMMAAAA(item.date_validite_cin)}</span>
                            </div>
                          )}
                          {item.adresse && (
                            <div>
                              <span className="text-slate-400 text-[10px]">Adresse :</span>{' '}
                              <span className="text-slate-700 font-medium">{item.adresse}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Fichier CIN téléversé + résultat du contrôle automatique après soumission */}
                      <td className="py-3.5 px-4">
                        {isDepose ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 font-bold text-slate-800">
                              <FileText className="w-3.5 h-3.5 text-[#0f766e] shrink-0" />
                              <span className="truncate max-w-[190px]" title={doc.nom_fichier}>
                                {doc.nom_fichier}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1.5 font-mono">
                              <span>{formatTailleFichier(doc.taille_octets, doc.taille_mo)}</span>
                              {doc.page_count !== undefined && (
                                <>
                                  <span>&bull;</span>
                                  <span>
                                    {doc.page_count} page{doc.page_count > 1 ? 's' : ''}
                                    {doc.page_count === 2 ? ' (Recto/Verso)' : ''}
                                  </span>
                                </>
                              )}
                              <span>&bull;</span>
                              <span>Déposé le {formatDateJJMMAAAA(doc.date_depot)}</span>
                            </div>

                            {item.candidatureStatut && item.candidatureStatut !== 'BROUILLON' && (
                              <div className="pt-1 space-y-1">
                                {doc.controle_conformite?.statut === 'CONFORME' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-emerald-50 text-[#16a34a] border border-emerald-200">
                                    <Check className="w-3 h-3 stroke-[2.5]" />
                                    Contrôle auto : Conforme
                                  </span>
                                )}
                                {doc.controle_conformite?.statut === 'A_VERIFIER' && (
                                  <div className="space-y-1 max-w-xs">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                                      Contrôle auto : À vérifier
                                    </span>
                                    {doc.controle_conformite.motif && (
                                      <p className="text-[10px] text-amber-900 bg-amber-50/70 p-1.5 rounded-[4px] border border-amber-200 line-clamp-2">
                                        {doc.controle_conformite.motif}
                                      </p>
                                    )}
                                  </div>
                                )}
                                {doc.controle_conformite?.statut === 'A_CORRIGER' && (
                                  <div className="space-y-1 max-w-xs">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-300">
                                      <XCircle className="w-3 h-3 text-rose-600" />
                                      Contrôle auto : À corriger
                                    </span>
                                    {doc.controle_conformite.motif && (
                                      <p className="text-[10px] text-rose-900 bg-rose-50/70 p-1.5 rounded-[4px] border border-rose-200 line-clamp-2">
                                        {doc.controle_conformite.motif}
                                      </p>
                                    )}
                                  </div>
                                )}
                                {item.documentsCandidature && item.documentsCandidature.length > 0 && (
                                  <div>
                                    <button
                                      type="button"
                                      onClick={() => setModalControlePieces(item)}
                                      className="text-[10px] font-bold text-[#0f766e] hover:underline cursor-pointer"
                                    >
                                      Résultats contrôle des {item.documentsCandidature.length} pièces &rarr;
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-slate-400 text-[11px] italic flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-300" />
                            <span>Pièce non déposée</span>
                          </div>
                        )}
                      </td>

                      {/* Statut du contrôle */}
                      <td className="py-3.5 px-4">
                        <div>
                          {estConforme && (
                            <span className="px-2.5 py-1 rounded-[4px] font-bold text-[10px] bg-emerald-50 text-[#16a34a] border border-[#16a34a]/30 inline-flex items-center gap-1">
                              <Check className="w-3 h-3 text-[#16a34a] stroke-[2.5]" />
                              <span>Conforme (Validé)</span>
                            </span>
                          )}
                          {estRejete && (
                            <div className="space-y-1 max-w-xs">
                              <span className="px-2.5 py-1 rounded-[4px] font-bold text-[10px] bg-rose-50 text-rose-700 border border-rose-300 inline-flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                <span>Non conforme (Rejeté)</span>
                              </span>
                              {item.motif_identite && (
                                <p className="text-[10px] text-rose-800 bg-rose-50 p-1.5 rounded-[4px] border border-rose-200 line-clamp-2">
                                  <strong>Motif :</strong> {item.motif_identite}
                                </p>
                              )}
                            </div>
                          )}
                          {estEnAttente && (
                            <span className="px-2.5 py-1 rounded-[4px] font-bold text-[10px] bg-amber-50 text-amber-800 border border-amber-300 inline-flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>En attente de contrôle</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {/* Bouton Voir / Consulter la CIN (PDF) */}
                          <button
                            type="button"
                            disabled={!isDepose || !doc?.fichier_url}
                            onClick={() => handleConsulterCin(item)}
                            className="bg-white border border-slate-300 hover:border-[#0f766e] hover:text-[#0f766e] disabled:opacity-45 disabled:hover:border-slate-300 disabled:hover:text-slate-700 disabled:cursor-not-allowed text-slate-700 px-3 py-1.5 rounded-[4px] font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                            title={isDepose && doc?.fichier_url ? "Voir le fichier PDF original déposé par le candidat" : "Pièce non déposée"}
                          >
                            <Eye className="w-3.5 h-3.5 text-[#0f766e]" />
                            <span>Voir la CIN</span>
                          </button>

                          {/* Bouton Valider (Conforme) */}
                          <button
                            type="button"
                            onClick={() => handleValiderConforme(item)}
                            className={`px-3 py-1.5 rounded-[4px] font-bold text-xs inline-flex items-center gap-1 transition cursor-pointer shadow-2xs ${
                              estConforme
                                ? 'bg-[#16a34a] text-white cursor-default'
                                : 'bg-white border border-emerald-300 text-[#16a34a] hover:bg-emerald-50'
                            }`}
                            title="Valider la conformité de l'identité"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Valider</span>
                          </button>

                          {/* Bouton Rejeter (Non conforme) */}
                          <button
                            type="button"
                            onClick={() => handleOuvrirRejet(item)}
                            className={`px-3 py-1.5 rounded-[4px] font-bold text-xs inline-flex items-center gap-1 transition cursor-pointer shadow-2xs ${
                              estRejete
                                ? 'bg-rose-600 text-white'
                                : 'bg-white border border-rose-300 text-rose-700 hover:bg-rose-50'
                            }`}
                            title="Rejeter la pièce pour non-conformité"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Rejeter</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* BASE SIMULÉE D'ÉTUDIANTS DE L'USMBA (ANNUAIRE SCOLARITÉ / APOGÉE)    */}
      {/* ==================================================================== */}
      <div className="bg-white rounded-[6px] border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#0f766e] uppercase tracking-wider font-mono">
              <Database className="w-4 h-4 text-[#0f766e]" />
              Référentiel Académique USMBA (Simulation Apogée)
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 font-serif mt-0.5">
              Base simulée d’étudiants de l’USMBA
            </h2>
            <p className="text-[11px] text-slate-500">
              Liste de référence des étudiants de l'Université Sidi Mohamed Ben Abdellah (Nom, Prénom, CNE / Massar, E-mail institutionnel, Filière).
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={rechercheEtudiantsUSMBA}
                onChange={(e) => setRechercheEtudiantsUSMBA(e.target.value)}
                placeholder="Filtrer par nom, CNE, e-mail, filière..."
                className="w-full pl-9 pr-8 py-2 text-xs rounded-[6px] border border-slate-200 bg-white focus:ring-2 focus:ring-[#0f766e] focus:outline-none"
              />
              {rechercheEtudiantsUSMBA && (
                <button
                  type="button"
                  onClick={() => setRechercheEtudiantsUSMBA('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <span className="text-xs font-mono font-bold bg-[#f0fdfa] text-[#0f766e] border border-[#ccfbf1] px-2.5 py-1.5 rounded-[6px] shrink-0">
              {etudiantsUSMBAFiltres.length} / {etudiantsUSMBA.length}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Nom</th>
                <th className="py-3 px-4">Prénom</th>
                <th className="py-3 px-4">CNE / Massar</th>
                <th className="py-3 px-4">E-mail institutionnel</th>
                <th className="py-3 px-4">Filière</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {etudiantsUSMBAFiltres.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Aucun étudiant trouvé dans la base simulée de l'USMBA.
                  </td>
                </tr>
              ) : (
                etudiantsUSMBAFiltres.map((etu) => (
                  <tr key={etu.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 font-serif">
                      {etu.nom}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {etu.prenom}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-[#0f766e]">
                      {etu.cne}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {etu.email}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                        <GraduationCap className="w-3.5 h-3.5 text-[#0f766e] shrink-0" />
                        <span>{etu.filiere}</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE SAISIE DU MOTIF DE REJET */}
      {modalRejet.isOpen && modalRejet.item && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[6px] max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 font-serif flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Rejet de la pièce d'identité : {modalRejet.item.nom} {modalRejet.item.prenom}</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalRejet({ isOpen: false, item: null, motif: '', erreur: '' })}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Veuillez préciser le motif réglementaire de non-conformité. Ce commentaire sera notifié au candidat 
              et affiché sur sa pièce dans son espace pour lui permettre de déposer une copie conforme.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">
                Motif précis du rejet <span className="text-rose-600">*</span> :
              </label>
              <textarea
                rows={3}
                value={modalRejet.motif}
                onChange={(e) => setModalRejet(prev => ({ ...prev, motif: e.target.value, erreur: '' }))}
                placeholder="Ex : Document illisible, recto ou verso manquant, numéro de CIN discordant avec l'état civil déclaré..."
                className="w-full text-xs p-2.5 border border-slate-200 rounded-[6px] bg-white focus:ring-2 focus:ring-[#0f766e] focus:outline-none"
              />
              {modalRejet.erreur && (
                <p className="text-xs text-rose-600 font-semibold">{modalRejet.erreur}</p>
              )}
            </div>

            {/* Suggestions de motifs rapides */}
            <div className="space-y-1 pt-1">
              <span className="text-[11px] font-semibold text-slate-500">Motifs fréquents :</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Document recto/verso incomplet",
                  "Qualité du scan illisible",
                  "Discordance numéro CIN / données déclarées",
                  "Carte d'identité expirée"
                ].map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setModalRejet(prev => ({ ...prev, motif: sug, erreur: '' }))}
                    className="text-[10px] px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setModalRejet({ isOpen: false, item: null, motif: '', erreur: '' })}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-[6px] text-xs font-bold transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmerRejet}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-[6px] text-xs font-bold transition cursor-pointer shadow-2xs"
              >
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LECTURE SEULE DES RÉSULTATS DU CONTRÔLE DES PIÈCES (APRÈS SOUMISSION) */}
      {modalControlePieces && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[6px] max-w-2xl w-full p-6 space-y-4 shadow-xl border border-slate-200 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 font-serif">
                  Contrôle de conformité des pièces — {modalControlePieces.nom} {modalControlePieces.prenom}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Résultat indicatif du contrôle automatique après soumission. La décision du service de scolarité reste la seule officielle.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalControlePieces(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {(modalControlePieces.documentsCandidature || []).map((doc) => {
                const ctrl = doc.controle_conformite;
                return (
                  <div
                    key={doc.id}
                    className="p-3 rounded-[4px] border border-slate-200 bg-slate-50/70 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-slate-900">{doc.type}</span>
                      {ctrl?.statut === 'CONFORME' ? (
                        <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-emerald-50 text-[#16a34a] border border-emerald-200">
                          Conforme
                        </span>
                      ) : ctrl?.statut === 'A_CORRIGER' ? (
                        <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-300">
                          À corriger
                        </span>
                      ) : ctrl?.statut === 'A_VERIFIER' ? (
                        <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                          À vérifier
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          Non contrôlé
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {doc.nom_fichier} &bull; {formatTailleFichier(doc.taille_octets, doc.taille_mo)}
                    </div>
                    {ctrl?.motif && (
                      <p
                        className={`text-[11px] p-2 rounded-[4px] border font-medium ${
                          ctrl.statut === 'A_CORRIGER'
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : 'bg-amber-50 text-amber-900 border-amber-200'
                        }`}
                      >
                        {ctrl.motif}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setModalControlePieces(null)}
                className="px-4 py-2 bg-[#0f766e] hover:bg-[#115e59] text-white rounded-[6px] text-xs font-bold cursor-pointer transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VISUALISEUR DU PDF DE LA CIN (RECTO ET VERSO) */}
      <ModalVisualiseurPdf
        isOpen={viewerPdf.isOpen}
        docTitle={viewerPdf.docTitle}
        fileName={viewerPdf.fileName}
        pdfUrl={viewerPdf.pdfUrl}
        statut={viewerPdf.statut}
        motifRejet={viewerPdf.motifRejet}
        candidatNom={viewerPdf.candidatNom}
        cin={viewerPdf.cin}
        pageCount={viewerPdf.pageCount}
        onClose={() => setViewerPdf(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

import React, { useState } from 'react';
import { 
  Calendar, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  FileText, 
  Users, 
  BarChart3, 
  PlusCircle, 
  Power, 
  ShieldCheck, 
  UserCheck, 
  FolderGit2, 
  Info,
  Check,
  Building,
  GraduationCap,
  Search,
  X
} from 'lucide-react';
import { 
  VersionCampagne, 
  SujetThese, 
  Candidature, 
  PersonneIdentite, 
  UserAccount, 
  EntreeHistoriqueVersion,
  ProfilRole,
  STATUT_LABELS
} from '../types';
import { formatDateJJMMAAAA, getCampagneBadge } from '../utils/dateUtils';
import { BadgeCampagne } from './BadgeCampagne';

interface AdminEDViewProps {
  campagneVersion: VersionCampagne;
  sujets: SujetThese[];
  candidatures: Candidature[];
  personnes: PersonneIdentite[];
  users: UserAccount[];
  historiqueVersions: EntreeHistoriqueVersion[];
  onCreerNouvelleVersion: (version: VersionCampagne, entree: EntreeHistoriqueVersion) => void;
  onAddPersonnel: (user: UserAccount) => void;
  onTogglePersonnelStatus: (userId: string) => void;
}

export const AdminEDView: React.FC<AdminEDViewProps> = ({
  campagneVersion,
  sujets,
  candidatures,
  personnes,
  users,
  historiqueVersions,
  onCreerNouvelleVersion,
  onAddPersonnel,
  onTogglePersonnelStatus
}) => {
  // Navigation entre les 3 onglets demandés : (a) Campagne, (b) Suivi, (c) Comptes du personnel
  const [activeTab, setActiveTab] = useState<'campagne' | 'suivi' | 'personnel'>('campagne');

  // ============================================================================
  // ÉTAT POUR L'ONGLET (a) « CAMPAGNE » : Dates et Règles modifiables
  // ============================================================================
  const [formDateOuverture, setFormDateOuverture] = useState(campagneVersion.date_ouverture);
  const [formDateCloture, setFormDateCloture] = useState(campagneVersion.date_cloture);
  const [formMaxSujets, setFormMaxSujets] = useState(campagneVersion.nombre_max_sujets);
  const [formDelaiInscription, setFormDelaiInscription] = useState(campagneVersion.delai_inscription_jours);
  const [formTailleFichier, setFormTailleFichier] = useState(campagneVersion.taille_max_fichier_mo);
  const [formMotif, setFormMotif] = useState('');
  const [campagneSuccessMsg, setCampagneSuccessMsg] = useState('');
  const [campagneErrorMsg, setCampagneErrorMsg] = useState('');

  // ============================================================================
  // ÉTAT POUR L'ONGLET (c) « COMPTES DU PERSONNEL » : Création & Recherche
  // ============================================================================
  const [nomPersonnel, setNomPersonnel] = useState('');
  const [prenomPersonnel, setPrenomPersonnel] = useState('');
  const [emailPersonnel, setEmailPersonnel] = useState('');
  const [rolePersonnel, setRolePersonnel] = useState<ProfilRole>('DIRECTEUR_THESE');
  const [etablissementPersonnel, setEtablissementPersonnel] = useState('Faculté des Sciences Dhar El Mahraz');
  const [personnelError, setPersonnelError] = useState('');
  const [personnelSuccess, setPersonnelSuccess] = useState('');
  const [recherchePersonnel, setRecherchePersonnel] = useState('');

  // ----------------------------------------------------------------------------
  // SOUMISSION NOUVELLE VERSION DE CAMPAGNE (ONGLET A)
  // ----------------------------------------------------------------------------
  const handleEnregistrerCampagne = (e: React.FormEvent) => {
    e.preventDefault();
    setCampagneErrorMsg('');
    setCampagneSuccessMsg('');

    if (!formMotif.trim()) {
      setCampagneErrorMsg("Le motif officiel de modification est strictement obligatoire pour publier une nouvelle version.");
      return;
    }

    if (!formDateOuverture || !formDateCloture) {
      setCampagneErrorMsg("Les dates d'ouverture et de clôture sont obligatoires.");
      return;
    }

    if (formDateCloture < formDateOuverture) {
      setCampagneErrorMsg("La date de clôture ne peut pas être antérieure à la date d'ouverture.");
      return;
    }

    const nextVersionNum = historiqueVersions.length + 1;
    const newVersionId = `v-2026-${nextVersionNum}`;
    const dateJour = new Date().toISOString().split('T')[0];

    // Description textuelle des modifications pour l'historique
    const modifs: string[] = [];
    if (formDateCloture !== campagneVersion.date_cloture) {
      modifs.push(`Clôture: ${formatDateJJMMAAAA(formDateCloture)}`);
    }
    if (formDateOuverture !== campagneVersion.date_ouverture) {
      modifs.push(`Ouverture: ${formatDateJJMMAAAA(formDateOuverture)}`);
    }
    if (formMaxSujets !== campagneVersion.nombre_max_sujets) {
      modifs.push(`Max ${formMaxSujets} sujets`);
    }
    if (formDelaiInscription !== campagneVersion.delai_inscription_jours) {
      modifs.push(`Délai dépôt ${formDelaiInscription} j.`);
    }
    if (formTailleFichier !== campagneVersion.taille_max_fichier_mo) {
      modifs.push(`Fichiers max ${formTailleFichier} Mo`);
    }

    const modifTexte = modifs.length > 0 
      ? modifs.join(', ') 
      : `Actualisation paramètres (Clôture: ${formatDateJJMMAAAA(formDateCloture)}, ${formMaxSujets} sujets max, ${formDelaiInscription}j, ${formTailleFichier}Mo)`;

    const nouvelleCampagne: VersionCampagne = {
      ...campagneVersion,
      id: newVersionId,
      date_ouverture: formDateOuverture,
      date_cloture: formDateCloture,
      date_modification: dateJour,
      motif_modification: formMotif.trim(),
      nombre_max_sujets: Number(formMaxSujets),
      delai_inscription_jours: Number(formDelaiInscription),
      taille_max_fichier_mo: Number(formTailleFichier),
      format_fichier_autorise: 'PDF',
      modifie_par: 'Direction CEDoc (Conseil de l\'Université)'
    };

    const nouvelleEntreeHistorique: EntreeHistoriqueVersion = {
      version: newVersionId,
      date: dateJour,
      auteur: 'Direction CEDoc (Conseil de l\'Université)',
      modification: modifTexte,
      motif: formMotif.trim()
    };

    onCreerNouvelleVersion(nouvelleCampagne, nouvelleEntreeHistorique);
    setCampagneSuccessMsg(`Version ${newVersionId} enregistrée et diffusée avec succès à toute la plateforme.`);
    setFormMotif('');
  };

  // ----------------------------------------------------------------------------
  // SOUMISSION CRÉATION COMPTE PERSONNEL (ONGLET C)
  // ----------------------------------------------------------------------------
  const handleCreerPersonnel = (e: React.FormEvent) => {
    e.preventDefault();
    setPersonnelError('');
    setPersonnelSuccess('');

    if (!nomPersonnel.trim() || !prenomPersonnel.trim() || !emailPersonnel.trim()) {
      setPersonnelError("Veuillez renseigner le nom, prénom et email du membre du personnel.");
      return;
    }

    const emailTrim = emailPersonnel.trim().toLowerCase();
    if (!emailTrim.endsWith('@usmba.ac.ma')) {
      setPersonnelError("L'adresse email du personnel doit être une adresse académique (@usmba.ac.ma).");
      return;
    }

    if (users.some(u => u.email.toLowerCase() === emailTrim)) {
      setPersonnelError("Un compte existe déjà avec cette adresse email.");
      return;
    }

    const nouveauCompte: UserAccount = {
      id: `user-staff-${Date.now()}`,
      nom: nomPersonnel.trim().toUpperCase(),
      prenom: prenomPersonnel.trim(),
      email: emailTrim,
      role: rolePersonnel,
      isAcademicUSMBA: true,
      etablissement: etablissementPersonnel,
      statut_compte: 'ACTIF',
      password: 'Personnel2026!'
    };

    onAddPersonnel(nouveauCompte);
    setPersonnelSuccess(`Compte pour ${nouveauCompte.prenom} ${nouveauCompte.nom} (${roleLabels[nouveauCompte.role]}) créé avec succès.`);
    setNomPersonnel('');
    setPrenomPersonnel('');
    setEmailPersonnel('');
  };

  // ----------------------------------------------------------------------------
  // CALCUL DES INDICATEURS DE SUIVI (ONGLET B)
  // ----------------------------------------------------------------------------
  const badgeCampagne = getCampagneBadge(campagneVersion);

  // 1. Dossiers par statut
  const nbBrouillon = candidatures.filter(c => c.statut === 'BROUILLON').length;
  const nbSoumise = candidatures.filter(c => c.statut === 'SOUMISE').length;
  const nbEnExamen = candidatures.filter(c => c.statut === 'EN_EXAMEN').length;
  const nbACompleter = candidatures.filter(c => c.statut === 'CORRECTION_DEMANDEE').length;
  const nbAdmis = candidatures.filter(c => c.statut === 'ACCEPTEE').length;
  const nbRefusee = candidatures.filter(c => c.statut === 'REFUSEE').length;
  const totalDossiers = candidatures.length;

  // 2. Sujets accrédités et en attente
  const sujetsAccredites = sujets.filter(s => s.statut === 'VALIDE');
  const sujetsEnAttente = sujets.filter(s => s.statut === 'PROPOSE');
  const totalSujets = sujets.length;

  // 3. Places ouvertes
  const totalPlacesOuvertes = sujetsAccredites.reduce((sum, s) => sum + s.nombre_places, 0);

  // 4. Dossiers en attente de contrôle d'identité
  const nbIdentiteAExaminer = personnes.filter(p => p.statut_identite === 'A_EXAMINER').length;
  const nbIdentiteConforme = personnes.filter(p => p.statut_identite === 'CONFORME').length;

  // Filtrage des comptes du personnel pour l'onglet C (exclut les candidats)
  const personnelUsers = users.filter(u => u.role !== 'CANDIDAT');

  const roleLabels: Record<ProfilRole, string> = {
    VISITEUR: 'Visiteur',
    CANDIDAT: 'Candidat',
    DIRECTEUR_THESE: 'Directeur de Thèse',
    DIRECTEUR_STRUCTURE: 'Direction de Structure',
    AGENT_ADMIN: 'Contrôle Identité & Scolarité',
    ADMIN_ED: 'Administration Centrale CEDoc'
  };

  const normalizeSearch = (str: string) =>
    (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  // Filtrage des comptes du personnel par nom, e-mail ou rôle
  const personnelUsersFiltres = personnelUsers.filter((u) => {
    if (!recherchePersonnel.trim()) return true;
    const q = normalizeSearch(recherchePersonnel);
    const roleLabel = roleLabels[u.role] || '';
    const searchable = normalizeSearch(
      `${u.nom} ${u.prenom} ${u.prenom} ${u.nom} ${u.email} ${u.role} ${roleLabel} ${u.etablissement || ''}`
    );
    return searchable.includes(q);
  });

  return (
    <div className="space-y-6 pb-16">
      
      {/* En-tête Principal de l'Espace Administration */}
      <div className="bg-white p-6 sm:p-8 rounded-[6px] border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#0f766e] uppercase tracking-wider">
            <Layers className="w-4 h-4" />
            Centre des Études Doctorales &bull; Présidence USMBA
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight font-serif">
              Espace Administration Centrale
            </h1>
            <BadgeCampagne campagne={campagneVersion} />
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Gestion institutionnelle de la campagne, indicateurs temps réel et administration des accès du personnel
          </p>
        </div>

        {/* Info version active */}
        <div className="text-right hidden sm:block">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Version Active</div>
          <div className="text-sm font-mono font-bold text-[#0f766e]">{campagneVersion.id}</div>
          <div className="text-[11px] text-slate-500">Mise à jour : {formatDateJJMMAAAA(campagneVersion.date_modification)}</div>
        </div>
      </div>

      {/* Navigation par Onglets : (a) Campagne | (b) Suivi | (c) Comptes du personnel */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px">
        <button
          onClick={() => setActiveTab('campagne')}
          className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'campagne'
              ? 'border-[#0f766e] text-[#0f766e] bg-[#f0fdfa] rounded-t-[6px]'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>(a) Campagne</span>
          <span className="text-[10px] font-mono bg-[#f0fdfa] text-[#0f766e] border border-[#ccfbf1] px-1.5 py-0.5 rounded-[4px]">
            {campagneVersion.id}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('suivi')}
          className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'suivi'
              ? 'border-[#0f766e] text-[#0f766e] bg-[#f0fdfa] rounded-t-[6px]'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>(b) Suivi</span>
          <span className="text-[10px] font-mono bg-emerald-50 text-[#16a34a] border border-[#16a34a]/30 px-1.5 py-0.5 rounded-[4px]">
            {totalDossiers} dossiers
          </span>
        </button>

        <button
          onClick={() => setActiveTab('personnel')}
          className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'personnel'
              ? 'border-[#0f766e] text-[#0f766e] bg-[#f0fdfa] rounded-t-[6px]'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>(c) Comptes du personnel</span>
          <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-[4px]">
            {personnelUsers.length}
          </span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* ONGLET (a) « CAMPAGNE »                                             */}
      {/* ==================================================================== */}
      {activeTab === 'campagne' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          
          {/* Notifications de succès / erreur */}
          {campagneSuccessMsg && (
            <div className="p-4 rounded-[6px] bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#16a34a] shrink-0" />
                <span>{campagneSuccessMsg}</span>
              </div>
              <button onClick={() => setCampagneSuccessMsg('')} className="text-emerald-700 hover:text-emerald-900">
                &times;
              </button>
            </div>
          )}

          {campagneErrorMsg && (
            <div className="p-4 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{campagneErrorMsg}</span>
            </div>
          )}

          {/* Formulaire de Modification des Dates et Règles */}
          <div className="bg-white p-6 sm:p-8 rounded-[6px] border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 font-serif">
                  Paramétrage Officiel de la Campagne &amp; Règles Cadres
                </h2>
                <p className="text-xs text-slate-500">
                  Chaque modification met à jour l'objet centralisé lu par toute l'application et génère une version horodatée.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-[#0f766e] bg-[#f0fdfa] px-3 py-1 rounded-[6px] border border-[#ccfbf1] self-start">
                Version courante : {campagneVersion.id}
              </span>
            </div>

            <form onSubmit={handleEnregistrerCampagne} className="space-y-6">
              
              {/* Grille des Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-[6px] bg-slate-50 border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    Date d'ouverture officielle *
                  </label>
                  <input
                    type="date"
                    value={formDateOuverture}
                    onChange={(e) => setFormDateOuverture(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-[6px] text-xs font-mono font-bold focus:ring-2 focus:ring-[#0f766e] focus:outline-none"
                    required
                  />
                  <span className="text-[10px] text-slate-400 block">
                    Format officiel : {formatDateJJMMAAAA(formDateOuverture)}
                  </span>
                </div>

                <div className="p-4 rounded-[6px] bg-slate-50 border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    Date limite de clôture officielle *
                  </label>
                  <input
                    type="date"
                    value={formDateCloture}
                    onChange={(e) => setFormDateCloture(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-[6px] text-xs font-mono font-bold text-rose-700 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    required
                  />
                  <span className="text-[10px] text-slate-400 block">
                    Format officiel : {formatDateJJMMAAAA(formDateCloture)} ({badgeCampagne.texte})
                  </span>
                </div>
              </div>

              {/* Grille des Règles : Max sujets, Délai inscription, Taille max fichiers */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-[6px] bg-slate-50 border border-slate-200 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    Nombre max de sujets par candidat
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={formMaxSujets}
                      onChange={(e) => setFormMaxSujets(Number(e.target.value))}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-[6px] text-xs font-bold font-mono focus:ring-2 focus:ring-[#0f766e] focus:outline-none"
                      required
                    />
                    <span className="text-xs text-slate-500 shrink-0 font-medium">sujets</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    Priorisation obligatoire de 1 à {formMaxSujets}
                  </span>
                </div>

                <div className="p-4 rounded-[6px] bg-slate-50 border border-slate-200 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    Délai d'inscription définitive
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={formDelaiInscription}
                      onChange={(e) => setFormDelaiInscription(Number(e.target.value))}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-[6px] text-xs font-bold font-mono focus:ring-2 focus:ring-[#0f766e] focus:outline-none"
                      required
                    />
                    <span className="text-xs text-slate-500 shrink-0 font-medium">jours ouvrés</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    Pour le dépôt du récépissé papier légalisé
                  </span>
                </div>

                <div className="p-4 rounded-[6px] bg-slate-50 border border-slate-200 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    Taille max des fichiers justificatifs
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={formTailleFichier}
                      onChange={(e) => setFormTailleFichier(Number(e.target.value))}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-[6px] text-xs font-bold font-mono focus:ring-2 focus:ring-[#0f766e] focus:outline-none"
                      required
                    />
                    <span className="text-xs text-slate-500 shrink-0 font-medium">Mo (PDF)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    Format PDF exclusif, max {formTailleFichier} Mo par pièce
                  </span>
                </div>
              </div>

              {/* Champ Motif OBLIGATOIRE */}
              <div className="p-4 rounded-[6px] bg-amber-50/70 border border-amber-200 space-y-2">
                <label className="block text-xs font-black text-amber-950">
                  Motif formel de révision de la campagne <span className="text-rose-600">* (Obligatoire)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex : Prorogation de la date de clôture suite à la délibération du Conseil de l'Université, ajustement des capacités..."
                  value={formMotif}
                  onChange={(e) => {
                    setFormMotif(e.target.value);
                    if (campagneErrorMsg) setCampagneErrorMsg('');
                  }}
                  className="w-full p-3 bg-white border border-amber-300 rounded-[6px] text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
                <p className="text-[10px] text-amber-800 leading-tight">
                  Toute modification de date ou de règle exige une traçabilité institutionnelle enregistrée dans l'historique des versions.
                </p>
              </div>

              {/* Bouton de soumission */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-6 py-3 bg-[#0f766e] hover:bg-[#115e59] text-white rounded-[6px] text-xs sm:text-sm font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-center gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Enregistrer et publier la nouvelle version</span>
                </button>
              </div>
            </form>
          </div>

          {/* TABLEAU : HISTORIQUE DES VERSIONS */}
          <div className="bg-white p-6 sm:p-8 rounded-[6px] border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 font-serif">
                  Historique des Versions de la Campagne
                </h3>
                <p className="text-xs text-slate-500">
                  Journal officiel des révisions réglementaires et arrêtés d'application
                </p>
              </div>
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-[6px]">
                {historiqueVersions.length} révision{historiqueVersions.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50/70">
                    <th className="py-3 px-3">Version</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Auteur</th>
                    <th className="py-3 px-3">Modification(s)</th>
                    <th className="py-3 px-3">Motif officiel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historiqueVersions.map((entree, idx) => {
                    const isCurrent = entree.version === campagneVersion.id;
                    return (
                      <tr key={entree.version + idx} className={`hover:bg-slate-50/80 transition-colors ${isCurrent ? 'bg-[#f0fdfa]' : ''}`}>
                        <td className="py-3 px-3 font-mono font-bold text-[#0f766e] whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            {entree.version}
                            {isCurrent && (
                              <span className="text-[10px] font-sans font-extrabold bg-[#0f766e] text-white px-1.5 py-0.2 rounded-[4px]">
                                En vigueur
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                          {formatDateJJMMAAAA(entree.date)}
                        </td>
                        <td className="py-3 px-3 text-slate-700 font-medium">
                          {entree.auteur}
                        </td>
                        <td className="py-3 px-3 text-slate-900 font-semibold">
                          {entree.modification}
                        </td>
                        <td className="py-3 px-3 text-slate-600 italic">
                          "{entree.motif}"
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rappel des 4 étapes réglementaires */}
          <div className="bg-white p-6 sm:p-8 rounded-[6px] border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 font-serif">
              Les 4 Étapes Réglementaires (Centralisées dans l'objet unique)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {campagneVersion.etapes.map((etape) => (
                <div key={etape.numero} className="p-4 rounded-[6px] bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#0f766e] text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {etape.numero}
                    </span>
                    <span className="font-bold text-slate-900 text-xs">
                      {etape.titre}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {etape.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ==================================================================== */}
      {/* ONGLET (b) « SUIVI » : Indicateurs calculés depuis les données      */}
      {/* ==================================================================== */}
      {activeTab === 'suivi' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          
          {/* Cartes Synthétiques d'Indicateurs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Clôture & Jours restants */}
            <div className="bg-white p-5 rounded-[6px] border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Délai de Campagne</span>
                <Clock className="w-4 h-4 text-[#0f766e]" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {badgeCampagne.estOuverte ? `${badgeCampagne.joursRestants} jours` : '0 jour'}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center justify-between">
                <span>Clôture : {formatDateJJMMAAAA(campagneVersion.date_cloture)}</span>
                <BadgeCampagne campagne={campagneVersion} showIcon={false} className="text-[10px] py-0.5 px-2" />
              </div>
            </div>

            {/* Places ouvertes */}
            <div className="bg-white p-5 rounded-[6px] border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Places Ouvertes</span>
                <GraduationCap className="w-4 h-4 text-[#16a34a]" />
              </div>
              <div className="text-2xl font-black text-[#16a34a]">
                {totalPlacesOuvertes} postes
              </div>
              <div className="text-[11px] text-slate-500">
                Sur les {sujetsAccredites.length} sujets accrédités
              </div>
            </div>

            {/* Sujets de Thèse */}
            <div className="bg-white p-5 rounded-[6px] border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Sujets de Thèse</span>
                <FolderGit2 className="w-4 h-4 text-[#0f766e]" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {totalSujets} sujets
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <span className="text-[#16a34a] font-bold">{sujetsAccredites.length} accrédités</span>
                <span>&bull;</span>
                <span className="text-amber-700 font-bold">{sujetsEnAttente.length} en attente</span>
              </div>
            </div>

            {/* Contrôle d'Identité */}
            <div className="bg-white p-5 rounded-[6px] border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Contrôle d'Identité</span>
                <UserCheck className="w-4 h-4 text-[#0f766e]" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {nbIdentiteAExaminer} en attente
              </div>
              <div className="text-[11px] text-slate-500">
                {nbIdentiteConforme} conformes vérifiés
              </div>
            </div>

          </div>

          {/* Grille : Répartition des Dossiers par Statut */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Tableau & Barres : Dossiers par statut */}
            <div className="bg-white p-6 sm:p-8 rounded-[6px] border border-slate-200 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-slate-900 font-serif">
                  Dossiers de Candidature par Statut
                </h3>
                <span className="text-xs font-mono font-bold bg-[#f0fdfa] text-[#0f766e] px-2.5 py-1 rounded-[6px] border border-[#ccfbf1]">
                  Total : {totalDossiers} dossiers
                </span>
              </div>

              <div className="space-y-3.5 text-xs">
                
                {/* Brouillon */}
                <div className="space-y-1">
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-600">Brouillon (dossier en cours d'élaboration) :</span>
                    <strong className="text-slate-900 font-mono">{nbBrouillon} ({totalDossiers > 0 ? Math.round((nbBrouillon / totalDossiers) * 100) : 0}%)</strong>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-400 rounded-full" style={{ width: `${totalDossiers > 0 ? (nbBrouillon / totalDossiers) * 100 : 0}%` }}></div>
                  </div>
                </div>

                {/* Soumise */}
                <div className="space-y-1">
                  <div className="flex justify-between font-semibold">
                    <span className="text-sky-700">Soumise (en attente de prise en charge) :</span>
                    <strong className="text-sky-900 font-mono">{nbSoumise} ({totalDossiers > 0 ? Math.round((nbSoumise / totalDossiers) * 100) : 0}%)</strong>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-500 rounded-full" style={{ width: `${totalDossiers > 0 ? (nbSoumise / totalDossiers) * 100 : 0}%` }}></div>
                  </div>
                </div>

                {/* En examen */}
                <div className="space-y-1">
                  <div className="flex justify-between font-semibold">
                    <span className="text-[#0f766e]">En examen (instruction scientifique) :</span>
                    <strong className="text-[#0f766e] font-mono">{nbEnExamen} ({totalDossiers > 0 ? Math.round((nbEnExamen / totalDossiers) * 100) : 0}%)</strong>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#0f766e] rounded-full" style={{ width: `${totalDossiers > 0 ? (nbEnExamen / totalDossiers) * 100 : 0}%` }}></div>
                  </div>
                </div>

                {/* À compléter */}
                <div className="space-y-1">
                  <div className="flex justify-between font-semibold">
                    <span className="text-amber-700">À compléter (correction demandée) :</span>
                    <strong className="text-amber-900 font-mono">{nbACompleter} ({totalDossiers > 0 ? Math.round((nbACompleter / totalDossiers) * 100) : 0}%)</strong>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${totalDossiers > 0 ? (nbACompleter / totalDossiers) * 100 : 0}%` }}></div>
                  </div>
                </div>

                {/* Admis */}
                <div className="space-y-1">
                  <div className="flex justify-between font-semibold">
                    <span className="text-[#16a34a]">Admis (Avis favorable définitif) :</span>
                    <strong className="text-[#16a34a] font-mono">{nbAdmis} ({totalDossiers > 0 ? Math.round((nbAdmis / totalDossiers) * 100) : 0}%)</strong>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#16a34a] rounded-full" style={{ width: `${totalDossiers > 0 ? (nbAdmis / totalDossiers) * 100 : 0}%` }}></div>
                  </div>
                </div>

                {/* Non retenue */}
                <div className="space-y-1">
                  <div className="flex justify-between font-semibold">
                    <span className="text-rose-700">Non retenue (Défavorable) :</span>
                    <strong className="text-rose-900 font-mono">{nbRefusee} ({totalDossiers > 0 ? Math.round((nbRefusee / totalDossiers) * 100) : 0}%)</strong>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full" style={{ width: `${totalDossiers > 0 ? (nbRefusee / totalDossiers) * 100 : 0}%` }}></div>
                  </div>
                </div>

              </div>
            </div>

            {/* Sujets & Capacités d'accueil */}
            <div className="bg-white p-6 sm:p-8 rounded-[6px] border border-slate-200 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-slate-900 font-serif">
                  Capacité d'Accueil &amp; Accréditations
                </h3>
                <span className="text-xs font-mono font-bold bg-emerald-50 text-[#16a34a] border border-[#16a34a]/30 px-2.5 py-1 rounded-[6px]">
                  {totalPlacesOuvertes} places ouvertes
                </span>
              </div>

              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-[6px] bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800">Sujets accrédités par les structures :</span>
                    <span className="font-extrabold font-mono text-[#16a34a] bg-emerald-50 border border-[#16a34a]/30 px-2.5 py-0.5 rounded-[4px] inline-flex items-center gap-1">
                      <Check className="w-3 h-3 stroke-[2.5]" />
                      <span>{sujetsAccredites.length} / {totalSujets}</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Ces sujets sont visibles au catalogue public et ouverts aux candidatures.
                  </p>
                </div>

                <div className="p-4 rounded-[6px] bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800">Sujets en attente d'accréditation :</span>
                    <span className="font-extrabold font-mono text-amber-700 bg-amber-100/70 px-2.5 py-0.5 rounded-[4px]">
                      {sujetsEnAttente.length} en attente
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    En attente de validation par la commission de structure ou le conseil scientifique.
                  </p>
                </div>

                <div className="p-4 rounded-[6px] bg-[#f0fdfa] border border-[#ccfbf1] space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[#0f766e]">Ratio Candidatures / Places :</span>
                    <span className="font-extrabold font-mono text-[#0f766e]">
                      {totalPlacesOuvertes > 0 ? (totalDossiers / totalPlacesOuvertes).toFixed(1) : 0} candidats/place
                    </span>
                  </div>
                  <p className="text-[11px] text-[#0f766e] leading-relaxed">
                    Calculé en temps réel sur la base des candidatures actives et des places offertes.
                  </p>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ==================================================================== */}
      {/* ONGLET (c) « COMPTES DU PERSONNEL »                                  */}
      {/* ==================================================================== */}
      {activeTab === 'personnel' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          
          {/* Note obligatoire : Les candidats ne se créent pas ici */}
          <div className="p-4 rounded-[6px] bg-[#f0fdfa] border border-[#ccfbf1] text-slate-800 text-xs flex items-start gap-3">
            <Info className="w-5 h-5 text-[#0f766e] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="block font-bold text-[#0f766e]">Règle de gestion des utilisateurs :</strong>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Cet espace est réservé exclusivement aux comptes du <strong>personnel académique et administratif</strong> de l'USMBA (Directeurs de thèse, Directions de laboratoire, Scolarité et Administration). Les candidats ne se créent pas ici : ils s'inscrivent directement via le portail public lors de la validation de leurs sujets.
              </p>
            </div>
          </div>

          {/* Formulaire de Création d'un Compte du Personnel */}
          <div className="bg-white p-6 sm:p-8 rounded-[6px] border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 font-serif">
                  Créer un Compte du Personnel Universitaire
                </h2>
                <p className="text-xs text-slate-500">
                  Ajout d'un enseignant-chercheur, encadrant ou personnel administratif
                </p>
              </div>
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-[6px]">
                Accès institutionnel
              </span>
            </div>

            {personnelError && (
              <div className="p-3.5 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{personnelError}</span>
              </div>
            )}

            {personnelSuccess && (
              <div className="p-3.5 rounded-[6px] bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#16a34a] shrink-0" />
                <span>{personnelSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreerPersonnel} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nom de famille *</label>
                  <input
                    type="text"
                    placeholder="Ex: HOUARI"
                    value={nomPersonnel}
                    onChange={(e) => setNomPersonnel(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[6px] border border-slate-200 text-xs focus:ring-2 focus:ring-[#0f766e] focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Prénom &amp; Titre *</label>
                  <input
                    type="text"
                    placeholder="Ex: Mohamed (Pr)"
                    value={prenomPersonnel}
                    onChange={(e) => setPrenomPersonnel(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[6px] border border-slate-200 text-xs focus:ring-2 focus:ring-[#0f766e] focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email institutionnel *</label>
                  <input
                    type="email"
                    placeholder="prenom.nom@usmba.ac.ma"
                    value={emailPersonnel}
                    onChange={(e) => setEmailPersonnel(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[6px] border border-slate-200 text-xs focus:ring-2 focus:ring-[#0f766e] focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Rôle dans la plateforme *</label>
                  <select
                    value={rolePersonnel}
                    onChange={(e) => setRolePersonnel(e.target.value as ProfilRole)}
                    className="w-full px-3.5 py-2.5 rounded-[6px] border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-[#0f766e] focus:outline-none bg-white"
                  >
                    <option value="DIRECTEUR_THESE">Directeur de Thèse (Encadrant)</option>
                    <option value="DIRECTEUR_STRUCTURE">Direction de Structure (Laboratoire)</option>
                    <option value="AGENT_ADMIN">Contrôle Identité &amp; Scolarité</option>
                    <option value="ADMIN_ED">Administration Centrale CEDoc</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Établissement / Structure</label>
                  <input
                    type="text"
                    placeholder="Ex: FST Fès, Faculté des Sciences, Labo LIS..."
                    value={etablissementPersonnel}
                    onChange={(e) => setEtablissementPersonnel(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[6px] border border-slate-200 text-xs focus:ring-2 focus:ring-[#0f766e] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#0f766e] hover:bg-[#115e59] text-white rounded-[6px] text-xs font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-center gap-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Créer le compte du personnel</span>
                </button>
              </div>
            </form>
          </div>

          {/* Liste des Comptes du Personnel */}
          <div className="bg-white p-6 sm:p-8 rounded-[6px] border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 font-serif">
                  Comptes du Personnel Enregistrés ({personnelUsers.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Gestion des droits et possibilité de désactiver / réactiver les accès sans suppression des données
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-[6px] shrink-0">
                Personnel actif : {personnelUsers.filter(u => u.statut_compte !== 'INACTIF').length}
              </span>
            </div>

            {/* Barre de recherche par nom, e-mail ou rôle */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={recherchePersonnel}
                  onChange={(e) => setRecherchePersonnel(e.target.value)}
                  placeholder="Rechercher un compte par nom, e-mail ou rôle..."
                  className="w-full pl-9 pr-8 py-2 text-xs rounded-[6px] border border-slate-200 bg-white focus:ring-2 focus:ring-[#0f766e] focus:outline-none"
                />
                {recherchePersonnel && (
                  <button
                    type="button"
                    onClick={() => setRecherchePersonnel('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    title="Effacer la recherche"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {recherchePersonnel.trim() !== '' && (
                <span className="text-xs text-slate-500 font-semibold">
                  {personnelUsersFiltres.length} compte{personnelUsersFiltres.length > 1 ? 's' : ''} trouvé{personnelUsersFiltres.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50/70">
                    <th className="py-3 px-3">Nom &amp; Prénom</th>
                    <th className="py-3 px-3">Rôle</th>
                    <th className="py-3 px-3">Email académique</th>
                    <th className="py-3 px-3">Établissement</th>
                    <th className="py-3 px-3">Statut</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {personnelUsersFiltres.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Aucun compte du personnel ne correspond à votre recherche « {recherchePersonnel} ».
                      </td>
                    </tr>
                  ) : (
                    personnelUsersFiltres.map((user) => {
                      const isActif = user.statut_compte !== 'INACTIF';
                      return (
                        <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                            {user.nom} {user.prenom}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2.5 py-0.5 rounded-[4px] text-[11px] font-bold ${
                              user.role === 'DIRECTEUR_THESE' ? 'bg-[#f0fdfa] text-[#0f766e] border border-[#ccfbf1]' :
                              user.role === 'DIRECTEUR_STRUCTURE' ? 'bg-indigo-50 text-indigo-800 border border-indigo-200' :
                              user.role === 'AGENT_ADMIN' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                              'bg-slate-100 text-slate-800 border border-slate-300'
                            }`}>
                              {roleLabels[user.role]}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-700">
                            {user.email}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {user.etablissement || 'USMBA'}
                          </td>
                          <td className="py-3 px-3">
                            {isActif ? (
                              <span className="inline-flex items-center gap-1 text-[#16a34a] font-bold text-[11px] bg-emerald-50 px-2 py-0.5 rounded-[4px] border border-[#16a34a]/30">
                                <Check className="w-3 h-3 stroke-[2.5]" />
                                <span>Actif</span>
                              </span>
                            ) : (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 text-rose-700 font-bold text-[11px] bg-rose-50 px-2 py-0.5 rounded-[4px] border border-rose-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                                  <span>Désactivé</span>
                                </span>
                                {user.reaffecte_vers_nom && (
                                  <div className="text-[10px] text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded-[4px] border border-amber-200">
                                    Réaffecté à : {user.reaffecte_vers_nom}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => onTogglePersonnelStatus(user.id)}
                              className={`px-3 py-1.5 rounded-[6px] text-[11px] font-bold cursor-pointer transition flex items-center gap-1 ml-auto border ${
                                isActif
                                  ? 'bg-white text-rose-700 hover:bg-rose-50 border-rose-300'
                                  : 'bg-white text-[#16a34a] hover:bg-emerald-50 border-[#16a34a]/50'
                              }`}
                              title={isActif ? "Désactiver ce compte" : "Réactiver ce compte"}
                            >
                              <Power className="w-3 h-3" />
                              <span>{isActif ? "Désactiver" : "Réactiver"}</span>
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

        </div>
      )}

    </div>
  );
};

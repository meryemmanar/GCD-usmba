import React, { useState } from 'react';
import { 
  GraduationCap, 
  User, 
  Bell, 
  LogOut, 
  BookOpen, 
  Calendar, 
  ShieldCheck, 
  Building2, 
  CheckCircle2, 
  Layers,
  Home,
  Check,
  X,
  Lock,
  FileText,
  Download
} from 'lucide-react';
import { UserAccount, ProfilRole, VersionCampagne, NotificationItem } from '../types';
import { BadgeCampagne } from './BadgeCampagne';
import { CandidatSubTab } from './CandidatView';

interface SidebarNavigationProps {
  currentUser: UserAccount;
  activeTab: string;
  onNavigate: (tab: string) => void;
  onLogout: () => void;
  onOpenGuide: () => void;
  campagne: VersionCampagne;
  notifications: NotificationItem[];
  onMarkAllAsRead?: () => void;
  onClearNotifications?: () => void;
  candidatSansSujet?: boolean;
  activeCandidatSubTab?: CandidatSubTab;
  onSelectCandidatSubTab?: (subTab: CandidatSubTab) => void;
}

export const SidebarNavigation: React.FC<SidebarNavigationProps> = ({
  currentUser,
  activeTab,
  onNavigate,
  onLogout,
  onOpenGuide,
  campagne,
  notifications,
  onMarkAllAsRead,
  onClearNotifications,
  candidatSansSujet = false,
  activeCandidatSubTab = 'SYNTHESE',
  onSelectCandidatSubTab
}) => {
  const [notifOpen, setNotifOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.lu).length;

  const handleBellClick = () => {
    const nextState = !notifOpen;
    setNotifOpen(nextState);
    if (nextState && onMarkAllAsRead) {
      onMarkAllAsRead();
    }
  };

  const getRoleLabel = (role: ProfilRole) => {
    switch (role) {
      case 'CANDIDAT': return 'Candidat Doctorant';
      case 'DIRECTEUR_THESE': return 'Directeur de Thèse';
      case 'DIRECTEUR_STRUCTURE': return 'Direction de structure';
      case 'AGENT_ADMIN': return 'Scolarité CEDoc';
      case 'ADMIN_ED': return 'Administration CEDoc';
      default: return 'Utilisateur';
    }
  };

  const effectiveCandidatSubTab: CandidatSubTab = candidatSansSujet
    ? 'CHOIX_SUJETS'
    : activeCandidatSubTab;

  return (
    <aside className="w-64 lg:w-72 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 h-screen sticky top-0 z-30 shadow-xs">
      
      {/* Haut de la barre latérale */}
      <div className="p-5 space-y-6 overflow-y-auto">
        
        {/* Logo & Titre Institutionnel */}
        <div 
          onClick={() => {
            if (currentUser.role === 'CANDIDAT' && candidatSansSujet) {
              onNavigate('candidat');
              if (onSelectCandidatSubTab) onSelectCandidatSubTab('CHOIX_SUJETS');
              return;
            }
            onNavigate('accueil');
          }}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="h-10 w-10 rounded-[6px] bg-[#0f766e] flex items-center justify-center text-white shadow-xs">
            <span className="font-black text-xs tracking-tight font-serif">USMBA</span>
          </div>
          <div>
            <div className="font-extrabold text-sm text-slate-900 leading-tight font-serif">
              Portail Doctorat
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              CEDoc &bull; Fès
            </div>
          </div>
        </div>

        {/* Carte Profil de l'utilisateur connecté */}
        <div className="p-3.5 rounded-[6px] bg-[#f8fafc] border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#0f766e] bg-[#f0fdfa] px-2 py-0.5 rounded-[4px] border border-[#ccfbf1]">
              {getRoleLabel(currentUser.role)}
            </span>
            {currentUser.isAcademicUSMBA && (
              <span className="text-[10px] font-bold text-[#16a34a] inline-flex items-center gap-1">
                <Check className="w-3 h-3 text-[#16a34a] stroke-[2.5]" />
                <span>USMBA</span>
              </span>
            )}
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 leading-tight">
              {currentUser.prenom} {currentUser.nom}
            </div>
            <div className="text-[11px] text-slate-500 font-mono truncate">
              {currentUser.email}
            </div>
          </div>
        </div>

        {/* NAVIGATION STRICTEMENT PROPRE AU RÔLE DE L'UTILISATEUR */}
        <nav className="space-y-1 text-xs font-semibold">
          
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold px-3 py-1">
            Espace de travail
          </div>

          {/* Rôle CANDIDAT */}
          {currentUser.role === 'CANDIDAT' && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  onNavigate('candidat');
                  if (onSelectCandidatSubTab) onSelectCandidatSubTab('CHOIX_SUJETS');
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[6px] transition cursor-pointer text-left ${
                  activeTab === 'candidat' && effectiveCandidatSubTab === 'CHOIX_SUJETS'
                    ? 'bg-[#0f766e] text-white font-bold shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <BookOpen className={`w-4 h-4 ${activeTab === 'candidat' && effectiveCandidatSubTab === 'CHOIX_SUJETS' ? 'text-white' : 'text-[#0f766e]'}`} />
                <span>Choix des sujets</span>
              </button>

              <button
                type="button"
                disabled={candidatSansSujet}
                onClick={() => {
                  if (candidatSansSujet) return;
                  onNavigate('candidat');
                  if (onSelectCandidatSubTab) onSelectCandidatSubTab('SYNTHESE');
                }}
                title={candidatSansSujet ? "Veuillez choisir au moins 1 sujet pour accéder à cet onglet" : "Synthèse & Sujets"}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-[6px] transition text-left ${
                  candidatSansSujet
                    ? 'text-slate-400 cursor-not-allowed opacity-70 bg-slate-50/50'
                    : activeTab === 'candidat' && effectiveCandidatSubTab === 'SYNTHESE'
                      ? 'bg-[#0f766e] text-white font-bold shadow-xs cursor-pointer'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 cursor-pointer'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <GraduationCap className={`w-4 h-4 ${
                    candidatSansSujet
                      ? 'text-slate-400'
                      : activeTab === 'candidat' && effectiveCandidatSubTab === 'SYNTHESE'
                        ? 'text-white'
                        : 'text-[#0f766e]'
                  }`} />
                  <span>Mon Dossier D1 (Synthèse)</span>
                </span>
                {candidatSansSujet && <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
              </button>

              <button
                type="button"
                disabled={candidatSansSujet}
                onClick={() => {
                  if (candidatSansSujet) return;
                  onNavigate('candidat');
                  if (onSelectCandidatSubTab) onSelectCandidatSubTab('PIECES');
                }}
                title={candidatSansSujet ? "Veuillez choisir au moins 1 sujet pour accéder à cet onglet" : "Pièces justificatives"}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-[6px] transition text-left ${
                  candidatSansSujet
                    ? 'text-slate-400 cursor-not-allowed opacity-70 bg-slate-50/50'
                    : activeTab === 'candidat' && effectiveCandidatSubTab === 'PIECES'
                      ? 'bg-[#0f766e] text-white font-bold shadow-xs cursor-pointer'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 cursor-pointer'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <FileText className={`w-4 h-4 ${
                    candidatSansSujet
                      ? 'text-slate-400'
                      : activeTab === 'candidat' && effectiveCandidatSubTab === 'PIECES'
                        ? 'text-white'
                        : 'text-[#0f766e]'
                  }`} />
                  <span>Pièces justificatives</span>
                </span>
                {candidatSansSujet && <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
              </button>

              <button
                type="button"
                disabled={candidatSansSujet}
                onClick={() => {
                  if (candidatSansSujet) return;
                  onNavigate('candidat');
                  if (onSelectCandidatSubTab) onSelectCandidatSubTab('DOCS_GENERES');
                }}
                title={candidatSansSujet ? "Veuillez choisir au moins 1 sujet pour accéder à cet onglet" : "Formulaires & Récépissé"}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-[6px] transition text-left ${
                  candidatSansSujet
                    ? 'text-slate-400 cursor-not-allowed opacity-70 bg-slate-50/50'
                    : activeTab === 'candidat' && effectiveCandidatSubTab === 'DOCS_GENERES'
                      ? 'bg-[#0f766e] text-white font-bold shadow-xs cursor-pointer'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 cursor-pointer'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Download className={`w-4 h-4 ${
                    candidatSansSujet
                      ? 'text-slate-400'
                      : activeTab === 'candidat' && effectiveCandidatSubTab === 'DOCS_GENERES'
                        ? 'text-white'
                        : 'text-[#0f766e]'
                  }`} />
                  <span>Formulaires &amp; Récépissé</span>
                </span>
                {candidatSansSujet && <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
              </button>

              {candidatSansSujet && (
                <div className="mx-1 mt-1 p-2.5 rounded-[6px] bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-snug font-medium">
                  Choisissez au moins 1 sujet pour débloquer les autres onglets de votre espace.
                </div>
              )}
            </div>
          )}

          {/* Rôle DIRECTEUR_THESE */}
          {currentUser.role === 'DIRECTEUR_THESE' && (
            <button
              onClick={() => onNavigate('encadrant')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[6px] transition cursor-pointer text-left ${
                activeTab === 'encadrant'
                  ? 'bg-[#0f766e] text-white font-bold shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <User className={`w-4 h-4 ${activeTab === 'encadrant' ? 'text-white' : 'text-[#0f766e]'}`} />
              <span>Espace Encadrant</span>
            </button>
          )}

          {/* Rôle DIRECTEUR_STRUCTURE */}
          {currentUser.role === 'DIRECTEUR_STRUCTURE' && (
            <button
              onClick={() => onNavigate('structure')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[6px] transition cursor-pointer text-left ${
                activeTab === 'structure'
                  ? 'bg-[#0f766e] text-white font-bold shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Building2 className={`w-4 h-4 ${activeTab === 'structure' ? 'text-white' : 'text-[#0f766e]'}`} />
              <span>Direction de structure</span>
            </button>
          )}

          {/* Rôle AGENT_ADMIN (Scolarité / Contrôle Identité) */}
          {currentUser.role === 'AGENT_ADMIN' && (
            <button
              onClick={() => onNavigate('agent')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[6px] transition cursor-pointer text-left ${
                activeTab === 'agent'
                  ? 'bg-[#0f766e] text-white font-bold shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className={`w-4 h-4 ${activeTab === 'agent' ? 'text-white' : 'text-[#0f766e]'}`} />
              <span>Contrôle Identité</span>
            </button>
          )}

          {/* Rôle ADMIN_ED (Administration Centrale) */}
          {currentUser.role === 'ADMIN_ED' && (
            <button
              onClick={() => onNavigate('admin_ed')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[6px] transition cursor-pointer text-left ${
                activeTab === 'admin_ed'
                  ? 'bg-[#0f766e] text-white font-bold shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Layers className={`w-4 h-4 ${activeTab === 'admin_ed' ? 'text-white' : 'text-[#0f766e]'}`} />
              <span>Gestion Campagne</span>
            </button>
          )}

          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold px-3 pt-4 pb-1">
            Consultation publique
          </div>

          {/* Accueil */}
          <button
            type="button"
            disabled={currentUser.role === 'CANDIDAT' && candidatSansSujet}
            onClick={() => {
              if (currentUser.role === 'CANDIDAT' && candidatSansSujet) return;
              onNavigate('accueil');
            }}
            className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-[6px] transition text-left ${
              currentUser.role === 'CANDIDAT' && candidatSansSujet
                ? 'text-slate-400 cursor-not-allowed opacity-60'
                : activeTab === 'accueil'
                  ? 'bg-slate-100 text-slate-900 font-bold cursor-pointer'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Home className="w-4 h-4 text-slate-400" />
              <span>Accueil portail</span>
            </span>
            {currentUser.role === 'CANDIDAT' && candidatSansSujet && <Lock className="w-3 h-3 text-slate-400 shrink-0" />}
          </button>

          {/* Catalogue */}
          <button
            type="button"
            onClick={() => {
              if (currentUser.role === 'CANDIDAT' && candidatSansSujet) {
                onNavigate('candidat');
                if (onSelectCandidatSubTab) onSelectCandidatSubTab('CHOIX_SUJETS');
                return;
              }
              onNavigate('catalogue');
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[6px] transition cursor-pointer text-left ${
              activeTab === 'catalogue'
                ? 'bg-slate-100 text-slate-900 font-bold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4 text-slate-400" />
            <span>Catalogue des Sujets</span>
          </button>

          {/* Calendrier Modal */}
          <button
            onClick={onOpenGuide}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[6px] transition cursor-pointer text-left text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          >
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>Calendrier de la campagne</span>
          </button>

          {/* Notifications */}
          <div className="pt-2">
            <button
              onClick={handleBellClick}
              className="w-full flex items-center justify-between px-3 py-2 rounded-[6px] transition cursor-pointer text-left text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              <div className="flex items-center gap-2.5">
                <Bell className="w-4 h-4 text-slate-400" />
                <span>Notifications</span>
              </div>
              {unreadCount > 0 ? (
                <span className="min-w-[18px] h-4 px-1 bg-[#0f766e] text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 font-normal">
                  {notifications.length}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="mt-2 p-3 bg-white rounded-[6px] border border-slate-200 shadow-lg text-xs space-y-2">
                <div className="flex items-center justify-between font-bold text-slate-700 pb-1 border-b border-slate-100">
                  <span>Messages récents</span>
                  {onClearNotifications && notifications.length > 0 && (
                    <button
                      onClick={onClearNotifications}
                      className="text-[10px] text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      Effacer
                    </button>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 text-[11px]">
                  {notifications.length === 0 ? (
                    <div className="p-2 text-center text-slate-400">Aucune notification</div>
                  ) : (
                    notifications.map((item) => (
                      <div key={item.id} className="py-1.5 space-y-0.5">
                        <p className="text-slate-700 leading-snug">{item.message}</p>
                        <span className="text-[10px] text-slate-400 block">{item.date}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

        </nav>

        {/* Badge Campagne */}
        <div className="pt-2">
          <BadgeCampagne campagne={campagne} className="w-full justify-center" />
        </div>

      </div>

      {/* Bas de la barre latérale : Nom et Bouton Déconnexion */}
      <div className="p-4 border-t border-slate-200 bg-[#f8fafc] space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="truncate">
            <span className="font-bold text-slate-900 block truncate">
              {currentUser.prenom} {currentUser.nom}
            </span>
            <span className="text-[10px] text-slate-500 block truncate">
              {getRoleLabel(currentUser.role)}
            </span>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[6px] bg-white hover:bg-rose-50 text-rose-700 border border-slate-200 hover:border-rose-300 transition-colors text-xs font-bold cursor-pointer shadow-2xs"
          title="Se déconnecter de la plateforme"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-600" />
          <span>Déconnexion</span>
        </button>
      </div>

    </aside>
  );
};

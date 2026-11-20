import React, { useEffect, useState } from 'react';
import { ShieldAlert, ArrowRight, Lock, GraduationCap, Building2, User, Layers, ShieldCheck } from 'lucide-react';
import { UserAccount, ProfilRole } from '../types';

interface AccesRefuseViewProps {
  currentUser: UserAccount | null;
  targetTab: string;
  onRedirect: (tab: string) => void;
}

export const AccesRefuseView: React.FC<AccesRefuseViewProps> = ({
  currentUser,
  targetTab,
  onRedirect
}) => {
  const [countdown, setCountdown] = useState(5);

  const getAuthorizedTab = (user: UserAccount | null): string => {
    if (!user) return 'accueil';
    switch (user.role) {
      case 'CANDIDAT': return 'candidat';
      case 'DIRECTEUR_THESE': return 'encadrant';
      case 'DIRECTEUR_STRUCTURE': return 'structure';
      case 'AGENT_ADMIN': return 'agent';
      case 'ADMIN_ED': return 'admin_ed';
      default: return 'accueil';
    }
  };

  const authorizedTab = getAuthorizedTab(currentUser);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onRedirect(authorizedTab);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [authorizedTab, onRedirect]);

  const getTabLabel = (tab: string) => {
    switch (tab) {
      case 'candidat': return 'Mon Dossier D1 (Candidat)';
      case 'encadrant': return 'Espace Encadrant (Directeur de Thèse)';
      case 'structure': return 'Direction de structure (Laboratoire)';
      case 'agent': return 'Contrôle Identité (Scolarité)';
      case 'admin_ed': return 'Gestion Campagne (Administration ED)';
      default: return tab;
    }
  };

  const getRoleLabel = (role?: ProfilRole) => {
    switch (role) {
      case 'CANDIDAT': return 'Candidat Doctorant';
      case 'DIRECTEUR_THESE': return 'Directeur de Thèse';
      case 'DIRECTEUR_STRUCTURE': return 'Direction de Structure';
      case 'AGENT_ADMIN': return 'Scolarité CEDoc';
      case 'ADMIN_ED': return 'Administration Centrale CEDoc';
      default: return 'Visiteur public (Non authentifié)';
    }
  };

  const getTargetIcon = (tab: string) => {
    switch (tab) {
      case 'candidat': return <GraduationCap className="w-5 h-5 text-rose-600" />;
      case 'encadrant': return <User className="w-5 h-5 text-rose-600" />;
      case 'structure': return <Building2 className="w-5 h-5 text-rose-600" />;
      case 'agent': return <ShieldCheck className="w-5 h-5 text-rose-600" />;
      case 'admin_ed': return <Layers className="w-5 h-5 text-rose-600" />;
      default: return <Lock className="w-5 h-5 text-rose-600" />;
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-16 px-4">
      <div className="bg-white rounded-[6px] border border-rose-200 shadow-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* En-tête alerte sécurité sans dégradé */}
        <div className="bg-rose-900 text-white p-8 text-center space-y-3">
          <div className="w-14 h-14 rounded-[6px] bg-white/10 border border-white/20 flex items-center justify-center mx-auto text-rose-300 shadow-xs">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <span className="inline-block text-[11px] font-bold uppercase tracking-widest text-rose-300 bg-rose-950/60 px-3 py-1 rounded-[4px] border border-rose-400/30">
            Contrôle d'accès institutionnel
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-serif">
            Accès refusé
          </h1>
          <p className="text-xs text-rose-200 max-w-md mx-auto leading-relaxed">
            Vous ne disposez pas des habilitations nécessaires pour accéder à cet espace institutionnel.
          </p>
        </div>

        {/* Détails du refus d'accès */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="bg-slate-50 rounded-[6px] p-4 sm:p-5 border border-slate-200 space-y-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-slate-500 font-medium">Espace sollicité :</span>
              <div className="flex items-center gap-2 font-bold text-slate-900">
                {getTargetIcon(targetTab)}
                <span>{getTabLabel(targetTab)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-slate-500 font-medium">Votre profil actif :</span>
              <span className="font-bold text-slate-800">
                {getRoleLabel(currentUser?.role)}
              </span>
            </div>

            {currentUser && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Compte connecté :</span>
                <span className="font-mono text-slate-700">{currentUser.email}</span>
              </div>
            )}
          </div>

          <div className="p-4 rounded-[6px] bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
            <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="block font-bold">Règle de séparation des rôles :</strong>
              <p className="text-amber-800 leading-relaxed text-[11px]">
                Conformément aux directives de sécurité du CEDoc USMBA, chaque utilisateur est strictement cantonné à l'espace correspondant à ses fonctions académiques ou de candidature.
              </p>
            </div>
          </div>

          {/* Redirection */}
          <div className="space-y-3 pt-2 text-center">
            <p className="text-xs text-slate-500">
              Redirection automatique dans <strong className="text-[#0f766e] font-mono text-sm">{countdown}s</strong>...
            </p>

            <button
              onClick={() => onRedirect(authorizedTab)}
              className="w-full py-3 px-6 bg-[#0f766e] hover:bg-[#115e59] text-white rounded-[6px] font-bold text-xs sm:text-sm shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Accéder à mon espace autorisé</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

import React from 'react';
import { 
  BookOpen, 
  Calendar, 
  ArrowRight,
  Home
} from 'lucide-react';
import { VersionCampagne } from '../types';

interface NavbarProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  onOpenAuth: () => void;
  onOpenGuide?: () => void;
  campagne?: VersionCampagne;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onNavigate,
  onOpenAuth
}) => {
  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 transition-all shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2 sm:gap-4 h-16 sm:h-20">
          
          {/* Logo bannière USMBA / EST à gauche + nom « Portail Doctorat » à côté */}
          <button
            type="button"
            onClick={() => onNavigate('accueil')}
            className="flex items-center gap-2 sm:gap-3 cursor-pointer text-left min-w-0 shrink-0"
          >
            <img
              src="/assets/aistudio/image_557570a4.png"
              alt="Université Sidi Mohamed Ben Abdellah de Fès — École Supérieure de Technologie"
              className="block w-auto h-auto max-h-8 sm:max-h-9 lg:max-h-10 max-w-[38vw] sm:max-w-[250px] lg:max-w-[310px] xl:max-w-[360px] object-contain shrink-0"
            />
            <span className="font-extrabold text-xs sm:text-sm xl:text-base text-slate-900 tracking-tight leading-none font-serif whitespace-nowrap">
              Portail Doctorat
            </span>
          </button>

          {/* Navigation Publique Simple (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2 text-xs xl:text-sm font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => onNavigate('accueil')}
              className={`px-2.5 xl:px-3.5 py-2 rounded-[6px] transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'accueil'
                  ? 'bg-[#f0fdfa] text-[#0f766e] font-bold border border-[#ccfbf1]'
                  : 'hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Home className="w-4 h-4 text-[#0f766e] shrink-0" />
              <span>Accueil</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('catalogue')}
              className={`px-2.5 xl:px-3.5 py-2 rounded-[6px] transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'catalogue'
                  ? 'bg-[#f0fdfa] text-[#0f766e] font-bold border border-[#ccfbf1]'
                  : 'hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4 text-[#0f766e] shrink-0" />
              <span>Catalogue des Sujets</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('calendrier')}
              className={`px-2.5 xl:px-3.5 py-2 rounded-[6px] transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'calendrier'
                  ? 'bg-[#f0fdfa] text-[#0f766e] font-bold border border-[#ccfbf1]'
                  : 'hover:bg-slate-100 hover:text-slate-900'
              }`}
              title="Consulter le calendrier officiel de la campagne doctorale"
            >
              <Calendar className={`w-4 h-4 shrink-0 ${activeTab === 'calendrier' ? 'text-[#0f766e]' : 'text-slate-400'}`} />
              <span>Calendrier de la campagne</span>
            </button>
          </nav>

          {/* Côté Droit : Bouton Unique « Connexion » */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={onOpenAuth}
              className="bg-[#0f766e] hover:bg-[#115e59] text-white text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 sm:py-2.5 rounded-[6px] transition shadow-xs cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>Connexion</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

        {/* Navigation Publique Simple (Mobile / Tablette) */}
        <nav className="flex lg:hidden items-center gap-1 border-t border-slate-100 py-2 overflow-x-auto text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => onNavigate('accueil')}
            className={`px-2.5 py-1.5 rounded-[6px] transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'accueil'
                ? 'bg-[#f0fdfa] text-[#0f766e] font-bold border border-[#ccfbf1]'
                : 'hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Home className="w-3.5 h-3.5 text-[#0f766e] shrink-0" />
            <span>Accueil</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('catalogue')}
            className={`px-2.5 py-1.5 rounded-[6px] transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'catalogue'
                ? 'bg-[#f0fdfa] text-[#0f766e] font-bold border border-[#ccfbf1]'
                : 'hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-[#0f766e] shrink-0" />
            <span>Catalogue des Sujets</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('calendrier')}
            className={`px-2.5 py-1.5 rounded-[6px] transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'calendrier'
                ? 'bg-[#f0fdfa] text-[#0f766e] font-bold border border-[#ccfbf1]'
                : 'hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Calendar className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'calendrier' ? 'text-[#0f766e]' : 'text-slate-400'}`} />
            <span>Calendrier de la campagne</span>
          </button>
        </nav>
      </div>
    </header>
  );
};


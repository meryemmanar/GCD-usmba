import React from 'react';
import { X, Calendar, CheckCircle2, FileText, AlertCircle, Clock } from 'lucide-react';
import { VersionCampagne } from '../types';
import { formatDateJJMMAAAA } from '../utils/dateUtils';
import { BadgeCampagne } from './BadgeCampagne';

interface GuideCalendrierModalProps {
  isOpen: boolean;
  campagne: VersionCampagne;
  onClose: () => void;
}

export const GuideCalendrierModal: React.FC<GuideCalendrierModalProps> = ({
  isOpen,
  campagne,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-[6px] max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-xl border border-slate-200 my-8 animate-in fade-in">
        
        <div className="flex justify-between items-start border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#0f766e] uppercase tracking-wider">
              <Calendar className="w-4 h-4 text-[#0f766e]" />
              Calendrier de la campagne
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight font-serif">
                Campagne Doctorale {campagne.annee_universitaire}
              </h3>
              <BadgeCampagne campagne={campagne} />
            </div>
            <p className="text-xs text-slate-500 mt-1 font-sans">
              Guide pratique et échéances réglementaires pour l'inscription en 1ère année de doctorat (CEDoc USMBA)
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs font-sans">
          
          <div className="p-4 rounded-[6px] bg-[#f0fdfa] border border-[#ccfbf1] space-y-2">
            <div className="flex items-center justify-between text-slate-900 font-bold flex-wrap gap-2">
              <span>Période de dépôt des candidatures :</span>
              <span className="bg-white border border-[#ccfbf1] text-[#0f766e] px-3 py-1 rounded-[4px] font-mono text-[11px] font-bold">
                Du {formatDateJJMMAAAA(campagne.date_ouverture)} au {formatDateJJMMAAAA(campagne.date_cloture)}
              </span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Dernière révision officielle : {formatDateJJMMAAAA(campagne.date_modification)} &bull; <em>{campagne.motif_modification}</em>
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-extrabold text-slate-900 text-sm font-serif">Les 4 étapes de la campagne :</h4>
            
            {campagne.etapes.map((etape) => (
              <div key={etape.numero} className="p-3.5 rounded-[6px] bg-slate-50 border border-slate-200 flex items-start gap-3">
                <div className={`w-7 h-7 rounded-[4px] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs ${
                  etape.numero === 4 ? 'bg-[#16a34a]' : 'bg-[#0f766e]'
                }`}>
                  {etape.numero}
                </div>
                <div>
                  <strong className="text-slate-900 block text-xs sm:text-sm">
                    {etape.numero}. {etape.titre}
                  </strong>
                  <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                    {etape.description}
                  </p>
                </div>
              </div>
            ))}

          </div>

          <div className="p-3.5 rounded-[6px] bg-slate-50 border border-slate-200 text-slate-600 space-y-1">
            <span className="font-bold text-slate-800 block">Règles techniques communes :</span>
            <ul className="list-disc list-inside space-y-0.5 text-[11px]">
              <li>Fichiers acceptés : PDF exclusivement, taille maximale de {campagne.taille_max_fichier_mo} Mo par pièce.</li>
              <li>Ordonnancement jusqu'à {campagne.nombre_max_sujets} sujets de thèse avec priorités 1, 2 et 3.</li>
              <li>Délai de {campagne.delai_inscription_jours} jours ouvrés pour le dépôt physique du dossier légalisé après admission.</li>
            </ul>
          </div>

        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-[#0f766e] hover:bg-[#115e59] text-white rounded-[6px] font-bold text-xs cursor-pointer shadow-xs"
          >
            Fermer le guide
          </button>
        </div>

      </div>
    </div>
  );
};

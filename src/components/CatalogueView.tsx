import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  GraduationCap, 
  BookOpen, 
  Check, 
  Plus, 
  Eye, 
  ArrowUpDown, 
  Trash2, 
  ChevronRight, 
  Building2, 
  Sparkles,
  Info,
  X
} from 'lucide-react';
import { SujetThese } from '../types';

interface CatalogueViewProps {
  sujets: SujetThese[];
  panierSujets: SujetThese[];
  filtreLaboratoireInitial?: string | null;
  rechercheInitiale?: string;
  onClearFiltreLaboratoire?: () => void;
  onAjouterAuPanier: (sujet: SujetThese) => void;
  onRetirerDuPanier: (id: string) => void;
  onDeplacerPriorite: (index: number, direction: 'UP' | 'DOWN') => void;
  onSelectDetail: (sujet: SujetThese) => void;
  onValiderSelection: () => void;
}

export const CatalogueView: React.FC<CatalogueViewProps> = ({
  sujets,
  panierSujets,
  filtreLaboratoireInitial,
  rechercheInitiale,
  onClearFiltreLaboratoire,
  onAjouterAuPanier,
  onRetirerDuPanier,
  onDeplacerPriorite,
  onSelectDetail,
  onValiderSelection
}) => {
  const [recherche, setRecherche] = useState(rechercheInitiale || '');
  const [filtreEtablissement, setFiltreEtablissement] = useState('TOUS');
  const [filtreLaboratoire, setFiltreLaboratoire] = useState<string | null>(filtreLaboratoireInitial || null);

  useEffect(() => {
    if (filtreLaboratoireInitial !== undefined) {
      setFiltreLaboratoire(filtreLaboratoireInitial);
    }
  }, [filtreLaboratoireInitial]);

  useEffect(() => {
    if (rechercheInitiale !== undefined) {
      setRecherche(rechercheInitiale);
    }
  }, [rechercheInitiale]);

  const etablissements = [
    'TOUS',
    'Faculté des Sciences Dhar El Mahraz',
    'FST Fès',
    'Faculté de Médecine et de Pharmacie',
    'FSJES Fès',
    'ENSA Fès'
  ];

  const sujetsFiltres = sujets.filter(s => {
    const matchTxt = 
      s.titre.toLowerCase().includes(recherche.toLowerCase()) || 
      s.propose_par.toLowerCase().includes(recherche.toLowerCase()) ||
      s.theme.toLowerCase().includes(recherche.toLowerCase()) ||
      s.structure.toLowerCase().includes(recherche.toLowerCase());
    const matchEtab = filtreEtablissement === 'TOUS' || s.etablissement === filtreEtablissement;
    const matchLabo = !filtreLaboratoire || s.structure === filtreLaboratoire;
    return matchTxt && matchEtab && matchLabo;
  });

  return (
    <div className="space-y-8 pb-16">
      
      {/* Hero Banner Institutionnel Aéré - Fond uni vert-bleu sans dégradé */}
      <div className="rounded-[6px] bg-[#0f766e] text-white p-8 sm:p-10 shadow-xs border border-[#0d655e]">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[6px] bg-white/15 text-teal-50 text-xs font-bold border border-white/20">
            <GraduationCap className="w-4 h-4 text-teal-200" />
            Campagne Doctorale USMBA 2026-2027
          </div>
          
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white font-serif leading-tight">
            Catalogue des Sujets de Thèse
          </h1>
          
          <p className="text-teal-50/95 text-xs sm:text-sm leading-relaxed max-w-2xl font-normal">
            Explorez les projets de recherche accrédités proposés par les laboratoires de l'Université Sidi Mohamed Ben Abdellah. Retenez de <strong>1 à 3 sujets ordonnés</strong> pour postuler au Cycle Doctoral D1.
          </p>

          <div className="flex flex-wrap items-center gap-6 pt-2 text-xs text-teal-100 font-medium">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#86efac]"></span>
              <span>{sujets.length} sujets validés disponibles</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white"></span>
              <span>Maximum 3 choix ordonnés par candidat</span>
            </div>
          </div>
        </div>
      </div>

      {/* Disposition en grille : Catalogue (2/3) + Panier Choix (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Colonne Principale : Filtres & Cartes Sujets */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Barre d'outils et recherche multicritère */}
          <div className="bg-white p-5 rounded-[6px] border border-slate-200 shadow-xs space-y-4">
            
            {/* Si un filtre de laboratoire est actif */}
            {filtreLaboratoire && (
              <div className="p-3 bg-[#f0fdfa] rounded-[6px] border border-[#ccfbf1] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-800">
                  <Building2 className="w-4 h-4 text-[#0f766e] shrink-0" />
                  <span>Laboratoire sélectionné : <strong>{filtreLaboratoire}</strong></span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFiltreLaboratoire(null);
                    if (onClearFiltreLaboratoire) onClearFiltreLaboratoire();
                  }}
                  className="text-xs font-bold text-[#0f766e] hover:text-[#115e59] inline-flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Tous les laboratoires</span>
                </button>
              </div>
            )}

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher par intitulé, encadrant, laboratoire, thématique..."
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-[6px] border border-slate-200 text-xs focus:ring-2 focus:ring-[#0f766e] focus:outline-none bg-slate-50/50 hover:bg-white transition-all text-slate-800"
              />
            </div>

            {/* Filtres par Établissement (Pills rapides) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
              <span className="font-bold text-slate-500 whitespace-nowrap flex items-center gap-1 mr-1">
                <Filter className="w-3.5 h-3.5 text-[#0f766e]" /> Établissement :
              </span>
              {etablissements.map((etab) => (
                <button
                  key={etab}
                  onClick={() => setFiltreEtablissement(etab)}
                  className={`px-3 py-1.5 rounded-[6px] whitespace-nowrap font-semibold transition cursor-pointer text-xs ${
                    filtreEtablissement === etab
                      ? 'bg-[#0f766e] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                  }`}
                >
                  {etab === 'TOUS' ? 'Tous les établissements' : etab}
                </button>
              ))}
            </div>
          </div>

          {/* Liste des Sujets */}
          <div className="space-y-4">
            {sujetsFiltres.length === 0 ? (
              <div className="bg-white p-12 rounded-[6px] border border-slate-200 text-center space-y-3 shadow-xs">
                <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-base font-bold text-slate-800 font-serif">Aucun sujet ne correspond à vos critères</h3>
                <p className="text-xs text-slate-500">Essayez de modifier votre recherche ou réinitialisez les filtres.</p>
                <button
                  onClick={() => { 
                    setRecherche(''); 
                    setFiltreEtablissement('TOUS'); 
                    setFiltreLaboratoire(null); 
                    if (onClearFiltreLaboratoire) onClearFiltreLaboratoire();
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[6px] text-xs font-bold transition cursor-pointer"
                >
                  Réinitialiser les filtres
                </button>
              </div>
            ) : (
              sujetsFiltres.map((sujet) => {
                const indexDansPanier = panierSujets.findIndex(s => s.id === sujet.id);
                const estSelectionne = indexDansPanier !== -1;
                
                return (
                  <div 
                    key={sujet.id}
                    className={`bg-white p-6 rounded-[6px] border transition-all hover:shadow-xs space-y-4 ${
                      estSelectionne 
                        ? 'border-[#0f766e] ring-1 ring-[#0f766e] bg-[#f0fdfa]/30' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-[#0f766e] bg-[#f0fdfa] px-2.5 py-0.5 rounded-[4px] border border-[#ccfbf1]">
                          {sujet.theme}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                          <span className="px-2 py-0.5 rounded-[4px] bg-slate-100 text-slate-700 font-semibold text-[11px]">
                            {sujet.nombre_places === 1 ? '1 place ouverte' : `${sujet.nombre_places} places ouvertes`}
                          </span>
                          <span>&bull;</span>
                          <span className="text-slate-600 font-medium">{sujet.etablissement}</span>
                        </div>
                      </div>

                      <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug font-serif">
                        {sujet.titre}
                      </h3>

                      <p className="text-slate-600 text-xs sm:text-sm line-clamp-2 leading-relaxed font-sans">
                        {sujet.description}
                      </p>

                      <div className="pt-2 text-xs text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <div>
                          Encadrant : <strong className="text-slate-800">{sujet.propose_par}</strong>
                        </div>
                        <div>
                          Structure : <span className="text-slate-700 font-medium">{sujet.structure}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                      <button
                        onClick={() => onSelectDetail(sujet)}
                        className="text-xs font-semibold text-slate-600 hover:text-[#0f766e] flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Eye className="w-4 h-4 text-slate-400" />
                        <span>Voir la fiche complète</span>
                      </button>

                      <button
                        onClick={() => {
                          if (estSelectionne) {
                            onRetirerDuPanier(sujet.id);
                          } else {
                            onAjouterAuPanier(sujet);
                          }
                        }}
                        className={`text-xs px-4 py-2 rounded-[6px] font-bold transition flex items-center gap-2 cursor-pointer ${
                          estSelectionne
                            ? 'bg-emerald-50 text-[#16a34a] border border-emerald-300 hover:bg-emerald-100'
                            : panierSujets.length >= 3
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                              : 'bg-[#0f766e] hover:bg-[#115e59] text-white shadow-xs'
                        }`}
                        disabled={!estSelectionne && panierSujets.length >= 3}
                      >
                        {estSelectionne ? (
                          <>
                            <Check className="w-4 h-4 text-[#16a34a] stroke-[2.5]" />
                            <span>Choix Prioritaire n°{indexDansPanier + 1}</span>
                          </>
                        ) : panierSujets.length >= 3 ? (
                          <span>Maximum de 3 choix atteint</span>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            <span>Choisir ce sujet</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* Colonne Latérale : Panneau "Mes Choix de Sujets" */}
        <div className="space-y-4 sticky top-24">
          <div className="bg-white p-6 rounded-[6px] border border-slate-200 shadow-xs space-y-5">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 font-serif">
                  {panierSujets.length <= 1 ? 'Mon Sujet Retenu' : 'Mes Sujets Retenus'}
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  {panierSujets.length === 0 && 'Sélectionnez de 1 à 3 sujets ordonnés'}
                  {panierSujets.length === 1 && '1 sujet retenu (Choix Prioritaire n°1)'}
                  {panierSujets.length > 1 && `${panierSujets.length} sujets retenus ordonnés par priorité`}
                </p>
              </div>
              <span className={`px-2.5 py-0.5 rounded-[4px] text-xs font-bold ${
                panierSujets.length > 0 
                  ? 'bg-[#f0fdfa] text-[#0f766e] border border-[#ccfbf1]' 
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {panierSujets.length} / 3
              </span>
            </div>

            {panierSujets.length === 0 ? (
              <div className="py-10 text-center text-slate-400 space-y-3">
                <div className="w-12 h-12 rounded-[6px] bg-slate-50 flex items-center justify-center mx-auto text-slate-300 border border-slate-200">
                  <BookOpen className="w-6 h-6 stroke-[1.5]" />
                </div>
                <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                  Votre sélection est vide.<br />
                  Parcourez le catalogue et cliquez sur <strong>"Choisir ce sujet"</strong> pour ordonner vos candidatures.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 space-y-3">
                {panierSujets.map((s, idx) => (
                  <div key={s.id} className="pt-3 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-[#0f766e] bg-[#f0fdfa] px-2 py-0.5 rounded-[4px] text-[11px] border border-[#ccfbf1]">
                        Priorité {idx + 1}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onDeplacerPriorite(idx, 'UP')}
                          disabled={idx === 0}
                          className="p-1 rounded text-slate-400 hover:text-slate-800 disabled:opacity-20 cursor-pointer transition-colors"
                          title="Augmenter la priorité"
                        >
                          <ArrowUpDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onRetirerDuPanier(s.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Retirer de la sélection"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h4 className="font-bold text-slate-900 leading-snug font-serif">
                      {s.titre}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {s.propose_par} &bull; {s.etablissement}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 space-y-3">
              <button
                disabled={panierSujets.length === 0}
                onClick={onValiderSelection}
                className="w-full py-3 px-4 bg-[#0f766e] hover:bg-[#115e59] disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-[6px] text-xs sm:text-sm font-extrabold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed group"
              >
                <span>
                  {panierSujets.length <= 1 
                    ? 'Valider mon sujet & Postuler' 
                    : `Valider mes ${panierSujets.length} sujets & Postuler`}
                </span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <div className="p-3 rounded-[6px] bg-slate-50 border border-slate-200 text-[11px] text-slate-500 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                  <Info className="w-3.5 h-3.5 text-[#0f766e]" />
                  Règle d'affectation CEDoc :
                </div>
                <p>
                  Vos sujets retenus seront automatiquement liés à votre nouveau dossier de candidature en statut <strong>Brouillon</strong>.
                </p>
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};

import React, { useState } from 'react';
import { 
  ArrowRight, 
  Check, 
  Building2, 
  FileText, 
  Search,
  MapPin,
  Phone,
  Mail,
  Clock,
  UserCheck
} from 'lucide-react';
import { VersionCampagne, SujetThese } from '../types';
import { formatDateJJMMAAAA } from '../utils/dateUtils';
import { BadgeCampagne } from './BadgeCampagne';

interface AccueilPublicViewProps {
  campagne: VersionCampagne;
  sujets: SujetThese[];
  onConsulterSujets?: () => void;
  onRechercherSujets?: (terme: string) => void;
  onSelectSujetDetail?: (sujet: SujetThese) => void;
  onCommencerCandidature: () => void;
  onOuvrirCalendrier?: (sectionId?: string) => void;
  onSelectLaboratoire?: (nomLabo: string) => void;
}

export const AccueilPublicView: React.FC<AccueilPublicViewProps> = ({
  campagne,
  sujets,
  onConsulterSujets,
  onRechercherSujets,
  onSelectSujetDetail,
  onCommencerCandidature,
  onOuvrirCalendrier
}) => {
  const [termeRecherche, setTermeRecherche] = useState('');

  // Sujets accrédités à afficher sous la recherche
  const sujetsValides = sujets.filter(s => s.statut === 'VALIDE' && s.validation_structure === 'VALIDE');

  // Soumission de la recherche depuis le bandeau principal
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = termeRecherche.trim();
    if (onRechercherSujets) {
      onRechercherSujets(cleaned);
    } else if (onConsulterSujets) {
      onConsulterSujets();
    }
  };

  return (
    <div className="space-y-10 pb-8 text-slate-900">
      
      {/* ==================================================================== */}
      {/* 1. DÉBUT DE PAGE ÉPURÉ (SANS GRAND BANDEAU NI DÉGRADÉ)               */}
      {/* ==================================================================== */}
      <section id="bandeau-recherche" className="space-y-4 pt-2">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 leading-tight font-serif">
            Centre des Études Doctorales — USMBA Fès
          </h1>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
            Portail officiel de candidature et d’admission au doctorat de l’Université Sidi Mohamed Ben Abdellah.
          </p>

          <div className="flex flex-wrap items-center gap-2.5 text-sm text-slate-700 font-medium pt-0.5">
            <span className="tabular-nums">
              Candidatures du {formatDateJJMMAAAA(campagne.date_ouverture)} au {formatDateJJMMAAAA(campagne.date_cloture)}
            </span>
            <BadgeCampagne campagne={campagne} />
          </div>
        </div>

        {/* Barre de recherche bien visible pour chercher par mot-clé, laboratoire ou encadrant */}
        <form
          onSubmit={handleSearchSubmit}
          className="bg-white p-2 rounded-[6px] shadow-xs border border-slate-300 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
        >
          <div className="relative flex-1 flex items-center">
            <Search className="w-5 h-5 text-[#0f766e] absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={termeRecherche}
              onChange={(e) => setTermeRecherche(e.target.value)}
              placeholder="Rechercher un sujet par mot-clé, laboratoire ou encadrant (ex: Intelligence Artificielle, LIS, Pr. El Amrani)..."
              aria-label="Rechercher un sujet par mot-clé, laboratoire ou encadrant"
              className="w-full pl-11 pr-4 py-2.5 rounded-[4px] text-sm sm:text-base text-slate-900 placeholder:text-slate-500 font-medium focus:outline-none focus:ring-2 focus:ring-[#0f766e]"
            />
          </div>
          <button
            type="submit"
            className="bg-[#0f766e] hover:bg-[#115e59] text-white px-6 py-2.5 rounded-[4px] text-sm sm:text-base font-bold transition flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-xs"
          >
            <Search className="w-4 h-4" />
            <span>Rechercher un sujet</span>
          </button>
        </form>
      </section>

      {/* ==================================================================== */}
      {/* 2. SECTION « SUJETS PROPOSÉS » JUSTE SOUS LA RECHERCHE               */}
      {/* ==================================================================== */}
      <section
        id="sujets-proposes"
        className="bg-white p-6 sm:p-8 rounded-[6px] border border-slate-300 shadow-xs space-y-6"
      >
        <div className="border-b border-slate-200 pb-4">
          <div className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#0f766e]">
            Catalogue officiel {campagne.annee_universitaire}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 font-serif">
            Sujets proposés
          </h2>
          <p className="text-sm sm:text-base text-slate-700 mt-1">
            Cliquez sur un sujet pour consulter sa fiche détaillée et postuler.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sujetsValides.map((sujet) => (
            <article
              key={sujet.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (onSelectSujetDetail) {
                  onSelectSujetDetail(sujet);
                } else if (onConsulterSujets) {
                  onConsulterSujets();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (onSelectSujetDetail) {
                    onSelectSujetDetail(sujet);
                  } else if (onConsulterSujets) {
                    onConsulterSujets();
                  }
                }
              }}
              className="bg-[#f8fafc] hover:bg-white p-5 rounded-[6px] border border-slate-200 hover:border-[#0f766e] transition-all cursor-pointer shadow-2xs flex flex-col justify-between space-y-4 group text-left"
            >
              <div className="space-y-3">
                <div className="text-xs font-bold text-[#0f766e]">
                  <span>Domaine : {sujet.theme}</span>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-[#0f766e] transition-colors leading-snug font-serif">
                  {sujet.titre}
                </h3>

                <div className="space-y-1.5 pt-1 text-sm text-slate-800">
                  <div className="flex items-start gap-2">
                    <Building2 className="w-4 h-4 text-[#0f766e] shrink-0 mt-0.5" />
                    <span>
                      <strong className="font-bold text-slate-900">Laboratoire :</strong>{' '}
                      <span className="text-slate-700">{sujet.structure}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#0f766e] shrink-0" />
                    <span>
                      <strong className="font-bold text-slate-900">Encadrant :</strong>{' '}
                      <span className="text-slate-800 font-semibold">{sujet.propose_par}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2 text-xs sm:text-sm font-bold">
                <span className="text-[#16a34a] inline-flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-[4px] border border-emerald-200 tabular-nums">
                  <Check className="w-3.5 h-3.5 text-[#16a34a] stroke-[2.5]" />
                  <span>
                    {sujet.nombre_places} {sujet.nombre_places > 1 ? 'places' : 'place'}
                  </span>
                </span>

                <span className="text-[#0f766e] group-hover:underline inline-flex items-center gap-1">
                  <span>Voir la fiche</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 3. PIED DE PAGE INSTITUTIONNEL : COORDONNÉES DU CEDOC & LIENS UTILES */}
      {/* ==================================================================== */}
      <footer className="bg-slate-900 text-slate-100 rounded-[6px] p-6 sm:p-8 border border-slate-800 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          
          {/* Colonne 1 : Présentation de l'École Doctorale */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-[6px] bg-[#0f766e] text-white flex items-center justify-center font-serif font-black text-base shrink-0">
                U
              </div>
              <div>
                <div className="font-serif font-bold text-base text-white leading-tight">
                  CEDoc — USMBA Fès
                </div>
                <div className="text-xs text-teal-300 font-semibold">
                  Université Sidi Mohamed Ben Abdellah
                </div>
              </div>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Centre des Études Doctorales chargé de la coordination des formations doctorales, de l’accréditation des sujets de recherche et du suivi administratif des doctorants.
            </p>
          </div>

          {/* Colonne 2 : Coordonnées du CEDoc */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-teal-300">
              Coordonnées du CEDoc
            </h3>
            <ul className="space-y-2.5 text-sm text-slate-200">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-teal-400 shrink-0 mt-1" />
                <span>Campus Universitaire Agdal, Route d’Imouzzer, B.P. 2626 — 30000 Fès, Maroc</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-teal-400 shrink-0" />
                <span className="tabular-nums">+212 (0) 5 35 60 96 60 / +212 (0) 5 35 60 80 14</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-teal-400 shrink-0" />
                <span>scolarite.cedoc@usmba.ac.ma</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Accueil : Lundi au Vendredi, 08h30 – 16h30</span>
              </li>
            </ul>
          </div>

          {/* Colonne 3 : Liens utiles */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-teal-300">
              Liens utiles
            </h3>
            <ul className="space-y-2 text-sm text-slate-200">
              <li>
                <button
                  type="button"
                  onClick={onCommencerCandidature}
                  className="hover:text-teal-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer text-left"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-teal-400" />
                  <span>Espace candidature & suivi de dossier</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOuvrirCalendrier?.('dates-importantes')}
                  className="hover:text-teal-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer text-left"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-teal-400" />
                  <span>Calendrier & Dates importantes</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOuvrirCalendrier?.('comment-ca-marche')}
                  className="hover:text-teal-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer text-left"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-teal-400" />
                  <span>Procédure d’admission en 4 étapes</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOuvrirCalendrier?.('pieces-a-preparer')}
                  className="hover:text-teal-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer text-left"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-teal-400" />
                  <span>Liste des pièces justificatives requises</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Colonne 4 : Établissements rattachés */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-teal-300">
              Établissements USMBA
            </h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span>Faculté des Sciences Dhar El Mahraz</span>
              </li>
              <li className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span>Faculté des Sciences et Techniques (FST Fès)</span>
              </li>
              <li className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span>Faculté de Médecine et de Pharmacie</span>
              </li>
              <li className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span>FSJES Fès &bull; ENSA Fès</span>
              </li>
            </ul>
          </div>

        </div>

        {/* Bas de pied de page : mention pédagogique et session */}
        <div className="pt-5 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-slate-400">
          <p className="font-bold text-slate-200">
            Modèle pédagogique, sans valeur juridique &bull; Projet académique non officiel
          </p>
          <p>
            Centre des Études Doctorales (CEDoc) &bull; Université Sidi Mohamed Ben Abdellah de Fès &bull; Session {campagne.annee_universitaire}
          </p>
        </div>
      </footer>

    </div>
  );
};

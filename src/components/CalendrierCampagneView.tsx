import React, { useEffect } from 'react';
import { Calendar, Check, ShieldCheck } from 'lucide-react';
import { VersionCampagne } from '../types';
import { formatDateJJMMAAAA } from '../utils/dateUtils';
import { BadgeCampagne } from './BadgeCampagne';

interface CalendrierCampagneViewProps {
  campagne: VersionCampagne;
  initialSectionId?: string | null;
  onSectionScrolled?: () => void;
}

export const CalendrierCampagneView: React.FC<CalendrierCampagneViewProps> = ({
  campagne,
  initialSectionId,
  onSectionScrolled
}) => {
  useEffect(() => {
    if (!initialSectionId) return;
    const el = document.getElementById(initialSectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (onSectionScrolled) {
      onSectionScrolled();
    }
  }, [initialSectionId, onSectionScrolled]);

  // 1. Chronologie des dates importantes
  const datesImportantes = [
    {
      etape: '01',
      titre: 'Ouverture des candidatures',
      date: `Le ${formatDateJJMMAAAA(campagne.date_ouverture)}`,
      detail: `Ouverture du portail et lancement officiel de la campagne doctorale ${campagne.annee_universitaire}.`,
      statut: 'Effectué'
    },
    {
      etape: '02',
      titre: 'Clôture des candidatures',
      date: `Le ${formatDateJJMMAAAA(campagne.date_cloture)}`,
      detail: `Date limite de sélection des sujets (jusqu'à ${campagne.nombre_max_sujets} choix) et de dépôt du dossier complet.`,
      statut: 'Échéance clé'
    },
    {
      etape: '03',
      titre: 'Entretiens oraux',
      date: `Immédiatement après le ${formatDateJJMMAAAA(campagne.date_cloture)}`,
      detail: 'Examen de recevabilité scientifique, entretiens oraux avec les encadrants et notation sur 20.',
      statut: 'Évaluation'
    },
    {
      etape: '04',
      titre: 'Délibération',
      date: 'Commissions de laboratoire',
      detail: 'Délibération de la commission de laboratoire et arbitrage des listes principales et d’attente.',
      statut: 'Arbitrage'
    },
    {
      etape: '05',
      titre: 'Publication des résultats',
      date: 'À l’issue des délibérations',
      detail: 'Annonce officielle des candidats admis sur le portail et notification dans l’espace candidat.',
      statut: 'Admission'
    },
    {
      etape: '06',
      titre: 'Dépôt physique du dossier',
      date: `Sous ${campagne.delai_inscription_jours} jours ouvrés après publication`,
      detail: 'Remise du dossier papier signé et légalisé (Fiche D1, Charte des thèses, Récépissé) au CEDoc.',
      statut: 'Inscription finale'
    }
  ];

  // 2. Dates associées aux 4 étapes du parcours
  const getDateEtape = (num: number): string => {
    switch (num) {
      case 1:
        return `Du ${formatDateJJMMAAAA(campagne.date_ouverture)} au ${formatDateJJMMAAAA(campagne.date_cloture)}`;
      case 2:
        return `Entretiens oraux et notation scientifique (immédiatement après le ${formatDateJJMMAAAA(campagne.date_cloture)})`;
      case 3:
        return `Délibération de la commission de laboratoire et arbitrage des listes`;
      case 4:
        return `Dépôt physique sous ${campagne.delai_inscription_jours} jours ouvrés après publication des résultats`;
      default:
        return '';
    }
  };

  // 3. Les 6 pièces justificatives obligatoires exigées pour la constitution du dossier
  const piecesJustificatives = [
    {
      numero: 1,
      titre: "Attestation de réussite de Licence",
      detail: "Original ou copie certifiée conforme de la Licence ou diplôme reconnu équivalent.",
      statut: "Obligatoire"
    },
    {
      numero: 2,
      titre: "Diplôme de Master ou d'Ingénieur d'État",
      detail: "Diplôme national ou attestation d'équivalence officielle pour les diplômes étrangers.",
      statut: "Obligatoire"
    },
    {
      numero: 3,
      titre: "Relevés de notes Master (S1 à S4)",
      detail: "Relevés officiels attestant des notes et mentions obtenues sur les 4 semestres.",
      statut: "Obligatoire"
    },
    {
      numero: 4,
      titre: "Projet de recherche rédigé",
      detail: "Note de cadrage scientifique (problématique, objectifs et méthodologie envisagée).",
      statut: "Obligatoire"
    },
    {
      numero: 5,
      titre: "Curriculum Vitae détaillé (CV)",
      detail: "Parcours académique, compétences, stages de recherche et travaux scientifiques.",
      statut: "Obligatoire"
    },
    {
      numero: 6,
      titre: "Carte d'identité nationale (CIN)",
      detail: "PDF unique regroupant obligatoirement les 2 faces (Recto page 1, Verso page 2).",
      statut: "Obligatoire"
    }
  ];

  return (
    <div className="space-y-8 pb-10 text-slate-900">
      {/* En-tête de la page Calendrier de la campagne */}
      <section className="space-y-2 pt-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 leading-tight font-serif">
            Calendrier de la campagne — {campagne.annee_universitaire}
          </h1>
          <BadgeCampagne campagne={campagne} />
        </div>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-3xl">
          Échéances officielles, déroulement de la procédure d’admission et liste des pièces justificatives pour l’inscription en 1ère année de doctorat (CEDoc USMBA Fès).
        </p>
      </section>

      {/* ==================================================================== */}
      {/* 1. SECTION « DATES IMPORTANTES » SOUS FORME DE CHRONOLOGIE           */}
      {/* ==================================================================== */}
      <section
        id="dates-importantes"
        className="bg-white p-6 sm:p-8 rounded-[6px] border border-slate-300 shadow-xs space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <div className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#0f766e] flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>Calendrier officiel de la session {campagne.annee_universitaire}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 font-serif">
              Dates importantes
            </h2>
            <p className="text-sm sm:text-base text-slate-700 mt-1">
              Chronologie réglementaire des opérations d’admission au cycle doctoral USMBA
            </p>
          </div>
          <div className="text-xs sm:text-sm font-bold text-[#0f766e] bg-[#f0fdfa] border border-[#99f6e4] px-3.5 py-2 rounded-[6px] tabular-nums self-start sm:self-auto">
            Campagne active : {formatDateJJMMAAAA(campagne.date_ouverture)} &rarr; {formatDateJJMMAAAA(campagne.date_cloture)}
          </div>
        </div>

        {/* Chronologie horizontale sur grand écran / verticale sur mobile */}
        <div className="relative">
          {/* Ligne de liaison horizontale (Desktop) */}
          <div
            aria-hidden="true"
            className="hidden lg:block absolute top-5 left-6 right-6 h-0.5 bg-slate-200 z-0"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 relative z-10">
            {datesImportantes.map((item, idx) => (
              <div
                key={item.etape}
                className="bg-[#f8fafc] p-4 rounded-[6px] border border-slate-200 hover:border-[#0f766e] transition-colors flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`w-8 h-8 rounded-[6px] font-bold text-xs sm:text-sm flex items-center justify-center shrink-0 shadow-2xs tabular-nums ${
                      idx === 5
                        ? 'bg-[#16a34a] text-white'
                        : 'bg-[#0f766e] text-white'
                    }`}>
                      {item.etape}
                    </span>
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                      {item.statut}
                    </span>
                  </div>

                  <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                    {item.titre}
                  </h3>

                  <div className="text-xs sm:text-sm font-bold text-[#0f766e] bg-[#f0fdfa] border border-[#ccfbf1] px-2.5 py-1 rounded-[4px] inline-block tabular-nums">
                    {item.date}
                  </div>

                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                    {item.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 2. SECTION « COMMENT ÇA MARCHE » : LES 4 ÉTAPES DE LA CAMPAGNE       */}
      {/* ==================================================================== */}
      <section
        id="comment-ca-marche"
        className="bg-white p-6 sm:p-8 rounded-[6px] border border-slate-300 shadow-xs space-y-6"
      >
        <div className="border-b border-slate-200 pb-4">
          <div className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#0f766e]">
            Procédure d'admission
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 font-serif">
            Comment ça marche
          </h2>
          <p className="text-sm sm:text-base text-slate-700 mt-1">
            Le parcours réglementaire en 4 étapes défini par le Centre des Études Doctorales USMBA
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {campagne.etapes.map((etape) => (
            <div
              key={etape.numero}
              className="p-5 rounded-[6px] bg-[#f8fafc] border border-slate-200 space-y-3.5 flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-[6px] bg-[#0f766e] text-white font-bold text-sm flex items-center justify-center shrink-0 tabular-nums">
                    {etape.numero}
                  </span>
                  <h3 className="font-extrabold text-slate-900 text-base leading-snug">
                    {etape.titre}
                  </h3>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {etape.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 text-xs sm:text-sm font-bold text-[#0f766e] flex items-center gap-2">
                <Calendar className="w-4 h-4 shrink-0" />
                <span>{getDateEtape(etape.numero)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 3. SECTION « PIÈCES À PRÉPARER » : CARTES PLUS COMPACTES & LISIBLES  */}
      {/* ==================================================================== */}
      <section
        id="pieces-a-preparer"
        className="bg-white p-6 sm:p-8 rounded-[6px] border border-slate-300 shadow-xs space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <div className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#0f766e]">
              Constitution du dossier électronique
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 font-serif">
              Pièces à préparer
            </h2>
            <p className="text-sm sm:text-base text-slate-700 mt-1">
              Les 6 justificatifs obligatoires à téléverser pour valider votre candidature en 1ère année de doctorat
            </p>
          </div>

          <div className="px-3.5 py-2 rounded-[6px] bg-[#f0fdfa] border border-[#99f6e4] text-xs sm:text-sm text-slate-900 font-semibold self-start sm:self-auto">
            Format exigé : <strong className="text-[#0f766e]">{campagne.format_fichier_autorise} uniquement</strong> &bull; Max <strong className="text-[#0f766e]">{campagne.taille_max_fichier_mo} Mo / fichier</strong>
          </div>
        </div>

        {/* Grille compacte 3 colonnes pour les 6 pièces justificatives */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {piecesJustificatives.map((piece) => (
            <div
              key={piece.numero}
              className="p-3.5 rounded-[6px] bg-[#f8fafc] border border-slate-200 flex flex-col justify-between space-y-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-[4px] bg-[#0f766e] text-white text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
                    {piece.numero}
                  </span>
                  <h3 className="font-extrabold text-slate-900 text-sm leading-snug">
                    {piece.titre}
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-[#16a34a] bg-emerald-50 px-2 py-0.5 rounded-[4px] border border-emerald-200 inline-flex items-center gap-1 shrink-0">
                  <Check className="w-3 h-3 text-[#16a34a] stroke-[2.5]" />
                  <span>PDF</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 leading-snug pl-8">
                {piece.detail}
              </p>
            </div>
          ))}
        </div>

        <div className="p-3.5 rounded-[6px] bg-slate-100 border border-slate-300 text-xs sm:text-sm text-slate-800 flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-[#0f766e] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Dépôt physique après admission :</strong> La fiche d’inscription D1, la charte des thèses et le récépissé de dépôt générés par la plateforme devront être signés et légalisés lors de l’inscription définitive au secrétariat du CEDoc.
          </p>
        </div>
      </section>
    </div>
  );
};

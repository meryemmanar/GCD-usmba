import React, { useState } from 'react';
import { Building2, Check, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { Candidature, SujetThese, UserAccount } from '../types';

interface StructureViewProps {
  currentUser?: UserAccount | null;
  sujets: SujetThese[];
  candidatures: Candidature[];
  onValiderSujet: (id: string) => void;
  onDecisionEtape2: (candidatureId: string, resultat: 'FAVORABLE' | 'DEFAVORABLE', motif: string) => void;
}

export const StructureView: React.FC<StructureViewProps> = ({
  currentUser,
  sujets,
  candidatures,
  onValiderSujet,
  onDecisionEtape2
}) => {
  const [modalDecision, setModalDecision] = useState<{
    candidatureId: string;
    decision: 'FAVORABLE' | 'DEFAVORABLE';
  } | null>(null);
  const [motifStructure, setMotifStructure] = useState('');
  const [erreurStructure, setErreurStructure] = useState('');

  const monLaboratoire = currentUser?.etablissement || "Laboratoire d'Informatique et Systèmes (LIS)";

  const [sujetEnConsultation, setSujetEnConsultation] = useState<SujetThese | null>(null);

  const cleanLab = (lab?: string) => (lab || '').toLowerCase().replace(/['’]/g, "'").trim();
  const matchLab = (lab1?: string, lab2?: string) => {
    if (!lab1 || !lab2) return false;
    const c1 = cleanLab(lab1);
    const c2 = cleanLab(lab2);
    return c1.includes(c2) || c2.includes(c1);
  };

  // Une direction de structure ne voit que les dossiers à avis favorable dont le sujet retenu appartient à son laboratoire (ou lui a été réaffecté)
  const candidaturesEtape2 = candidatures.filter(c => {
    if (c.statut === 'BROUILLON') return false;
    const aAvisFavorable = c.etape1 && ['LISTE_PRINCIPALE', 'LISTE_ATTENTE'].includes(c.etape1.resultat || '');
    if (!aAvisFavorable) return false;
    const p1Item = c.choix_sujets.find(cs => cs.priorite === 1) || c.choix_sujets[0];
    const sujetRetenu = p1Item?.sujet;
    if (!sujetRetenu) return false;
    if (currentUser?.id && (c.directeur_structure_reaffecte_id === currentUser.id || sujetRetenu.directeur_structure_reaffecte_id === currentUser.id)) {
      return true;
    }
    if (sujetRetenu.directeur_structure_reaffecte_id && currentUser?.id && sujetRetenu.directeur_structure_reaffecte_id !== currentUser.id) {
      return false;
    }
    return matchLab(sujetRetenu.structure, monLaboratoire);
  });

  const sujetsEnAttente = sujets.filter(s => {
    if (s.validation_structure !== 'EN_ATTENTE') return false;
    if (currentUser?.id && s.directeur_structure_reaffecte_id === currentUser.id) {
      return true;
    }
    if (s.directeur_structure_reaffecte_id && currentUser?.id && s.directeur_structure_reaffecte_id !== currentUser.id) {
      return false;
    }
    return matchLab(s.structure, monLaboratoire);
  });

  return (
    <div className="space-y-8 pb-16">
      <div className="bg-white p-6 sm:p-8 rounded-[6px] border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-bold text-[#0f766e] uppercase tracking-wider">
          <Building2 className="w-4 h-4 text-[#0f766e]" />
          Direction de Structure de Recherche
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5 font-serif">
          {monLaboratoire}
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Accréditation des sujets et arbitrage final d'admission pour inscription au CEDoc {currentUser ? `• ${currentUser.prenom} ${currentUser.nom}` : ''}
        </p>
      </div>

      {/* SECTION 1: ACCRÉDITATION DES SUJETS */}
      <div className="bg-white p-6 sm:p-8 rounded-[6px] border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 font-serif">1. Accréditation des Sujets de Thèse</h2>
            <p className="text-xs text-slate-500">Validation par le conseil de laboratoire avant publication publique au catalogue</p>
          </div>
          <span className="text-xs font-bold bg-amber-100 text-amber-800 px-3 py-1 rounded-[4px]">
            {sujetsEnAttente.length} en attente
          </span>
        </div>

        {sujetsEnAttente.length === 0 ? (
          <div className="p-6 bg-slate-50 rounded-[6px] text-center text-xs text-slate-400">
            Tous les sujets soumis par les encadrants de la structure ont été accrédités.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sujetsEnAttente.map(s => (
              <div key={s.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-[4px]">
                      {s.id.toUpperCase()}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm font-serif">{s.titre}</h3>
                  </div>
                  <p className="text-slate-500 mt-1">
                    Proposé par <strong className="text-slate-700">{s.propose_par}</strong> &bull; Thème : {s.theme} &bull; {s.nombre_places === 1 ? '1 place' : `${s.nombre_places} places`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setSujetEnConsultation(s)}
                    className="border border-slate-300 text-slate-700 hover:bg-slate-50 px-3 py-2 rounded-[6px] font-bold text-xs cursor-pointer transition shadow-2xs"
                  >
                    Consulter
                  </button>
                  <button
                    onClick={() => onValiderSujet(s.id)}
                    className="bg-[#0f766e] hover:bg-[#115e59] text-white px-4 py-2 rounded-[6px] font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <Check className="w-4 h-4 text-[#86efac] stroke-[2.5]" /> Accréditer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL CONSULTATION SUJET */}
      {sujetEnConsultation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[6px] max-w-xl w-full p-6 sm:p-8 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-mono text-xs font-bold text-[#0f766e] bg-[#f0fdfa] px-2 py-0.5 rounded-[4px]">
                {sujetEnConsultation.id.toUpperCase()}
              </span>
              <button
                onClick={() => setSujetEnConsultation(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 font-serif">
                {sujetEnConsultation.titre}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Laboratoire : {sujetEnConsultation.structure} &bull; Encadrant : {sujetEnConsultation.propose_par}
              </p>
            </div>
            <div className="space-y-3 text-xs bg-slate-50 p-4 rounded-[6px] border border-slate-200">
              <div>
                <span className="font-bold text-slate-700">Thématique :</span>
                <p className="text-slate-600 mt-0.5">{sujetEnConsultation.theme}</p>
              </div>
              <div>
                <span className="font-bold text-slate-700">Description / Résumé du projet :</span>
                <p className="text-slate-600 mt-0.5 whitespace-pre-line leading-relaxed">
                  {sujetEnConsultation.description || 'Aucune description détaillée fournie.'}
                </p>
              </div>
              <div className="flex items-center gap-4 text-slate-700 pt-1">
                <span><strong>Places ouvertes :</strong> {sujetEnConsultation.nombre_places}</span>
                <span><strong>Statut actuel :</strong> En attente d'accréditation</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setSujetEnConsultation(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[6px] text-xs font-bold cursor-pointer"
              >
                Fermer
              </button>
              <button
                onClick={() => {
                  onValiderSujet(sujetEnConsultation.id);
                  setSujetEnConsultation(null);
                }}
                className="px-4 py-2 bg-[#0f766e] hover:bg-[#115e59] text-white rounded-[6px] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Check className="w-4 h-4 text-[#86efac] stroke-[2.5]" /> Accréditer ce sujet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: DÉCISION FINALE ÉTAPE 2 */}
      <div className="bg-white p-6 sm:p-8 rounded-[6px] border border-slate-200 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 font-serif">2. Décision Finale d'Étape 2 pour Inscription</h2>
          <p className="text-xs text-slate-500">Dossiers ayant reçu un avis favorable (LP ou LA) du directeur de thèse</p>
        </div>

        {candidaturesEtape2.length === 0 ? (
          <div className="p-8 bg-slate-50 rounded-[6px] text-center text-xs text-slate-400">
            Aucun dossier en attente d'arbitrage de structure.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Candidat</th>
                  <th className="py-3 px-4">Avis de l'encadrant</th>
                  <th className="py-3 px-4">Note Entretien</th>
                  <th className="py-3 px-4">Sujet Retenu</th>
                  <th className="py-3 px-4 text-right">Arbitrage Structure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {candidaturesEtape2.map(cand => {
                  const avisLisible = cand.etape1?.resultat === 'LISTE_PRINCIPALE'
                    ? 'Liste principale'
                    : cand.etape1?.resultat === 'LISTE_ATTENTE'
                      ? "Liste d'attente"
                      : cand.etape1?.resultat === 'REJETE'
                        ? 'Non retenu'
                        : "En attente d'instruction";

                  const noteLisible = cand.etape1?.note !== undefined
                    ? `${String(cand.etape1.note).replace('.', ',')} / 20`
                    : '-';

                  return (
                    <tr key={cand.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {cand.candidat_nom} {cand.candidat_prenom}
                        <span className="block text-[10px] font-mono font-normal text-slate-500">
                          {cand.reference || cand.id}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-extrabold text-[#0f766e] bg-[#f0fdfa] px-2.5 py-1 rounded-[4px] border border-[#ccfbf1]">
                          {avisLisible}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-extrabold text-slate-800">
                        {noteLisible}
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-700 font-medium">
                        {cand.choix_sujets[0]?.sujet.titre}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {/* Boutons Favorable et Défavorable avec contour et icône pour ne pas ressembler aux boutons principaux */}
                        <button
                          onClick={() => setModalDecision({ candidatureId: cand.id, decision: 'FAVORABLE' })}
                          className="inline-flex items-center gap-1.5 border border-[#16a34a] text-[#16a34a] hover:bg-emerald-50 px-3 py-1.5 rounded-[6px] font-bold text-xs cursor-pointer transition shadow-2xs bg-white"
                          title="Accorder un avis favorable"
                        >
                          <Check className="w-3.5 h-3.5 text-[#16a34a] stroke-[2.5]" />
                          <span>Favorable (Accepter)</span>
                        </button>
                        <button
                          onClick={() => setModalDecision({ candidatureId: cand.id, decision: 'DEFAVORABLE' })}
                          className="inline-flex items-center gap-1.5 border border-rose-600 text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-[6px] font-bold text-xs cursor-pointer transition shadow-2xs bg-white"
                          title="Accorder un avis défavorable"
                        >
                          <X className="w-3.5 h-3.5 text-rose-600 stroke-[2.5]" />
                          <span>Défavorable (Refuser)</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL ARBITRAGE STRUCTURE */}
      {modalDecision && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[6px] max-w-md w-full p-6 sm:p-8 space-y-4 shadow-xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-slate-900 font-serif">
                Arbitrage :{' '}
                <span className={modalDecision.decision === 'FAVORABLE' ? 'text-[#16a34a]' : 'text-rose-700'}>
                  {modalDecision.decision === 'FAVORABLE' ? 'Favorable (Admis)' : 'Défavorable (Refus)'}
                </span>
              </h3>
              <button 
                onClick={() => setModalDecision(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalDecision.decision === 'FAVORABLE' ? (
              <div className="p-3.5 bg-emerald-50 rounded-[6px] border border-emerald-200 text-xs text-emerald-900 space-y-1">
                <span className="font-bold flex items-center gap-1.5 text-[#16a34a]">
                  <CheckCircle2 className="w-4 h-4 text-[#16a34a] shrink-0" />
                  Confirmation d'Admission Officielle
                </span>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  En validant cet arbitrage, le candidat passera au statut <strong>Admis</strong> et recevra une notification lui impartissant <strong>10 jours ouvrés</strong> pour déposer son récépissé officiel et son dossier physique.
                </p>
              </div>
            ) : (
              <div className="p-3.5 bg-rose-50 rounded-[6px] border border-rose-200 text-xs text-rose-900 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  Avis Défavorable (Refus)
                </span>
                <p className="text-[11px] text-rose-800 leading-relaxed">
                  Le motif saisi est <strong>obligatoire</strong> et sera communiqué de façon transparente dans l'espace personnel du candidat.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {modalDecision.decision === 'DEFAVORABLE' 
                  ? 'Motif obligatoire du refus (visible par le candidat) * :' 
                  : "Observations pour l'admission (facultatif) :"}
              </label>
              <textarea
                value={motifStructure}
                placeholder={
                  modalDecision.decision === 'DEFAVORABLE'
                    ? "Ex: Capacité d'accueil du laboratoire atteinte, inadéquation du profil scientifique..."
                    : "Observations ou recommandations..."
                }
                className="w-full text-xs p-3 border border-slate-200 rounded-[6px] bg-white focus:ring-2 focus:ring-[#0f766e] focus:outline-none"
                rows={3}
                onChange={(e) => {
                  setMotifStructure(e.target.value);
                  setErreurStructure('');
                }}
              />
              {erreurStructure && (
                <p className="text-xs text-rose-600 font-bold">{erreurStructure}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button 
                onClick={() => {
                  setModalDecision(null);
                  setMotifStructure('');
                  setErreurStructure('');
                }} 
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[6px] text-xs font-bold cursor-pointer transition"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  if (modalDecision.decision === 'DEFAVORABLE' && !motifStructure.trim()) {
                    setErreurStructure("Le motif de refus est obligatoire pour une décision défavorable.");
                    return;
                  }
                  const finalMotif = motifStructure.trim() || 
                    (modalDecision.decision === 'FAVORABLE' 
                      ? "Dossier conforme et validé par la commission de structure pour inscription au CEDoc." 
                      : "");
                  onDecisionEtape2(modalDecision.candidatureId, modalDecision.decision, finalMotif);
                  setModalDecision(null);
                  setMotifStructure('');
                  setErreurStructure('');
                }}
                className={`px-5 py-2 text-white rounded-[6px] text-xs font-bold cursor-pointer transition shadow-xs ${
                  modalDecision.decision === 'FAVORABLE' 
                    ? 'bg-[#16a34a] hover:bg-emerald-700' 
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                Confirmer l'arbitrage
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

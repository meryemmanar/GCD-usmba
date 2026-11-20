import React, { useState } from 'react';
import { FileText, Printer, X, QrCode, CheckCircle2, ShieldCheck, PenTool, BookOpen, Download } from 'lucide-react';
import { Candidature, VersionCampagne } from '../types';
import { formatDateJJMMAAAA } from '../utils/dateUtils';
import { generateCharteThesesPdf, generateFicheD1Pdf, generateRecepissePdf, downloadFile } from '../utils/pdfUtils';

interface ModalApercuOfficielProps {
  titre: string;
  code: string;
  candidature: Candidature;
  campagne: VersionCampagne;
  onClose: () => void;
}

export const ModalApercuOfficiel: React.FC<ModalApercuOfficielProps> = ({
  titre,
  code,
  candidature,
  campagne,
  onClose
}) => {
  const isBrouillon = candidature.statut === 'BROUILLON';
  const isFiche = code === 'FORM-F1' || titre.toLowerCase().includes('fiche');
  const isCharte = code === 'CHARTE-D' || titre.toLowerCase().includes('charte');
  const isRecepisse = code === 'REC-2026' || titre.toLowerCase().includes('récépissé');

  const [telechargeant, setTelechargeant] = useState(false);

  const handleTelechargerPdf = async () => {
    try {
      setTelechargeant(true);
      if (isCharte) {
        const { blob } = await generateCharteThesesPdf();
        downloadFile(blob, 'Charte_des_Theses_USMBA.pdf');
      } else if (isFiche) {
        const { blob } = await generateFicheD1Pdf(candidature, campagne);
        const safeNom = (candidature.candidat_nom || 'Candidat').replace(/\s+/g, '_');
        downloadFile(blob, `Fiche_Inscription_D1_${safeNom}.pdf`);
      } else if (isRecepisse) {
        const { blob } = await generateRecepissePdf(candidature, campagne);
        const safeRef = (candidature.reference || candidature.id || 'Dossier').replace(/\s+/g, '_');
        const safeNom = (candidature.candidat_nom || 'Candidat').replace(/\s+/g, '_');
        downloadFile(blob, `Recepisse_Depot_${safeRef}_${safeNom}.pdf`);
      } else {
        window.print();
      }
    } catch (err) {
      console.error("Erreur lors du téléchargement :", err);
      window.print();
    } finally {
      setTelechargeant(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in">
      <div className="bg-white w-full max-w-3xl max-h-[92vh] rounded-[6px] shadow-2xl border border-slate-300 overflow-hidden flex flex-col my-auto">
        
        {/* Barre d'outils du visualisateur */}
        <div className="bg-[#0f766e] text-white px-6 py-4 flex items-center justify-between border-b border-teal-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-teal-200" />
            <div>
              <span className="font-extrabold text-sm">{titre}</span>
              <span className="text-[10px] text-teal-100 block font-mono">
                Réf. Document : {code}-USMBA-{candidature.reference || candidature.id}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(isCharte || isFiche || (isRecepisse && !isBrouillon)) && (
              <button
                type="button"
                onClick={handleTelechargerPdf}
                disabled={telechargeant}
                className="bg-white text-[#0f766e] hover:bg-teal-50 px-3.5 py-1.5 rounded-[6px] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                title="Télécharger directement le fichier PDF officiel"
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  {telechargeant
                    ? 'Génération...'
                    : isRecepisse
                      ? 'Télécharger le récépissé (PDF)'
                      : 'Télécharger PDF'}
                </span>
              </button>
            )}
            <button
              onClick={() => window.print()}
              className="bg-white/15 hover:bg-white/25 text-white px-3.5 py-1.5 rounded-[6px] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition"
            >
              <Printer className="w-4 h-4" /> Imprimer / PDF
            </button>
            <button 
              onClick={onClose} 
              className="p-1.5 text-teal-100 hover:text-white rounded-[4px] hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Corps du Document Stylisé */}
        <div className="p-8 sm:p-12 overflow-y-auto space-y-6 text-slate-800 text-xs font-serif bg-slate-50/40 flex-1">
          
          {/* En-tête obligatoire conforme : Modèle pédagogique, sans valeur juridique */}
          <div className="text-center border-b-2 border-slate-900 pb-5 space-y-1.5">
            <div className="text-xs uppercase tracking-widest text-slate-500 font-sans font-bold">
              Modèle pédagogique, sans valeur juridique
            </div>
            <div className="text-sm sm:text-base font-black uppercase tracking-wide text-slate-900 font-sans">
              Université Sidi Mohamed Ben Abdellah de Fès
            </div>
            <div className="text-xs font-semibold text-slate-600 font-sans">
              Centre des Études Doctorales (CEDoc) &bull; Session Universitaire {campagne.annee_universitaire}
            </div>
            <div className="pt-2">
              <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-[#0f766e] font-sans underline decoration-2 underline-offset-4">
                {titre}
              </h2>
            </div>
          </div>

          {/* ==================================================================== */}
          {/* CAS 1 : FICHE D'INSCRIPTION D1                                       */}
          {/* ==================================================================== */}
          {isFiche && (
            <div className="space-y-6">
              {/* 1. Données administratives */}
              <div className="bg-white p-5 rounded-[6px] border border-slate-200 font-sans space-y-3 shadow-2xs">
                <h4 className="font-extrabold text-xs text-[#0f766e] uppercase tracking-wider border-b pb-1.5 font-serif">
                  1. Informations Administratives du Candidat
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>Nom &amp; Prénom : <strong className="text-slate-900">{candidature.candidat_nom} {candidature.candidat_prenom}</strong></div>
                  <div>CNE / Code Massar : <strong className="font-mono text-slate-900">{candidature.candidat_cne}</strong></div>
                  <div>N° CIN / Passeport : <strong className="font-mono text-slate-900">{candidature.candidat_cin || 'CD712345'}</strong></div>
                  <div>Courriel : <strong className="text-slate-900">{candidature.candidat_email}</strong></div>
                  <div>Statut du Dossier : <strong className="text-[#0f766e]">{candidature.statut}</strong></div>
                  <div>
                    {isBrouillon ? (
                      <span className="text-rose-700 font-bold">Date de dépôt : Non déposé</span>
                    ) : (
                      <span>Date de dépôt : <strong className="text-slate-900">{formatDateJJMMAAAA(candidature.date_soumission || candidature.date_creation)}</strong></span>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Sujets sélectionnés par ordre de priorité */}
              <div className="bg-white p-5 rounded-[6px] border border-slate-200 font-sans space-y-3 shadow-2xs">
                <h4 className="font-extrabold text-xs text-[#0f766e] uppercase tracking-wider border-b pb-1.5 font-serif">
                  2. Sujets de Thèse Sélectionnés par Ordre de Priorité
                </h4>
                <div className="space-y-2.5">
                  {candidature.choix_sujets.map((cs) => (
                    <div key={cs.sujet.id} className="p-3 bg-slate-50 rounded-[6px] border border-slate-200 flex items-start gap-3">
                      <span className="font-black text-[#0f766e] bg-[#f0fdfa] border border-[#ccfbf1] px-2 py-0.5 rounded-[4px] text-[11px] shrink-0">
                        Choix n°{cs.priorite}
                      </span>
                      <div>
                        <h5 className="font-bold text-slate-900 text-xs">{cs.sujet.titre}</h5>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Encadrant : <strong>{cs.sujet.propose_par}</strong> &bull; Structure : {cs.sujet.structure} ({cs.sujet.etablissement})
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Engagement sur l'honneur */}
              <div className="bg-white p-5 rounded-[6px] border border-slate-200 font-sans space-y-2 shadow-2xs">
                <h4 className="font-extrabold text-xs text-[#0f766e] uppercase tracking-wider border-b pb-1.5 font-serif">
                  3. Engagement sur l'Honneur du Candidat
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed italic">
                  « Je soussigné(e) <strong>{candidature.candidat_prenom} {candidature.candidat_nom}</strong>, certifie sur l'honneur l'exactitude absolue des renseignements consignés dans la présente fiche d'inscription et l'authenticité de l'ensemble des pièces justificatives téléversées. J'ai pris pleine connaissance des conditions d'admission au Cycle Doctoral de l'USMBA et m'engage à me conformer au règlement des études doctorales. »
                </p>
              </div>

              {/* 4. Zone de signature */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-sans pt-2">
                <div className="border-2 border-dashed border-slate-400 p-4 rounded-[6px] h-36 flex flex-col justify-between bg-white text-center">
                  <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                    Signature Manuscrite Légalisée du Candidat
                  </span>
                  <span className="text-[10px] text-slate-400 italic">
                    (Précédée de la mention manuscrite "Lu et approuvé")
                  </span>
                </div>
                <div className="border-2 border-dashed border-slate-400 p-4 rounded-[6px] h-36 flex flex-col justify-between bg-white text-center">
                  <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                    Visa &amp; Avis du Directeur de Thèse
                  </span>
                  <span className="text-[10px] text-slate-400 italic">
                    (Date, signature et cachet académique)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================================== */}
          {/* CAS 2 : CHARTE DES THÈSES (SANS DONNÉES PERSONNELLES DU CANDIDAT)     */}
          {/* ==================================================================== */}
          {isCharte && (
            <div className="space-y-5 font-sans">
              <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-[6px] text-xs text-teal-900 font-medium">
                La présente Charte définit les droits et engagements réciproques du doctorant, de la structure de recherche et de l'encadrant au sein du CEDoc USMBA.
              </div>

              {/* Droits & Engagements du Doctorant */}
              <div className="bg-white p-5 rounded-[6px] border border-slate-200 space-y-2 shadow-2xs">
                <h4 className="font-extrabold text-xs text-[#0f766e] uppercase tracking-wider font-serif">
                  Article 1 : Droits et Engagements du Doctorant
                </h4>
                <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-1.5 leading-relaxed">
                  <li>Consacrer le temps nécessaire à la réalisation des travaux de recherche conformément au calendrier convenu.</li>
                  <li>Participer activement aux séminaires, journées doctorales et formations transversales dispensées par le CEDoc.</li>
                  <li>Respecter scrupuleusement les règles d'intégrité scientifique, d'éthique et de prévention du plagiat.</li>
                  <li>Fournir un rapport d'avancement annuel régulier validé par l'encadrant de thèse.</li>
                </ul>
              </div>

              {/* Rôle & Engagements du Directeur de Thèse */}
              <div className="bg-white p-5 rounded-[6px] border border-slate-200 space-y-2 shadow-2xs">
                <h4 className="font-extrabold text-xs text-[#0f766e] uppercase tracking-wider font-serif">
                  Article 2 : Engagements du Directeur de Thèse
                </h4>
                <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-1.5 leading-relaxed">
                  <li>Assurer un suivi scientifique régulier, personnalisé et périodique de l'avancement des recherches.</li>
                  <li>Guider le doctorant dans la démarche méthodologique et la valorisation scientifique des résultats.</li>
                  <li>Faciliter l'accès aux réseaux scientifiques et favoriser les publications dans des revues indexées.</li>
                  <li>Veiller au respect du délai réglementaire de préparation de la thèse (3 à 5 ans au maximum).</li>
                </ul>
              </div>

              {/* Engagements du Laboratoire et de la Structure */}
              <div className="bg-white p-5 rounded-[6px] border border-slate-200 space-y-2 shadow-2xs">
                <h4 className="font-extrabold text-xs text-[#0f766e] uppercase tracking-wider font-serif">
                  Article 3 : Engagements de la Structure de Recherche
                </h4>
                <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-1.5 leading-relaxed">
                  <li>Accueillir le doctorant au sein d'une équipe de recherche accréditée et lui assurer l'environnement adéquat.</li>
                  <li>Mettre à disposition les ressources documentaires, équipements techniques et plateformes d'analyse.</li>
                  <li>Garantir la conformité des thématiques avec les axes prioritaires nationaux et régionaux.</li>
                </ul>
              </div>

              {/* Zones de Signature (Sans données personnelles du candidat) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="border-2 border-dashed border-slate-400 p-4 rounded-[6px] h-32 flex flex-col justify-between bg-white text-center">
                  <span className="text-[10px] font-bold text-slate-800 uppercase">Le Doctorant</span>
                  <span className="text-[9px] text-slate-400 italic">Lu et approuvé (Signature)</span>
                </div>
                <div className="border-2 border-dashed border-slate-400 p-4 rounded-[6px] h-32 flex flex-col justify-between bg-white text-center">
                  <span className="text-[10px] font-bold text-slate-800 uppercase">Le Directeur de Thèse</span>
                  <span className="text-[9px] text-slate-400 italic">Signature &amp; Cachet</span>
                </div>
                <div className="border-2 border-dashed border-slate-400 p-4 rounded-[6px] h-32 flex flex-col justify-between bg-white text-center">
                  <span className="text-[10px] font-bold text-slate-800 uppercase">Le Directeur du Laboratoire</span>
                  <span className="text-[9px] text-slate-400 italic">Visa &amp; Cachet de la structure</span>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================================== */}
          {/* CAS 3 : RÉCÉPISSÉ DE DÉPÔT                                           */}
          {/* ==================================================================== */}
          {isRecepisse && (
            <div className="space-y-6 font-sans">
              {isBrouillon ? (
                <div className="p-8 text-center bg-slate-100 rounded-[6px] border border-slate-300 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mx-auto">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm font-serif">Récépissé non disponible</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Le récépissé officiel de dépôt est généré automatiquement dès la soumission définitive de votre dossier.
                  </p>
                  <span className="inline-block px-3 py-1 bg-amber-100 text-amber-800 rounded-[4px] font-bold text-xs">
                    Date de dépôt : Non déposé
                  </span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Carte d'homologation & QR Code */}
                  <div className="bg-white p-6 rounded-[6px] border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xs">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-2 text-[#16a34a] font-bold text-xs">
                        <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
                        <span>Candidature Officiellement Enregistrée</span>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-slate-500">Référence Unique du Dossier :</div>
                        <div className="text-xl font-mono font-black text-slate-900 tracking-wider">
                          {candidature.reference || candidature.id}
                        </div>
                      </div>
                      <div className="text-xs text-slate-600">
                        Date et heure de soumission :{' '}
                        <strong className="text-slate-900 font-mono">
                          {candidature.date_soumission 
                            ? `${formatDateJJMMAAAA(candidature.date_soumission)} à 14:32:00` 
                            : 'Non déposé'}
                        </strong>
                      </div>
                    </div>

                    {/* QR Code Simulé institutionnel */}
                    <div className="p-4 bg-slate-50 rounded-[6px] border border-slate-200 flex flex-col items-center gap-2 shrink-0">
                      <div className="w-28 h-28 bg-white p-2 border border-slate-300 rounded-[4px] flex items-center justify-center shadow-2xs relative">
                        {/* Motif QR Code stylisé */}
                        <div className="grid grid-cols-5 gap-1 w-full h-full p-1 bg-slate-900/5 rounded">
                          <div className="bg-slate-900 rounded-[2px]" />
                          <div className="bg-slate-900 rounded-[2px]" />
                          <div className="bg-transparent" />
                          <div className="bg-slate-900 rounded-[2px]" />
                          <div className="bg-slate-900 rounded-[2px]" />
                          
                          <div className="bg-slate-900 rounded-[2px]" />
                          <div className="bg-transparent" />
                          <div className="bg-slate-900 rounded-[2px]" />
                          <div className="bg-transparent" />
                          <div className="bg-slate-900 rounded-[2px]" />

                          <div className="bg-transparent" />
                          <div className="bg-slate-900 rounded-[2px]" />
                          <div className="bg-[#0f766e] rounded-[2px]" />
                          <div className="bg-slate-900 rounded-[2px]" />
                          <div className="bg-transparent" />

                          <div className="bg-slate-900 rounded-[2px]" />
                          <div className="bg-transparent" />
                          <div className="bg-slate-900 rounded-[2px]" />
                          <div className="bg-transparent" />
                          <div className="bg-slate-900 rounded-[2px]" />

                          <div className="bg-slate-900 rounded-[2px]" />
                          <div className="bg-slate-900 rounded-[2px]" />
                          <div className="bg-transparent" />
                          <div className="bg-slate-900 rounded-[2px]" />
                          <div className="bg-slate-900 rounded-[2px]" />
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 font-bold">
                        Vérification CEDoc USMBA
                      </span>
                    </div>
                  </div>

                  {/* Synthèse des données du candidat */}
                  <div className="bg-white p-5 rounded-[6px] border border-slate-200 space-y-2 text-xs">
                    <h4 className="font-bold text-slate-900 border-b pb-1 font-serif">Titulaire du Dossier</h4>
                    <div className="grid grid-cols-2 gap-2 text-slate-700">
                      <div>Candidat : <strong>{candidature.candidat_nom} {candidature.candidat_prenom}</strong></div>
                      <div>CNE : <strong className="font-mono">{candidature.candidat_cne}</strong></div>
                      <div>CIN : <strong className="font-mono">{candidature.candidat_cin || 'CD712345'}</strong></div>
                      <div>Courriel : <strong>{candidature.candidat_email}</strong></div>
                      <div className="col-span-2">Sujet retenu n°1 : <strong>{candidature.choix_sujets[0]?.sujet.titre}</strong></div>
                    </div>
                  </div>

                  {/* Bouton d'action directe dans le récépissé de dépôt */}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleTelechargerPdf}
                      disabled={telechargeant}
                      className="px-4 py-2.5 bg-[#0f766e] hover:bg-[#115e59] text-white rounded-[6px] text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs transition"
                    >
                      <Download className="w-4 h-4" />
                      <span>{telechargeant ? 'Génération du PDF...' : 'Télécharger le récépissé (PDF)'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mentions Légales Pied de Page conforme */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-4 border-t text-[10px] font-sans text-slate-500">
            <span>Université Sidi Mohamed Ben Abdellah &bull; CEDoc Fès &bull; Modèle pédagogique, sans valeur juridique</span>
            <span className="font-mono tracking-widest text-slate-700 font-bold">||||| ||| |||||| || ||||| |||||||</span>
          </div>

        </div>

        <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-[6px] text-xs font-bold cursor-pointer transition shadow-xs"
          >
            Fermer l'aperçu
          </button>
        </div>

      </div>
    </div>
  );
};

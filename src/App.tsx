import React, { useState, useMemo, useEffect } from 'react';
import { 
  INITIAL_CAMPAGNE_VERSION, 
  INITIAL_SUJETS, 
  INITIAL_IDENTITES, 
  INITIAL_CANDIDATURES, 
  DEMO_USERS, 
  INITIAL_HISTORIQUE_VERSIONS,
  INITIAL_ETUDIANTS_USMBA
} from './data/initialData';
import { 
  SujetThese, 
  Candidature, 
  PersonneIdentite, 
  VersionCampagne, 
  UserAccount, 
  ProfilRole, 
  StatutCandidature, 
  DocumentCandidat,
  NotificationItem,
  EntreeHistoriqueVersion,
  EtudiantUSMBA,
  PIECES_OBLIGATOIRES,
  ResultatControleConformite,
  TypePieceObligatoire
} from './types';
import { generateSamplePdf, readPdfMetadataFromUrl } from './utils/pdfUtils';
import { reevaluateStoredComplianceAgainstProfile } from './utils/documentVerificationUtils';
import { Navbar } from './components/Navbar';
import { SidebarNavigation } from './components/SidebarNavigation';
import { AccueilPublicView } from './components/AccueilPublicView';
import { CalendrierCampagneView } from './components/CalendrierCampagneView';
import { CatalogueView } from './components/CatalogueView';
import { CandidatView, CandidatSubTab } from './components/CandidatView';
import { EncadrantView } from './components/EncadrantView';
import { StructureView } from './components/StructureView';
import { AgentAdminView } from './components/AgentAdminView';
import { AdminEDView } from './components/AdminEDView';
import { AuthModal } from './components/AuthModal';
import { ModalApercuOfficiel } from './components/ModalApercuOfficiel';
import { GuideCalendrierModal } from './components/GuideCalendrierModal';
import { AccesRefuseView } from './components/AccesRefuseView';
import { formatDateJJMMAAAA } from './utils/dateUtils';
import { deconnecterSessionGoogle } from './firebase';
import { RawCnieExtraction } from './utils/cnieExtractionUtils';
import { X, GraduationCap, FileText, Lock, AlertCircle } from 'lucide-react';

export default function App() {
  // 1. Navigation & Utilisateur actif (Page d'accueil publique par défaut au chargement)
  const [activeNavTab, setActiveNavTab] = useState<string>('accueil');
  const [activeCandidatSubTab, setActiveCandidatSubTab] = useState<CandidatSubTab>('SYNTHESE');
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);

  // 2. Données de l'application
  const [users, setUsers] = useState<UserAccount[]>(DEMO_USERS);
  const [etudiantsUSMBA] = useState<EtudiantUSMBA[]>(INITIAL_ETUDIANTS_USMBA);
  const [campagneVersion, setCampagneVersion] = useState<VersionCampagne>(INITIAL_CAMPAGNE_VERSION);
  const [historiqueVersions, setHistoriqueVersions] = useState<EntreeHistoriqueVersion[]>(INITIAL_HISTORIQUE_VERSIONS);
  const [sujets, setSujets] = useState<SujetThese[]>(INITIAL_SUJETS);
  const [candidatures, setCandidatures] = useState<Candidature[]>(INITIAL_CANDIDATURES);
  const [personnes, setPersonnes] = useState<PersonneIdentite[]>(INITIAL_IDENTITES);

  // Initialisation asynchrone des fichiers PDF et lecture de la vraie taille & du vrai nombre de pages
  useEffect(() => {
    let active = true;
    const hydrateDocMetadata = async () => {
      let hasChanges = false;
      const updated = await Promise.all(
        candidatures.map(async (c) => {
          let cChanged = false;
          const updatedDocs = await Promise.all(
            c.documents.map(async (doc) => {
              if (doc.fichier_url) {
                const meta = await readPdfMetadataFromUrl(doc.fichier_url);
                if (meta) {
                  cChanged = true;
                  return {
                    ...doc,
                    taille_octets: meta.byteLength,
                    taille_mo: meta.tailleMo,
                    page_count: meta.pageCount
                  };
                }
                return doc;
              }
              try {
                const res = await generateSamplePdf(
                  doc.type,
                  `${c.candidat_prenom} ${c.candidat_nom}`,
                  c.candidat_cin
                );
                cChanged = true;
                return {
                  ...doc,
                  fichier_url: res.dataUrl,
                  taille_octets: res.byteLength,
                  taille_mo: res.tailleMo,
                  page_count: res.pageCount
                };
              } catch {
                return doc;
              }
            })
          );
          if (cChanged) hasChanges = true;
          return cChanged ? { ...c, documents: updatedDocs } : c;
        })
      );

      if (active && hasChanges) {
        setCandidatures(prev =>
          prev.map(existingCand => {
            const hydratedCand = updated.find(u => u.id === existingCand.id);
            if (!hydratedCand) return existingCand;
            return {
              ...existingCand,
              documents: existingCand.documents.map(existingDoc => {
                const hydDoc = hydratedCand.documents.find(gd => gd.id === existingDoc.id);
                if (!hydDoc) return existingDoc;
                if (existingDoc.fichier_url && existingDoc.fichier_url !== hydDoc.fichier_url) {
                  return existingDoc;
                }
                return {
                  ...existingDoc,
                  fichier_url: existingDoc.fichier_url || hydDoc.fichier_url,
                  taille_octets: hydDoc.taille_octets,
                  taille_mo: hydDoc.taille_mo,
                  page_count: hydDoc.page_count
                };
              })
            };
          })
        );
      }
    };

    hydrateDocMetadata();
    return () => { active = false; };
  }, []);

  // 3. Panier de sélection (Visiteur : max 3 choix priorisés)
  const [panierSujets, setPanierSujets] = useState<SujetThese[]>([]);
  const [selectedSujetDetail, setSelectedSujetDetail] = useState<SujetThese | null>(null);
  const [filtreLaboratoireCatalogue, setFiltreLaboratoireCatalogue] = useState<string | null>(null);
  const [rechercheCatalogueInitiale, setRechercheCatalogueInitiale] = useState<string>('');

  // 4. Modals & Conflits de sélection pré-connexion
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialView, setAuthInitialView] = useState<'login' | 'register'>('login');
  const [pendingSujetPostuler, setPendingSujetPostuler] = useState<SujetThese | null>(null);
  const [postulerFeedback, setPostulerFeedback] = useState<string | null>(null);
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [calendrierSectionInitiale, setCalendrierSectionInitiale] = useState<string | null>(null);
  const [conflitSelectionData, setConflitSelectionData] = useState<{
    user: UserAccount;
    existingDossier: Candidature;
    panier: SujetThese[];
  } | null>(null);
  const [messageDossierSoumis, setMessageDossierSoumis] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<{
    titre: string;
    code: string;
    candidature: Candidature;
  } | null>(null);

  // 5. Notifications propres à chaque utilisateur (userId)
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'notif-1',
      userId: 'user-cand-1',
      message: "Bienvenue sur le portail des thèses du CEDoc USMBA session 2026-2027.",
      date: "Aujourd'hui, 09:00",
      lu: true
    },
    {
      id: 'notif-2',
      userId: 'user-cand-1',
      message: "Votre dossier DOC-2026-0001 est en cours d'examen par la commission scientifique.",
      date: "Aujourd'hui, 08:30",
      lu: true
    },
    {
      id: 'notif-3',
      userId: 'user-dt-1',
      message: "Dossier candidat Yassine ALAMI assigné pour évaluation scientifique.",
      date: "Aujourd'hui, 08:00",
      lu: true
    }
  ]);

  // Notifications filtrées strictement pour l'utilisateur actuellement connecté
  const userNotifications = useMemo(() => {
    if (!currentUser) return [];
    return notifications.filter(n => n.userId === currentUser.id);
  }, [notifications, currentUser]);

  const addNotification = (msg: string, targetUserId?: string) => {
    const destId = targetUserId || currentUser?.id;
    if (!destId) return;
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId: destId,
      message: msg,
      date: "À l'instant",
      lu: false
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const handleMarkAllNotificationsAsRead = () => {
    if (!currentUser) return;
    setNotifications(prev => prev.map(n => n.userId === currentUser.id ? { ...n, lu: true } : n));
  };

  const handleClearNotifications = () => {
    if (!currentUser) return;
    setNotifications(prev => prev.filter(n => n.userId !== currentUser.id));
  };

  // Format unique et institutionnel de référence : DOC-2026-XXXX
  const genererReferenceOfficielle = () => {
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `DOC-2026-${rand}`;
  };

  // Gestion du panier de sujets
  const handleAjouterAuPanier = (sujet: SujetThese) => {
    if (panierSujets.length >= 3) {
      alert("Attention : Le système autorise un maximum de 3 choix priorisés par candidat.");
      return;
    }
    if (panierSujets.some(s => s.id === sujet.id)) return;
    setPanierSujets(prev => [...prev, sujet]);
  };

  const handleRetirerDuPanier = (id: string) => {
    setPanierSujets(prev => prev.filter(s => s.id !== id));
  };

  const handleDeplacerPriorite = (index: number, direction: 'UP' | 'DOWN') => {
    const newArr = [...panierSujets];
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newArr.length) return;
    const temp = newArr[index];
    newArr[index] = newArr[targetIdx];
    newArr[targetIdx] = temp;
    setPanierSujets(newArr);
  };

  const reevaluateCandDocuments = (updatedCand: Candidature): Candidature => {
    if (updatedCand.controleDocumentaireDesactive) return updatedCand;
    return {
      ...updatedCand,
      documents: updatedCand.documents.map((doc) => {
        if (!doc.controle_conformite) return doc;
        return {
          ...doc,
          controle_conformite: reevaluateStoredComplianceAgainstProfile(
            doc.type as TypePieceObligatoire,
            doc.controle_conformite,
            updatedCand
          )
        };
      })
    };
  };

  // Gestion directe des sujets dans le dossier du candidat connecté (statut BROUILLON)
  const handleAjouterSujetDossier = (sujet: SujetThese) => {
    if (!currentUser) return;
    setCandidatures(prev => prev.map(c => {
      if (c.ownerId !== currentUser.id || c.statut !== 'BROUILLON') return c;
      if (c.choix_sujets.length >= 3) return c;
      if (c.choix_sujets.some(cs => cs.sujet.id === sujet.id)) return c;
      const nouveauxChoix = [
        ...c.choix_sujets,
        { priorite: c.choix_sujets.length + 1, sujet }
      ];
      return reevaluateCandDocuments({ ...c, choix_sujets: nouveauxChoix });
    }));
  };

  const handleRetirerSujetDossier = (sujetId: string) => {
    if (!currentUser) return;
    setCandidatures(prev => prev.map(c => {
      if (c.ownerId !== currentUser.id || c.statut !== 'BROUILLON') return c;
      const filtres = c.choix_sujets
        .filter(cs => cs.sujet.id !== sujetId)
        .map((cs, idx) => ({ priorite: idx + 1, sujet: cs.sujet }));
      return reevaluateCandDocuments({ ...c, choix_sujets: filtres });
    }));
  };

  const handleDeplacerPrioriteDossier = (index: number, direction: 'UP' | 'DOWN') => {
    if (!currentUser) return;
    setCandidatures(prev => prev.map(c => {
      if (c.ownerId !== currentUser.id || c.statut !== 'BROUILLON') return c;
      const newArr = [...c.choix_sujets];
      const targetIdx = direction === 'UP' ? index - 1 : index + 1;
      if (targetIdx < 0 || targetIdx >= newArr.length) return c;
      const temp = newArr[index];
      newArr[index] = newArr[targetIdx];
      newArr[targetIdx] = temp;
      const reindexed = newArr.map((cs, idx) => ({ priorite: idx + 1, sujet: cs.sujet }));
      return { ...c, choix_sujets: reindexed };
    }));
  };

  // Validation sélection -> Authentification / Création dossier
  const handleValiderSelection = () => {
    if (panierSujets.length === 0) {
      return;
    }

    if (!currentUser) {
      setAuthInitialView('register');
      setAuthModalOpen(true);
    } else if (currentUser.role === 'CANDIDAT') {
      creerNouveauDossier(currentUser, panierSujets);
    }
  };

  // CRÉATION DU DOSSIER : Un candidat n'a qu'un seul dossier D1
  const creerNouveauDossier = (user: UserAccount, sujetsSelectionnes: SujetThese[]) => {
    const existingDossier = candidatures.find(c => c.ownerId === user.id);
    if (existingDossier) {
      if (sujetsSelectionnes.length > 0 && existingDossier.statut === 'BROUILLON') {
        setCandidatures(prev => prev.map(c => c.id === existingDossier.id ? {
          ...c,
          choix_sujets: sujetsSelectionnes.map((s, idx) => ({ priorite: idx + 1, sujet: s }))
        } : c));
        setActiveCandidatSubTab('SYNTHESE');
      } else if (existingDossier.choix_sujets.length === 0) {
        setActiveCandidatSubTab('CHOIX_SUJETS');
      } else {
        setActiveCandidatSubTab('SYNTHESE');
      }
      setActiveNavTab('candidat');
      setPanierSujets([]);
      return existingDossier;
    }

    const newCandId = `cand-${Date.now().toString().slice(-4)}`;
    const referenceGeneree = genererReferenceOfficielle();
    
    const nouvelleCandidature: Candidature = {
      id: newCandId,
      ownerId: user.id,
      reference: referenceGeneree,
      personne_id: `p-${user.id}`,
      version_campagne_id: campagneVersion.id,
      candidat_nom: user.nom,
      candidat_prenom: user.prenom,
      candidat_compte_nom: user.nom,
      candidat_compte_prenom: user.prenom,
      candidat_cne: user.cne || '',
      candidat_email: user.email,
      candidat_cin: user.cin || '',
      candidat_filiere: user.filiere,
      date_creation: new Date().toISOString().split('T')[0],
      statut: 'BROUILLON',
      choix_sujets: sujetsSelectionnes.map((s, idx) => ({
        priorite: idx + 1,
        sujet: s
      })),
      documents: [],
      controleDocumentaireDesactive: user.controleDocumentaireDesactive
    };

    setCandidatures(prev => [nouvelleCandidature, ...prev]);
    setActiveNavTab('candidat');
    setPanierSujets([]);

    if (sujetsSelectionnes.length === 0) {
      // Première connexion sans sujet : redirection automatique vers le choix des sujets
      setActiveCandidatSubTab('CHOIX_SUJETS');
      addNotification(
        `Bienvenue ${user.prenom}. Veuillez choisir au moins 1 sujet de thèse pour débloquer les autres onglets de votre espace candidat.`,
        user.id
      );
    } else {
      setActiveCandidatSubTab('SYNTHESE');
      addNotification(
        `Votre dossier ${referenceGeneree} a été créé au statut Brouillon avec ${sujetsSelectionnes.length} sujet${sujetsSelectionnes.length > 1 ? 's' : ''} rattaché${sujetsSelectionnes.length > 1 ? 's' : ''}.`,
        user.id
      );
    }
    return nouvelleCandidature;
  };

  // Succès d'authentification
  const handleAuthSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    setAuthModalOpen(false);

    if (user.role === 'CANDIDAT') {
      const existingDossier = candidatures.find(c => c.ownerId === user.id);
      if (!existingDossier) {
        // Nouveau candidat ou compte sans dossier (ex: étudiant USMBA à sa 1ère connexion) : création + redirection vers choix des sujets si aucun sujet
        creerNouveauDossier(user, panierSujets);
      } else {
        // Compte candidat avec dossier déjà existant
        if (panierSujets.length > 0) {
          if (existingDossier.statut === 'BROUILLON') {
            if (existingDossier.choix_sujets.length === 0) {
              // Le dossier existant n'avait aucun sujet : on rattache directement la sélection en cours
              const nvlChoix = panierSujets.map((s, idx) => ({
                priorite: idx + 1,
                sujet: s
              }));
              setCandidatures(prev => prev.map(c => c.id === existingDossier.id ? {
                ...c,
                choix_sujets: nvlChoix
              } : c));
              setPanierSujets([]);
              setActiveNavTab('candidat');
              setActiveCandidatSubTab('SYNTHESE');
              addNotification(`Vos ${nvlChoix.length} sujet(s) sélectionné(s) ont été rattachés à votre dossier.`, user.id);
              return;
            }
            // Dossier en Brouillon avec sujets déjà choisis : fenêtre de conflit « Vous avez une sélection en cours »
            setConflitSelectionData({
              user,
              existingDossier,
              panier: [...panierSujets]
            });
            setActiveNavTab('candidat');
            setActiveCandidatSubTab('SYNTHESE');
            return;
          } else {
            // Dossier déjà Soumis ou plus : ignore la sélection en cours
            setPanierSujets([]);
            setMessageDossierSoumis("Votre dossier est déjà soumis : la sélection n’est plus modifiable");
            addNotification("Votre dossier est déjà soumis : la sélection n’est plus modifiable", user.id);
            setActiveNavTab('candidat');
            setActiveCandidatSubTab('SYNTHESE');
            return;
          }
        }

        setActiveNavTab('candidat');
        if (existingDossier.choix_sujets.length === 0) {
          setActiveCandidatSubTab('CHOIX_SUJETS');
          addNotification(
            `Bienvenue ${user.prenom}. Veuillez choisir au moins 1 sujet de thèse pour accéder aux autres onglets de votre espace.`,
            user.id
          );
        } else {
          setActiveCandidatSubTab('SYNTHESE');
          addNotification(`Bienvenue sur votre espace candidat, ${user.prenom}.`, user.id);
        }
      }
    } else {
      if (user.role === 'DIRECTEUR_THESE') setActiveNavTab('encadrant');
      else if (user.role === 'DIRECTEUR_STRUCTURE') setActiveNavTab('structure');
      else if (user.role === 'AGENT_ADMIN') setActiveNavTab('agent');
      else if (user.role === 'ADMIN_ED') setActiveNavTab('admin_ed');
      addNotification(`Connexion réussie : Espace ${user.role}.`, user.id);
    }

    if (pendingSujetPostuler) {
      setPostulerFeedback(null);
      setSelectedSujetDetail(pendingSujetPostuler);
      setPendingSujetPostuler(null);
    }
  };

  // Soumission définitive du dossier candidat (Brouillon -> Soumise)
  const handleSoumettreBrouillon = (candId: string) => {
    const targetCand = candidatures.find(c => c.id === candId);
    if (!targetCand) return;

    // « Soumettre définitivement » exige 1 à 3 sujets et l'ensemble des 6 pièces obligatoires.
    const nbSujets = targetCand.choix_sujets?.length || 0;
    const docsPresentsTypes = targetCand.documents
      .filter(d => d.statut_verification !== 'NON_DEPOSE')
      .map(d => d.type);
    const allDocsOk = PIECES_OBLIGATOIRES.every(p => docsPresentsTypes.includes(p));

    if (nbSujets < 1 || nbSujets > 3 || !allDocsOk) {
      alert("La soumission définitive exige 1 à 3 sujets et l'ensemble des 6 pièces justificatives obligatoires.");
      return;
    }

    const dateSoumission = new Date().toISOString().split('T')[0];
    updateCandidatureStatut(candId, 'SOUMISE', { date_soumission: dateSoumission });

    // À la soumission, notifie l’encadrant du sujet n°1 (« Nouveau dossier soumis ») et fait apparaître le dossier dans sa liste
    const p1Item = targetCand.choix_sujets.find(cs => cs.priorite === 1) || targetCand.choix_sujets[0];
    if (p1Item?.sujet) {
      const encId = p1Item.sujet.encadrant_id;
      if (encId) {
        addNotification("Nouveau dossier soumis", encId);
      }
      const encUser = users.find(u => 
        u.role === 'DIRECTEUR_THESE' && 
        (u.id === encId || p1Item.sujet.propose_par.toLowerCase().includes(u.nom.toLowerCase()))
      );
      if (encUser && encUser.id !== encId) {
        addNotification("Nouveau dossier soumis", encUser.id);
      }
    }

    addNotification(`Votre dossier ${targetCand.reference || targetCand.id} a été soumis définitivement avec succès.`, targetCand.ownerId);
  };

  // Changement de statut de candidature
  const updateCandidatureStatut = (id: string, newStatut: StatutCandidature, extra?: Partial<Candidature>) => {
    let candOwnerId: string | undefined;
    setCandidatures(prev => prev.map(c => {
      if (c.id !== id) return c;
      candOwnerId = c.ownerId;
      return {
        ...c,
        statut: newStatut,
        ...extra
      };
    }));
    if (candOwnerId) {
      if (newStatut === 'ACCEPTEE') {
        addNotification("Admis : veuillez télécharger votre fiche d’inscription pour la signer", candOwnerId);
      } else {
        addNotification(`Statut de votre dossier mis à jour : ${newStatut}`, candOwnerId);
      }
    }
  };

  // Ajout de document justificatif (remplace tout ancien document du même type pour éviter les doublons)
  const handleAjouterDocument = (candidatureId: string, doc: DocumentCandidat) => {
    setCandidatures(prev => prev.map(c => {
      if (c.id !== candidatureId) return c;
      const sansAncien = c.documents.filter(d => d.type !== doc.type);
      return {
        ...c,
        documents: [...sansAncien, doc]
      };
    }));
    if (currentUser) {
      addNotification(`Nouvelle pièce jointe téléversée : ${doc.type}`, currentUser.id);
    }
  };

  // Suppression / Retrait de document justificatif (remise au statut « Non déposé »)
  const handleSupprimerDocument = (candidatureId: string, docId: string, pieceType?: string) => {
    setCandidatures(prev => prev.map(c => {
      if (c.id !== candidatureId) return c;
      return {
        ...c,
        documents: c.documents.filter(d => d.id !== docId && (pieceType ? d.type !== pieceType : true))
      };
    }));
    if (currentUser) {
      addNotification(`Pièce justificative retirée. Statut remis sur « Non déposé ».`, currentUser.id);
    }
  };

  // Remplacement de document justificatif (retire l'ancien et repasse en EN_ATTENTE)
  const handleRemplacerDocument = (candidatureId: string, docId: string, updatedDoc: DocumentCandidat) => {
    setCandidatures(prev => prev.map(c => {
      if (c.id !== candidatureId) return c;
      const index = c.documents.findIndex(d => d.id === docId || d.type === updatedDoc.type);
      const filtered = c.documents.filter(d => d.id !== docId && d.type !== updatedDoc.type);
      if (index === -1) {
        return {
          ...c,
          documents: [...filtered, updatedDoc]
        };
      }
      const insertAt = Math.min(index, filtered.length);
      const newDocs = [...filtered];
      newDocs.splice(insertAt, 0, updatedDoc);
      return {
        ...c,
        documents: newDocs
      };
    }));
    if (currentUser) {
      addNotification(`Pièce justificative remplacée : ${updatedDoc.type}`, currentUser.id);
    }
  };

  // Enregistrement du résultat du contrôle automatique de conformité sur une pièce du dossier
  const handleUpdateDocumentConformite = (
    candidatureId: string,
    docId: string,
    controle: ResultatControleConformite
  ) => {
    setCandidatures(prev => prev.map(c => {
      if (c.id !== candidatureId || c.controleDocumentaireDesactive) return c;
      return {
        ...c,
        documents: c.documents.map(d => (d.id === docId ? { ...d, controle_conformite: controle } : d))
      };
    }));
  };

  // Remplissage du dossier à partir des champs saisis et validés dans le formulaire de scan CNIE (sans inventer d'information)
  const handleUpdateIdentiteDepuisCnie = (candidatureId: string, fields: RawCnieExtraction) => {
    const donneesValidees = {
      nom: fields.nom,
      prenom: fields.prenom,
      cin: fields.cin,
      date_naissance: fields.date_naissance,
      lieu_naissance: fields.lieu_naissance,
      date_validite: fields.date_validite,
      adresse: fields.adresse
    };

    const targetCand = candidatures.find(c => c.id === candidatureId);

    setCandidatures(prev => prev.map(c => {
      if (c.id !== candidatureId) return c;
      return reevaluateCandDocuments({
        ...c,
        candidat_compte_nom: c.candidat_compte_nom || c.candidat_nom,
        candidat_compte_prenom: c.candidat_compte_prenom || c.candidat_prenom,
        candidat_nom: donneesValidees.nom || c.candidat_nom,
        candidat_prenom: donneesValidees.prenom || c.candidat_prenom,
        candidat_cin: donneesValidees.cin || c.candidat_cin,
        candidat_date_naissance: donneesValidees.date_naissance,
        candidat_lieu_naissance: donneesValidees.lieu_naissance,
        candidat_adresse: donneesValidees.adresse,
        candidat_date_validite_cin: donneesValidees.date_validite,
        donnees_scan_cnie: donneesValidees
      });
    }));

    if (targetCand?.personne_id) {
      setPersonnes(prev => prev.map(p => {
        if (p.id !== targetCand.personne_id) return p;
        return {
          ...p,
          nom: donneesValidees.nom || p.nom,
          prenom: donneesValidees.prenom || p.prenom,
          numero_document_identite: donneesValidees.cin || p.numero_document_identite,
          date_naissance: donneesValidees.date_naissance,
          lieu_naissance: donneesValidees.lieu_naissance,
          date_validite_cin: donneesValidees.date_validite,
          adresse: donneesValidees.adresse,
          donnees_scan_cnie: donneesValidees
        };
      }));
    }
  };

  // Modification d'un sujet par l'encadrant (repasse en EN_ATTENTE d'accréditation)
  const handleModifierSujet = (sujetModifie: SujetThese) => {
    setSujets(prev => prev.map(s => s.id === sujetModifie.id ? sujetModifie : s));
    addNotification(`Le sujet "${sujetModifie.titre}" a été mis à jour et remis en attente d'accréditation.`);
  };

  // Inscription d'un nouveau candidat
  const handleRegisterCandidate = (newCand: UserAccount) => {
    setUsers(prev => [newCand, ...prev]);
  };

  // Ajout d'un compte du personnel
  const handleAddPersonnel = (newStaff: UserAccount) => {
    setUsers(prev => [...prev, newStaff]);
    addNotification(`Nouveau compte personnel créé : ${newStaff.prenom} ${newStaff.nom} (${newStaff.role})`);
  };

  // Basculer l'état d'un compte du personnel (sans supprimer ses données, avec notification des candidats et réaffectation des éléments en attente)
  const handleTogglePersonnelStatus = (userId: string) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    const isDeactivating = targetUser.statut_compte !== 'INACTIF';
    const formatEncadrantName = (u: UserAccount) => {
      const cleanPrenom = u.prenom.replace(/\s*\(.*?\)\s*/g, '').trim();
      return `Pr. ${cleanPrenom} ${u.nom}`;
    };
    const cleanLabName = (lab?: string) => (lab || '').toLowerCase().replace(/['’]/g, "'").trim();
    const matchLabName = (lab1?: string, lab2?: string) => {
      if (!lab1 || !lab2) return false;
      const c1 = cleanLabName(lab1);
      const c2 = cleanLabName(lab2);
      return c1.includes(c2) || c2.includes(c1);
    };

    if (isDeactivating) {
      let reaffecteVersId: string | undefined;
      let reaffecteVersNom: string | undefined;

      // CAS 1 : Désactivation d'un Directeur de Thèse (Encadrant)
      if (targetUser.role === 'DIRECTEUR_THESE') {
        const replacementDirector = users.find(
          u => u.role === 'DIRECTEUR_THESE' && u.id !== targetUser.id && u.statut_compte !== 'INACTIF'
        );
        const oldDirectorName = formatEncadrantName(targetUser);

        if (replacementDirector) {
          const newDirectorName = formatEncadrantName(replacementDirector);
          reaffecteVersId = replacementDirector.id;
          reaffecteVersNom = newDirectorName;

          // 1. Réaffectation des sujets du directeur désactivé (sans supprimer ses données d'origine)
          setSujets(prev => prev.map(s => {
            const belongsToTarget =
              s.encadrant_id === targetUser.id ||
              s.encadrant_origine_id === targetUser.id ||
              s.propose_par.toLowerCase().includes(targetUser.nom.toLowerCase());
            if (!belongsToTarget) return s;

            return {
              ...s,
              encadrant_origine_id: s.encadrant_origine_id || targetUser.id,
              propose_par_origine: s.propose_par_origine || s.propose_par,
              encadrant_id: replacementDirector.id,
              propose_par: newDirectorName,
              reaffecte_depuis_nom: oldDirectorName
            };
          }));

          // 2. Notification des candidats dans leur espace et réaffectation des dossiers en attente
          const notifiedCandidateIds = new Set<string>();
          candidatures.forEach(c => {
            const hasSubjectOfDirector = c.choix_sujets.some(
              cs =>
                cs.sujet.encadrant_id === targetUser.id ||
                cs.sujet.encadrant_origine_id === targetUser.id ||
                cs.sujet.propose_par.toLowerCase().includes(targetUser.nom.toLowerCase())
            );
            if (hasSubjectOfDirector && c.ownerId && !notifiedCandidateIds.has(c.ownerId)) {
              notifiedCandidateIds.add(c.ownerId);
              addNotification(
                `Information : Le compte de votre directeur de thèse (${oldDirectorName}) a été désactivé. Votre dossier et les éléments en attente ont été réaffectés à ${newDirectorName}.`,
                c.ownerId
              );
            }
          });

          setCandidatures(prev => prev.map(c => {
            const hasSubjectOfDirector = c.choix_sujets.some(
              cs =>
                cs.sujet.encadrant_id === targetUser.id ||
                cs.sujet.encadrant_origine_id === targetUser.id ||
                cs.sujet.propose_par.toLowerCase().includes(targetUser.nom.toLowerCase())
            );
            if (!hasSubjectOfDirector) return c;

            // Réaffecter les éléments en attente (dossiers non clôturés par décision finale)
            const isPendingDossier = c.statut !== 'ACCEPTEE' && c.statut !== 'REFUSEE';
            const updatedChoix = c.choix_sujets.map(cs => {
              const isTargetSujet =
                cs.sujet.encadrant_id === targetUser.id ||
                cs.sujet.encadrant_origine_id === targetUser.id ||
                cs.sujet.propose_par.toLowerCase().includes(targetUser.nom.toLowerCase());
              if (!isTargetSujet) return cs;
              return {
                ...cs,
                sujet: {
                  ...cs.sujet,
                  encadrant_origine_id: cs.sujet.encadrant_origine_id || targetUser.id,
                  propose_par_origine: cs.sujet.propose_par_origine || cs.sujet.propose_par,
                  encadrant_id: replacementDirector.id,
                  propose_par: newDirectorName,
                  reaffecte_depuis_nom: oldDirectorName
                }
              };
            });

            return {
              ...c,
              choix_sujets: updatedChoix,
              reaffecte_depuis_nom: isPendingDossier ? oldDirectorName : c.reaffecte_depuis_nom,
              reaffecte_vers_nom: isPendingDossier ? newDirectorName : c.reaffecte_vers_nom,
              etape1: isPendingDossier && c.etape1
                ? {
                    ...c.etape1,
                    decideur_origine: c.etape1.decideur_origine || c.etape1.decideur,
                    decideur: newDirectorName
                  }
                : c.etape1
            };
          }));

          // 3. Notification du nouveau directeur recevant les éléments en attente
          addNotification(
            `Réaffectation : Suite à la désactivation du compte de ${oldDirectorName}, ses sujets et dossiers en attente vous ont été réaffectés.`,
            replacementDirector.id
          );
        }
      }

      // CAS 2 : Désactivation d'un Directeur de Structure (Laboratoire)
      if (targetUser.role === 'DIRECTEUR_STRUCTURE') {
        const replacementStruct = users.find(
          u => u.role === 'DIRECTEUR_STRUCTURE' && u.id !== targetUser.id && u.statut_compte !== 'INACTIF'
        );
        const oldStructName = `${targetUser.prenom} ${targetUser.nom}`;

        if (replacementStruct) {
          const newStructName = `${replacementStruct.prenom} ${replacementStruct.nom}`;
          reaffecteVersId = replacementStruct.id;
          reaffecteVersNom = newStructName;

          // 1. Réaffectation des sujets en attente d'accréditation de cette structure
          setSujets(prev => prev.map(s => {
            if (!matchLabName(s.structure, targetUser.etablissement)) return s;
            if (s.validation_structure !== 'EN_ATTENTE') return s;
            return {
              ...s,
              directeur_structure_reaffecte_id: replacementStruct.id,
              reaffecte_depuis_nom: oldStructName
            };
          }));

          // 2. Notification des candidats de ce laboratoire et réaffectation des dossiers en attente
          const notifiedCandidateIds = new Set<string>();
          candidatures.forEach(c => {
            const p1 = c.choix_sujets.find(cs => cs.priorite === 1) || c.choix_sujets[0];
            if (p1?.sujet && matchLabName(p1.sujet.structure, targetUser.etablissement) && c.ownerId && !notifiedCandidateIds.has(c.ownerId)) {
              notifiedCandidateIds.add(c.ownerId);
              addNotification(
                `Information : Le compte du directeur de structure (${oldStructName}) a été désactivé. Votre dossier et les éléments en attente ont été réaffectés à ${newStructName}.`,
                c.ownerId
              );
            }
          });

          setCandidatures(prev => prev.map(c => {
            const p1 = c.choix_sujets.find(cs => cs.priorite === 1) || c.choix_sujets[0];
            if (!p1?.sujet || !matchLabName(p1.sujet.structure, targetUser.etablissement)) return c;
            const isPendingDossier = c.statut !== 'ACCEPTEE' && c.statut !== 'REFUSEE';
            if (!isPendingDossier) return c;
            return {
              ...c,
              directeur_structure_reaffecte_id: replacementStruct.id,
              reaffecte_depuis_nom: oldStructName,
              reaffecte_vers_nom: newStructName
            };
          }));

          addNotification(
            `Réaffectation : Suite à la désactivation du compte de ${oldStructName}, les sujets et dossiers en attente de sa structure vous ont été réaffectés.`,
            replacementStruct.id
          );
        }
      }

      setUsers(prev => prev.map(u => u.id === userId ? {
        ...u,
        statut_compte: 'INACTIF',
        reaffecte_vers_id: reaffecteVersId,
        reaffecte_vers_nom: reaffecteVersNom
      } : u));

      addNotification(
        reaffecteVersNom
          ? `Le compte de ${targetUser.prenom} ${targetUser.nom} a été désactivé. Ses candidats ont été notifiés et ses éléments en attente ont été réaffectés à ${reaffecteVersNom}.`
          : `Le compte de ${targetUser.prenom} ${targetUser.nom} a été désactivé.`
      );
    } else {
      // RÉACTIVATION DU COMPTE (sans aucune perte de données)
      const restoredDirectorName = formatEncadrantName(targetUser);

      if (targetUser.role === 'DIRECTEUR_THESE') {
        setSujets(prev => prev.map(s => {
          if (s.encadrant_origine_id !== targetUser.id) return s;
          return {
            ...s,
            encadrant_id: targetUser.id,
            propose_par: s.propose_par_origine || restoredDirectorName,
            reaffecte_depuis_nom: undefined
          };
        }));

        setCandidatures(prev => prev.map(c => {
          const hasOrigine = c.choix_sujets.some(cs => cs.sujet.encadrant_origine_id === targetUser.id);
          if (!hasOrigine) return c;
          return {
            ...c,
            choix_sujets: c.choix_sujets.map(cs => {
              if (cs.sujet.encadrant_origine_id !== targetUser.id) return cs;
              return {
                ...cs,
                sujet: {
                  ...cs.sujet,
                  encadrant_id: targetUser.id,
                  propose_par: cs.sujet.propose_par_origine || restoredDirectorName,
                  reaffecte_depuis_nom: undefined
                }
              };
            }),
            reaffecte_depuis_nom: undefined,
            reaffecte_vers_nom: undefined,
            etape1: c.etape1
              ? {
                  ...c.etape1,
                  decideur: c.etape1.decideur_origine || restoredDirectorName
                }
              : c.etape1
          };
        }));
      }

      if (targetUser.role === 'DIRECTEUR_STRUCTURE') {
        setSujets(prev => prev.map(s => {
          if (!matchLabName(s.structure, targetUser.etablissement)) return s;
          return {
            ...s,
            directeur_structure_reaffecte_id: undefined,
            reaffecte_depuis_nom: undefined
          };
        }));

        setCandidatures(prev => prev.map(c => {
          const p1 = c.choix_sujets.find(cs => cs.priorite === 1) || c.choix_sujets[0];
          if (!p1?.sujet || !matchLabName(p1.sujet.structure, targetUser.etablissement)) return c;
          return {
            ...c,
            directeur_structure_reaffecte_id: undefined,
            reaffecte_depuis_nom: undefined,
            reaffecte_vers_nom: undefined
          };
        }));
      }

      setUsers(prev => prev.map(u => u.id === userId ? {
        ...u,
        statut_compte: 'ACTIF',
        reaffecte_vers_id: undefined,
        reaffecte_vers_nom: undefined
      } : u));

      addNotification(`Le compte de ${targetUser.prenom} ${targetUser.nom} a été réactivé avec l'intégralité de ses données.`);
    }
  };

  // Publication d'une nouvelle version de campagne avec historisation
  const handleCreerNouvelleVersion = (nvl: VersionCampagne, entree: EntreeHistoriqueVersion) => {
    setCampagneVersion(nvl);
    setHistoriqueVersions(prev => [entree, ...prev]);
    addNotification(`Nouvelle révision officielle de la campagne publiée (Version: ${nvl.id}, Clôture: ${formatDateJJMMAAAA(nvl.date_cloture)})`);
  };

  const handleLogout = async () => {
    await deconnecterSessionGoogle();
    setCurrentUser(null);
    setActiveNavTab('accueil');
    addNotification("Vous avez été déconnecté(e) avec succès.");
  };

  // Contrôle d'accès strict par rôle
  const isAccessAuthorized = (tab: string, user: UserAccount | null): boolean => {
    if (tab === 'accueil' || tab === 'catalogue' || tab === 'calendrier') return true;
    if (!user) return false;
    if (tab === 'candidat') return user.role === 'CANDIDAT';
    if (tab === 'encadrant') return user.role === 'DIRECTEUR_THESE';
    if (tab === 'structure') return user.role === 'DIRECTEUR_STRUCTURE';
    if (tab === 'agent') return user.role === 'AGENT_ADMIN';
    if (tab === 'admin_ed') return user.role === 'ADMIN_ED';
    return false;
  };

  // Filtrage du laboratoire depuis la page d'accueil
  const handleSelectLaboratoire = (nomLabo: string) => {
    setRechercheCatalogueInitiale('');
    setFiltreLaboratoireCatalogue(nomLabo);
    setActiveNavTab('catalogue');
  };

  // La page "Mon Dossier" affiche UNIQUEMENT le dossier de l'utilisateur connecté
  const currentCandidature = useMemo(() => {
    if (!currentUser) return null;
    const found = candidatures.find(c => c.ownerId === currentUser.id) || null;
    if (!found) return null;
    if (currentUser.controleDocumentaireDesactive && !found.controleDocumentaireDesactive) {
      return { ...found, controleDocumentaireDesactive: true };
    }
    return found;
  }, [candidatures, currentUser]);

  // Contenu des vues d'écrans
  const renderScreenContent = () => {
    if (!isAccessAuthorized(activeNavTab, currentUser)) {
      return (
        <AccesRefuseView
          currentUser={currentUser}
          targetTab={activeNavTab}
          onRedirect={(tab) => setActiveNavTab(tab)}
        />
      );
    }

    return (
      <>
        {/* PAGE D'ACCUEIL PUBLIQUE (PREMIÈRE PAGE PAR DÉFAUT) */}
        {activeNavTab === 'accueil' && (
          <AccueilPublicView
            campagne={campagneVersion}
            sujets={sujets}
            onConsulterSujets={() => {
              setFiltreLaboratoireCatalogue(null);
              setRechercheCatalogueInitiale('');
              setActiveNavTab('catalogue');
            }}
            onRechercherSujets={(terme) => {
              setFiltreLaboratoireCatalogue(null);
              setRechercheCatalogueInitiale(terme);
              setActiveNavTab('catalogue');
            }}
            onSelectSujetDetail={(sujet) => {
              setPostulerFeedback(null);
              setSelectedSujetDetail(sujet);
            }}
            onCommencerCandidature={() => {
              if (!currentUser) {
                setAuthInitialView('register');
                setAuthModalOpen(true);
              } else if (currentUser.role === 'CANDIDAT') {
                setActiveNavTab('candidat');
              } else {
                if (currentUser.role === 'DIRECTEUR_THESE') setActiveNavTab('encadrant');
                else if (currentUser.role === 'DIRECTEUR_STRUCTURE') setActiveNavTab('structure');
                else if (currentUser.role === 'AGENT_ADMIN') setActiveNavTab('agent');
                else if (currentUser.role === 'ADMIN_ED') setActiveNavTab('admin_ed');
              }
            }}
            onOuvrirCalendrier={(sectionId) => {
              setCalendrierSectionInitiale(sectionId || null);
              setActiveNavTab('calendrier');
            }}
            onSelectLaboratoire={handleSelectLaboratoire}
          />
        )}

        {/* PAGE « CALENDRIER DE LA CAMPAGNE » (DATES IMPORTANTES, COMMENT ÇA MARCHE, PIÈCES À PRÉPARER) */}
        {activeNavTab === 'calendrier' && (
          <CalendrierCampagneView
            campagne={campagneVersion}
            initialSectionId={calendrierSectionInitiale}
            onSectionScrolled={() => setCalendrierSectionInitiale(null)}
          />
        )}

        {/* CATALOGUE PUBLIC DE SUJETS */}
        {activeNavTab === 'catalogue' && (
          <CatalogueView
            sujets={sujets.filter(s => s.statut === 'VALIDE' && s.validation_structure === 'VALIDE')}
            panierSujets={panierSujets}
            filtreLaboratoireInitial={filtreLaboratoireCatalogue}
            rechercheInitiale={rechercheCatalogueInitiale}
            onClearFiltreLaboratoire={() => setFiltreLaboratoireCatalogue(null)}
            onAjouterAuPanier={handleAjouterAuPanier}
            onRetirerDuPanier={handleRetirerDuPanier}
            onDeplacerPriorite={handleDeplacerPriorite}
            onSelectDetail={(sujet) => setSelectedSujetDetail(sujet)}
            onValiderSelection={handleValiderSelection}
          />
        )}

        {/* ESPACE CANDIDAT D1 */}
        {activeNavTab === 'candidat' && currentCandidature && (
          <CandidatView
            candidature={currentCandidature}
            campagne={campagneVersion}
            sujetsCatalogue={sujets.filter(s => s.statut === 'VALIDE' && s.validation_structure === 'VALIDE')}
            activeSubTab={activeCandidatSubTab}
            onChangeSubTab={setActiveCandidatSubTab}
            onAjouterSujetDossier={handleAjouterSujetDossier}
            onRetirerSujetDossier={handleRetirerSujetDossier}
            onDeplacerPrioriteDossier={handleDeplacerPrioriteDossier}
            onSelectDetailSujet={(sujet) => setSelectedSujetDetail(sujet)}
            onValiderChoixSujets={() => {
              if (currentCandidature.choix_sujets.length >= 1) {
                setActiveCandidatSubTab('SYNTHESE');
                addNotification(
                  `Sélection enregistrée (${currentCandidature.choix_sujets.length} sujet${currentCandidature.choix_sujets.length > 1 ? 's' : ''}). Les autres onglets de votre espace sont désormais déverrouillés.`,
                  currentCandidature.ownerId
                );
              }
            }}
            onResoumettre={(id) => updateCandidatureStatut(id, 'EN_EXAMEN')}
            onSoumettreBrouillon={handleSoumettreBrouillon}
            onAjouterDocument={handleAjouterDocument}
            onRemplacerDocument={handleRemplacerDocument}
            onSupprimerDocument={handleSupprimerDocument}
            onUpdateDocumentConformite={handleUpdateDocumentConformite}
            onUpdateIdentiteDepuisCnie={handleUpdateIdentiteDepuisCnie}
            onPreviewDoc={(titre, code) => setPreviewDocument({ titre, code, candidature: currentCandidature })}
          />
        )}

        {/* ESPACE DIRECTEUR DE THÈSE (ENCADRANT) */}
        {activeNavTab === 'encadrant' && (
          <EncadrantView
            currentUser={currentUser}
            sujets={sujets}
            candidatures={candidatures}
            onUpdateStatut={updateCandidatureStatut}
            onUpdateDocumentStatut={(candId, docId, statutVerif, motifRejet) => {
              const targetCand = candidatures.find(c => c.id === candId);
              const targetDoc = targetCand?.documents.find(d => d.id === docId);
              const docName = targetDoc?.type || 'justificative';

              setCandidatures(prev => prev.map(c => {
                if (c.id !== candId) return c;
                return {
                  ...c,
                  documents: c.documents.map(d => d.id === docId ? { 
                    ...d, 
                    statut_verification: statutVerif,
                    motif_rejet: statutVerif === 'REJETE' ? (motifRejet || 'Document non conforme') : undefined
                  } : d)
                };
              }));

              if (targetCand?.ownerId) {
                if (statutVerif === 'REJETE') {
                  const commentaire = motifRejet?.trim() || 'Document non conforme';
                  addNotification(
                    `Rejet de votre pièce « ${docName} » : ${commentaire}`,
                    targetCand.ownerId
                  );
                } else if (statutVerif === 'VALIDE') {
                  addNotification(
                    `Votre pièce justificative « ${docName} » a été validée par le directeur de thèse.`,
                    targetCand.ownerId
                  );
                }
              }
            }}
            onAjouterSujet={(nouveau) => {
              setSujets([nouveau, ...sujets]);
              addNotification(`Nouveau sujet proposé : ${nouveau.titre}`, currentUser?.id);
            }}
            onModifierSujet={handleModifierSujet}
            onPreviewDoc={(titre, code, candidature) => setPreviewDocument({ titre, code, candidature })}
          />
        )}

        {/* ESPACE DIRECTEUR DE STRUCTURE */}
        {activeNavTab === 'structure' && (
          <StructureView
            currentUser={currentUser}
            sujets={sujets}
            candidatures={candidatures}
            onValiderSujet={(id) => {
              const targetSujet = sujets.find(s => s.id === id);
              setSujets(prev => prev.map(s => s.id === id ? { 
                ...s, 
                validation_structure: 'VALIDE', 
                statut: 'VALIDE' 
              } : s));

              if (targetSujet) {
                // Trouver le compte du directeur de thèse ayant proposé le sujet
                let encId = targetSujet.encadrant_id;
                if (!encId) {
                  const matchUser = users.find(u => 
                    u.role === 'DIRECTEUR_THESE' && 
                    (u.id === targetSujet.encadrant_id || targetSujet.propose_par.toLowerCase().includes(u.nom.toLowerCase()))
                  );
                  encId = matchUser?.id || '';
                }

                // La notification « sujet accrédité par la structure de recherche » arrive dans l'espace du directeur de thèse (et non dans celui de la structure)
                if (encId) {
                  addNotification("sujet accrédité par la structure de recherche", encId);
                }
              }
            }}
            onDecisionEtape2={(candId, resultat, motif) => {
              const targetCand = candidatures.find(c => c.id === candId);
              const nomDecideur = currentUser 
                ? `${currentUser.prenom} ${currentUser.nom} (${currentUser.etablissement})` 
                : 'Direction de Structure';
              updateCandidatureStatut(
                candId,
                resultat === 'FAVORABLE' ? 'ACCEPTEE' : 'REFUSEE',
                {
                  etape2: {
                    decideur: nomDecideur,
                    resultat,
                    motif,
                    date_decision: new Date().toISOString().split('T')[0]
                  }
                }
              );

              if (targetCand) {
                if (resultat === 'FAVORABLE') {
                  addNotification(
                    "Admis : veuillez télécharger votre fiche d’inscription pour la signer",
                    targetCand.ownerId
                  );
                } else {
                  addNotification(
                    `Décision de la structure (Non retenue) : ${motif}`,
                    targetCand.ownerId
                  );
                }
              }
            }}
          />
        )}

        {/* ESPACE AGENT ADMINISTRATIF (IDENTITÉ & SCOLARITÉ) */}
        {activeNavTab === 'agent' && (
          <AgentAdminView
            candidatures={candidatures}
            personnes={personnes}
            etudiantsUSMBA={etudiantsUSMBA}
            onValiderDocumentStatut={(candId, docId, statutVerif, motifRejet) => {
              // 1. Mise à jour de la pièce dans les candidatures
              setCandidatures(prev => prev.map(c => {
                if (c.id !== candId) return c;
                return {
                  ...c,
                  documents: c.documents.map(d => {
                    if (d.id !== docId) return d;
                    return {
                      ...d,
                      statut_verification: statutVerif,
                      motif_rejet: statutVerif === 'REJETE' ? motifRejet : undefined
                    };
                  })
                };
              }));

              const targetCand = candidatures.find(c => c.id === candId);
              const targetDoc = targetCand?.documents.find(d => d.id === docId);
              const docName = targetDoc?.type || "Carte d'identité nationale (CIN)";

              // 2. Synchronisation de la fiche d'identité (personnes)
              if (targetCand) {
                const newIdentiteStatut = statutVerif === 'VALIDE' ? 'CONFORME' : (statutVerif === 'REJETE' ? 'NON_CONFORME' : 'A_EXAMINER');
                setPersonnes(prev => prev.map(p => {
                  if (
                    (targetCand.personne_id && p.id === targetCand.personne_id) ||
                    (targetCand.candidat_cin && p.numero_document_identite.toLowerCase() === targetCand.candidat_cin.toLowerCase()) ||
                    (targetCand.candidat_cne && p.cne.toLowerCase() === targetCand.candidat_cne.toLowerCase())
                  ) {
                    return {
                      ...p,
                      statut_identite: newIdentiteStatut,
                      motif_identite: statutVerif === 'REJETE' ? motifRejet : undefined
                    };
                  }
                  return p;
                }));

                // 3. Notification ciblée au candidat
                if (statutVerif === 'REJETE') {
                  addNotification(
                    `Rejet de votre pièce « ${docName} » par le service de scolarité : ${motifRejet || 'Document non conforme'}`,
                    targetCand.ownerId
                  );
                } else if (statutVerif === 'VALIDE') {
                  addNotification(
                    `Votre pièce « ${docName} » a été validée par le service de scolarité (Identité conforme).`,
                    targetCand.ownerId
                  );
                }
              }
            }}
            onValiderIdentite={(id, decision, motif) => {
              // 1. Mise à jour dans personnes
              setPersonnes(prev => prev.map(p => p.id === id ? {
                ...p,
                statut_identite: decision,
                motif_identite: motif
              } : p));

              // 2. Synchronisation dans candidatures
              const matchedPerson = personnes.find(p => p.id === id);
              const candDocStatut = decision === 'CONFORME' ? 'VALIDE' : (decision === 'NON_CONFORME' ? 'REJETE' : 'EN_ATTENTE');

              if (matchedPerson) {
                setCandidatures(prev => prev.map(c => {
                  if (
                    c.personne_id === id || 
                    (c.candidat_cin && c.candidat_cin.toLowerCase() === matchedPerson.numero_document_identite.toLowerCase()) ||
                    (c.candidat_cne && c.candidat_cne.toLowerCase() === matchedPerson.cne.toLowerCase())
                  ) {
                    return {
                      ...c,
                      documents: c.documents.map(d => {
                        if (d.type === "Carte d'identité nationale (CIN)") {
                          return {
                            ...d,
                            statut_verification: candDocStatut,
                            motif_rejet: decision === 'NON_CONFORME' ? motif : undefined
                          };
                        }
                        return d;
                      })
                    };
                  }
                  return c;
                }));

                const targetCand = candidatures.find(c => 
                  c.personne_id === id || 
                  (c.candidat_cin && c.candidat_cin.toLowerCase() === matchedPerson.numero_document_identite.toLowerCase()) ||
                  (c.candidat_cne && c.candidat_cne.toLowerCase() === matchedPerson.cne.toLowerCase())
                );

                if (targetCand) {
                  if (decision === 'CONFORME') {
                    addNotification(
                      "Votre pièce d'identité nationale (CIN) a été validée avec succès par le service de scolarité.",
                      targetCand.ownerId
                    );
                  } else if (decision === 'NON_CONFORME') {
                    addNotification(
                      `Rejet de votre pièce d'identité (CIN) par le service de scolarité : ${motif || 'Non conforme'}`,
                      targetCand.ownerId
                    );
                  }
                }
              }
            }}
          />
        )}

        {/* ESPACE ADMINISTRATEUR ED (CAMPAGNES) */}
        {activeNavTab === 'admin_ed' && (
          <AdminEDView
            campagneVersion={campagneVersion}
            sujets={sujets}
            candidatures={candidatures}
            personnes={personnes}
            users={users}
            historiqueVersions={historiqueVersions}
            onCreerNouvelleVersion={handleCreerNouvelleVersion}
            onAddPersonnel={handleAddPersonnel}
            onTogglePersonnelStatus={handleTogglePersonnelStatus}
          />
        )}
      </>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b] font-sans antialiased selection:bg-[#ccfbf1] selection:text-[#0f766e]">
      
      {/* 
        ORGANISATION DE LA NAVIGATION :
        - Pages publiques (sans compte connecté) : Barre de navigation simple en haut
        - Après connexion : Navigation latérale à gauche (Sidebar), affichant uniquement les entrées du rôle
      */}
      {!currentUser ? (
        <div className="flex flex-col min-h-screen">
          <Navbar
            activeTab={activeNavTab}
            onNavigate={(tab) => {
              if (tab === 'catalogue') setFiltreLaboratoireCatalogue(null);
              setActiveNavTab(tab);
            }}
            onOpenAuth={() => {
              setAuthInitialView('login');
              setAuthModalOpen(true);
            }}
            onOpenGuide={() => setGuideModalOpen(true)}
            campagne={campagneVersion}
          />

          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
            {renderScreenContent()}
          </main>
        </div>
      ) : (
        <div className="flex min-h-screen">
          {/* Navigation latérale à gauche pour utilisateur connecté */}
          <SidebarNavigation
            currentUser={currentUser}
            activeTab={activeNavTab}
            onNavigate={(tab) => {
              if (currentUser.role === 'CANDIDAT' && (!currentCandidature || currentCandidature.choix_sujets.length === 0)) {
                setActiveNavTab('candidat');
                setActiveCandidatSubTab('CHOIX_SUJETS');
                return;
              }
              if (tab === 'catalogue') setFiltreLaboratoireCatalogue(null);
              setActiveNavTab(tab);
            }}
            onLogout={handleLogout}
            onOpenGuide={() => setGuideModalOpen(true)}
            campagne={campagneVersion}
            notifications={userNotifications}
            onMarkAllAsRead={handleMarkAllNotificationsAsRead}
            onClearNotifications={handleClearNotifications}
            candidatSansSujet={currentUser.role === 'CANDIDAT' && (!currentCandidature || currentCandidature.choix_sujets.length === 0)}
            activeCandidatSubTab={activeCandidatSubTab}
            onSelectCandidatSubTab={setActiveCandidatSubTab}
          />

          {/* Contenu principal de l'espace de travail */}
          <div className="flex-1 min-w-0 flex flex-col min-h-screen overflow-x-hidden">
            <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 overflow-y-auto">
              {renderScreenContent()}
            </main>

            <footer className="border-t border-slate-200 text-slate-500 py-4 text-xs text-center mt-auto bg-white/50">
              <p className="font-bold text-slate-700 tracking-wide font-serif">Projet académique non officiel</p>
              <p className="text-[11px] text-slate-400">CEDoc USMBA &bull; Session {campagneVersion.annee_universitaire}</p>
            </footer>
          </div>
        </div>
      )}

      {/* MODAL 1 : FICHE DÉTAIL D'UN SUJET DE THÈSE */}
      {selectedSujetDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[6px] shadow-xl border border-slate-200 overflow-hidden animate-in fade-in">
            <div className="bg-[#0f766e] px-6 py-4 flex items-center justify-between text-white">
              <div>
                <span className="text-[11px] text-teal-200 font-bold tracking-wider uppercase">
                  {selectedSujetDetail.theme}
                </span>
                <h3 className="text-base font-bold leading-snug font-serif">{selectedSujetDetail.titre}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedSujetDetail(null);
                  setPostulerFeedback(null);
                }}
                className="text-teal-200 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-sm text-slate-700">
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-[6px] border border-slate-200">
                <div><span className="font-bold text-slate-900">Domaine :</span> {selectedSujetDetail.theme}</div>
                <div><span className="font-bold text-slate-900">Places :</span> {selectedSujetDetail.nombre_places}</div>
                <div><span className="font-bold text-slate-900">Laboratoire :</span> {selectedSujetDetail.structure}</div>
                <div><span className="font-bold text-slate-900">Encadrant :</span> {selectedSujetDetail.propose_par}</div>
                <div className="col-span-2"><span className="font-bold text-slate-900">Établissement :</span> {selectedSujetDetail.etablissement}</div>
              </div>
              <div>
                <h4 className="font-bold text-slate-900 mb-1 font-serif">Description détaillée du projet :</h4>
                <p className="leading-relaxed text-slate-600 text-xs sm:text-sm bg-slate-50 p-4 rounded-[6px] border border-slate-200 font-sans">
                  {selectedSujetDetail.description}
                </p>
              </div>
              {postulerFeedback && (
                <div className="p-3 rounded-[6px] bg-amber-50 border border-amber-200 text-xs text-amber-900 font-medium">
                  {postulerFeedback}
                </div>
              )}
            </div>
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedSujetDetail(null);
                  setPostulerFeedback(null);
                }}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-[6px] text-xs font-bold cursor-pointer transition"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={() => {
                  const sujet = selectedSujetDetail;
                  if (!sujet) return;
                  if (!currentUser) {
                    setPendingSujetPostuler(sujet);
                    setSelectedSujetDetail(null);
                    setPostulerFeedback(null);
                    setAuthInitialView('login');
                    setAuthModalOpen(true);
                    return;
                  }
                  if (currentUser.role !== 'CANDIDAT') {
                    setPostulerFeedback("Seuls les comptes candidats peuvent postuler à un sujet de thèse.");
                    return;
                  }
                  if (currentCandidature) {
                    if (currentCandidature.choix_sujets.some(cs => cs.sujet.id === sujet.id)) {
                      setPostulerFeedback("Ce sujet est déjà sélectionné dans votre dossier.");
                      return;
                    }
                    if (currentCandidature.statut !== 'BROUILLON') {
                      setPostulerFeedback("Votre dossier est déjà soumis : la sélection n’est plus modifiable.");
                      return;
                    }
                    if (currentCandidature.choix_sujets.length >= 3) {
                      setPostulerFeedback("Votre dossier contient déjà 3 sujets (maximum autorisé).");
                      return;
                    }
                    handleAjouterSujetDossier(sujet);
                    addNotification(`Le sujet "${sujet.titre}" a été ajouté à votre dossier.`, currentUser.id);
                    setSelectedSujetDetail(null);
                    setPostulerFeedback(null);
                    setActiveNavTab('candidat');
                    setActiveCandidatSubTab('SYNTHESE');
                  }
                }}
                className="px-5 py-2 bg-[#0f766e] hover:bg-[#115e59] text-white rounded-[6px] text-xs font-bold cursor-pointer transition shadow-xs"
              >
                Postuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2 : AUTHENTIFICATION UNIQUE & INSCRIPTION CANDIDAT */}
      <AuthModal
        isOpen={authModalOpen}
        registeredUsers={users}
        etudiantsUSMBA={etudiantsUSMBA}
        selectedSujets={panierSujets}
        initialView={authInitialView}
        onClose={() => {
          setAuthModalOpen(false);
          setPendingSujetPostuler(null);
        }}
        onSuccess={handleAuthSuccess}
        onRegisterCandidate={handleRegisterCandidate}
      />

      {/* MODAL 3 : GUIDE & CALENDRIER OFFICIEL */}
      <GuideCalendrierModal
        isOpen={guideModalOpen}
        campagne={campagneVersion}
        onClose={() => setGuideModalOpen(false)}
      />

      {/* MODAL 4 : APERÇU OFFICIEL PDF AVEC SIGNATURE MANUSCRITE */}
      {previewDocument && (
        <ModalApercuOfficiel
          titre={previewDocument.titre}
          code={previewDocument.code}
          candidature={previewDocument.candidature}
          campagne={campagneVersion}
          onClose={() => setPreviewDocument(null)}
        />
      )}

      {/* MODAL 5 : CONFLIT DE SÉLECTION PRÉ-CONNEXION (« Vous avez une sélection en cours ») */}
      {conflitSelectionData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[6px] shadow-xl border border-slate-200 overflow-hidden animate-in fade-in">
            <div className="bg-[#0f766e] px-6 py-4 text-white">
              <h3 className="text-base font-bold font-serif">Vous avez une sélection en cours</h3>
              <p className="text-xs text-teal-100 mt-1">
                Vous aviez sélectionné des sujets dans le catalogue avant de vous connecter. Votre dossier actuel est encore au statut <strong>Brouillon</strong>.
              </p>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Sélection en cours */}
                <div className="bg-teal-50/50 border border-teal-200 rounded-[6px] p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-teal-200/60 pb-2">
                    <span className="text-xs font-bold text-[#0f766e] uppercase tracking-wide">
                      Sélection en cours
                    </span>
                    <span className="text-[11px] font-bold bg-[#0f766e] text-white px-2 py-0.5 rounded-[4px]">
                      {conflitSelectionData.panier.length} sujet{conflitSelectionData.panier.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <ul className="space-y-2 text-xs">
                    {conflitSelectionData.panier.map((s, idx) => (
                      <li key={s.id} className="p-2.5 bg-white rounded-[4px] border border-teal-100 shadow-2xs">
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-teal-100 text-[#0f766e] font-extrabold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="font-bold text-slate-900 leading-snug">{s.titre}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">{s.propose_par} &bull; {s.structure}</p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 2. Sélection du dossier */}
                <div className="bg-slate-50 border border-slate-200 rounded-[6px] p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Sélection de votre dossier
                    </span>
                    <span className="text-[11px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-[4px]">
                      {conflitSelectionData.existingDossier.choix_sujets.length} sujet{conflitSelectionData.existingDossier.choix_sujets.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <ul className="space-y-2 text-xs">
                    {conflitSelectionData.existingDossier.choix_sujets.map((cs) => (
                      <li key={cs.sujet.id} className="p-2.5 bg-white rounded-[4px] border border-slate-200 shadow-2xs">
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-extrabold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                            {cs.priorite}
                          </span>
                          <div>
                            <p className="font-bold text-slate-900 leading-snug">{cs.sujet.titre}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">{cs.sujet.propose_par} &bull; {cs.sujet.structure}</p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-[6px] border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Que souhaitez-vous faire ? Vous pouvez remplacer la sélection de votre dossier par la sélection en cours ou conserver les choix de votre dossier existant.
                </span>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  // Conserver mon dossier : garder les choix du dossier, vider le panier
                  setPanierSujets([]);
                  setConflitSelectionData(null);
                  addNotification("La sélection de votre dossier a été conservée.", conflitSelectionData.user.id);
                  setActiveNavTab('candidat');
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-[6px] border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer transition shadow-2xs"
              >
                Conserver mon dossier
              </button>

              <button
                type="button"
                onClick={() => {
                  // Remplacer la sélection de mon dossier : écraser avec le panier, puis vider le panier
                  const nvlChoix = conflitSelectionData.panier.map((s, idx) => ({
                    priorite: idx + 1,
                    sujet: s
                  }));
                  setCandidatures(prev => prev.map(c => c.id === conflitSelectionData.existingDossier.id ? {
                    ...c,
                    choix_sujets: nvlChoix
                  } : c));
                  setPanierSujets([]);
                  setConflitSelectionData(null);
                  addNotification("La sélection de votre dossier a été remplacée par vos nouveaux choix.", conflitSelectionData.user.id);
                  setActiveNavTab('candidat');
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-[6px] bg-[#0f766e] hover:bg-[#115e59] text-white font-bold text-xs cursor-pointer transition shadow-xs"
              >
                Remplacer la sélection de mon dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP / AVERTISSEMENT DOSSIER DÉJÀ SOUMIS (« Votre dossier est déjà soumis : la sélection n’est plus modifiable ») */}
      {messageDossierSoumis && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[6px] shadow-xl border border-slate-200 p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center gap-3 text-amber-700">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-700" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 font-serif">
                Information Candidature
              </h3>
            </div>
            <p className="text-xs text-slate-700 font-medium leading-relaxed bg-amber-50 p-3.5 rounded-[6px] border border-amber-200">
              {messageDossierSoumis}
            </p>
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMessageDossierSoumis(null)}
                className="px-5 py-2 bg-[#0f766e] hover:bg-[#115e59] text-white rounded-[6px] text-xs font-bold cursor-pointer transition shadow-xs"
              >
                Compris
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

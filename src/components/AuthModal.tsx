import React, { useState, useEffect } from 'react';
import { 
  X, 
  GraduationCap, 
  Mail, 
  Lock, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  Info,
  Building2,
  ArrowRight,
  Sparkles,
  Database,
  Check
} from 'lucide-react';
import { UserAccount, SujetThese, EtudiantUSMBA } from '../types';
import { INITIAL_ETUDIANTS_USMBA } from '../data/initialData';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider, DOMAINE_ACADEMIQUE_AUTORISE, deconnecterSessionGoogle } from '../firebase';

interface AuthModalProps {
  isOpen: boolean;
  registeredUsers: UserAccount[];
  etudiantsUSMBA?: EtudiantUSMBA[];
  selectedSujets: SujetThese[];
  onClose: () => void;
  onSuccess: (user: UserAccount) => void;
  onRegisterCandidate: (user: UserAccount) => void;
  initialView?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  registeredUsers,
  etudiantsUSMBA = INITIAL_ETUDIANTS_USMBA,
  selectedSujets,
  onClose,
  onSuccess,
  onRegisterCandidate,
  initialView = 'login'
}) => {
  // Vue active dans le modal : soit 'LOGIN' (connexion unique), soit 'REGISTER' (création compte candidat)
  const [view, setView] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Champs de Connexion (valables pour tous les rôles : candidat, enseignant, structure, scolarité, admin)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showForgotPasswordNotice, setShowForgotPasswordNotice] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Champs d'Inscription (Réservé exclusivement aux candidats)
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [cin, setCin] = useState('');
  const [cne, setCne] = useState('');
  const [filiere, setFiliere] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [consentement, setConsentement] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registerErrors, setRegisterErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setView(initialView === 'register' ? 'REGISTER' : 'LOGIN');
      setLoginError('');
      setRegisterErrors({});
      setShowForgotPasswordNotice(false);
    }
  }, [isOpen, initialView]);

  if (!isOpen) return null;

  // Recherche interne d'une correspondance dans la base d'étudiants de l'USMBA (aucun affichage avant connexion)
  const matchedEtudiantUSMBA = etudiantsUSMBA.find(
    e =>
      (cne.trim() && e.cne.toLowerCase() === cne.trim().toLowerCase()) ||
      (email.trim() && e.email.toLowerCase() === email.trim().toLowerCase())
  );

  const nbSujets = selectedSujets.length;
  const libelleSujets = nbSujets === 0
    ? "Aucun sujet pré-sélectionné"
    : nbSujets === 1 
      ? "1 sujet de thèse sélectionné" 
      : `${nbSujets} sujets de thèse sélectionnés`;

  // 1. Soumission de la Connexion Unique (Tous les utilisateurs)
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setShowForgotPasswordNotice(false);

    const emailTrim = loginEmail.trim().toLowerCase();
    const passTrim = loginPassword.trim();

    if (!emailTrim || !passTrim) {
      setLoginError("Veuillez renseigner votre adresse email et votre mot de passe.");
      return;
    }

    // Recherche de l'utilisateur dans les comptes enregistrés (démo + créés)
    let foundUser = registeredUsers.find(
      u => u.email.toLowerCase() === emailTrim || (u.cne && u.cne.toLowerCase() === emailTrim)
    );

    // Si non trouvé dans les comptes existants mais présent dans la base simulée d'étudiants USMBA
    if (!foundUser) {
      const etuMatch = etudiantsUSMBA.find(
        etu => etu.email.toLowerCase() === emailTrim || etu.cne.toLowerCase() === emailTrim
      );
      if (etuMatch && (passTrim === 'Candidat2026!' || passTrim === 'Usmba2026!')) {
        const autoUser: UserAccount = {
          id: `user-cand-${etuMatch.cne.toLowerCase()}`,
          nom: etuMatch.nom,
          prenom: etuMatch.prenom,
          email: etuMatch.email,
          password: 'Candidat2026!',
          cin: etuMatch.cin || 'CD556677',
          cne: etuMatch.cne,
          filiere: etuMatch.filiere,
          role: 'CANDIDAT',
          isAcademicUSMBA: true,
          etablissement: etuMatch.etablissement || 'Université Sidi Mohamed Ben Abdellah',
          statut_compte: 'ACTIF'
        };
        onRegisterCandidate(autoUser);
        onSuccess(autoUser);
        return;
      }
      setLoginError("Identifiants incorrects. Aucun compte associé à cette adresse email.");
      return;
    }

    // Vérification de l'état du compte (Actif ou Désactivé par l'administration)
    if (foundUser.statut_compte === 'INACTIF') {
      setLoginError("Compte désactivé, contactez l’administrateur");
      return;
    }

    // Vérification du mot de passe
    // Autorise le mot de passe spécifique du compte, ou le mot de passe universel de démonstration 'Usmba2026!'
    const isPasswordValid = 
      !foundUser.password || 
      foundUser.password === passTrim || 
      passTrim === 'Usmba2026!';

    if (!isPasswordValid) {
      setLoginError("Mot de passe incorrect. Veuillez vérifier votre saisie.");
      return;
    }

    // Connexion réussie : le rôle est un attribut du compte trouvé
    onSuccess(foundUser);
  };

  // 2. Connexion via Google (Firebase Authentication, signInWithPopup, réservée aux comptes USMBA enregistrés)
  const handleGoogleLogin = async () => {
    setLoginError('');
    setShowForgotPasswordNotice(false);
    setIsGoogleLoading(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const googleUser = result.user;
      const googleEmail = (googleUser.email || '').trim().toLowerCase();

      // a) Vérification du domaine : doit être exactement usmba.ac.ma
      const allowedDomain = DOMAINE_ACADEMIQUE_AUTORISE.toLowerCase();
      const emailParts = googleEmail.split('@');
      const emailDomain = emailParts.length === 2 ? emailParts[1] : '';

      if (!googleEmail || emailDomain !== allowedDomain) {
        await deconnecterSessionGoogle();
        setLoginError("Ce bouton est réservé aux comptes USMBA. Candidat d'un autre établissement ? Créez un compte candidat.");
        return;
      }

      // b) Vérification que l'adresse e-mail est confirmée (email_verified)
      if (!googleUser.emailVerified) {
        await deconnecterSessionGoogle();
        setLoginError("Votre adresse e-mail Google USMBA n'est pas confirmée (email_verified).");
        return;
      }

      // c) Vérification de la présence dans la liste des comptes USMBA enregistrés (personnel ou étudiants USMBA)
      const existingUser = registeredUsers.find(
        u => u.email.toLowerCase() === googleEmail
      );
      const etuMatch = etudiantsUSMBA.find(
        etu => etu.email.toLowerCase() === googleEmail
      );

      if (!existingUser && !etuMatch) {
        await deconnecterSessionGoogle();
        setLoginError("Ce compte USMBA n'est pas enregistré");
        return;
      }

      // d) Si le compte existe déjà dans registeredUsers (personnel ou candidat déjà initialisé)
      if (existingUser) {
        if (existingUser.statut_compte === 'INACTIF') {
          await deconnecterSessionGoogle();
          setLoginError("Compte désactivé, contactez l’administrateur");
          return;
        }
        onSuccess(existingUser);
        return;
      }

      // e) Étudiant USMBA enregistré dans la base : relié à sa fiche et dirigé vers l'espace candidat
      if (etuMatch) {
        const linkedStudentUser: UserAccount = {
          id: `user-cand-${etuMatch.cne.toLowerCase()}`,
          nom: etuMatch.nom,
          prenom: etuMatch.prenom,
          email: etuMatch.email,
          cin: etuMatch.cin || 'CD556677',
          cne: etuMatch.cne,
          filiere: etuMatch.filiere,
          role: 'CANDIDAT',
          isAcademicUSMBA: true,
          etablissement: etuMatch.etablissement || 'Université Sidi Mohamed Ben Abdellah',
          statut_compte: 'ACTIF'
        };

        onRegisterCandidate(linkedStudentUser);
        onSuccess(linkedStudentUser);
      }
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string; message?: string };
      const code = firebaseErr?.code || '';

      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setLoginError("La connexion avec Google a été annulée.");
      } else if (code === 'auth/popup-blocked') {
        setLoginError("La fenêtre de connexion Google a été bloquée par votre navigateur. Veuillez autoriser les pop-ups.");
      } else if (code === 'auth/unauthorized-domain') {
        setLoginError("Ce domaine d'application n'est pas encore autorisé dans la console Firebase Authentication.");
      } else if (code === 'auth/operation-not-allowed') {
        setLoginError("Le fournisseur de connexion Google n'est pas activé dans la console Firebase Authentication.");
      } else if (code === 'auth/network-request-failed') {
        setLoginError("Erreur réseau lors de la connexion à Google. Vérifiez votre connexion internet.");
      } else {
        setLoginError("La connexion avec Google a échoué. Veuillez réessayer ou utiliser vos identifiants.");
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // 3. Soumission de l'Inscription Candidat (Seuls les candidats créent un compte)
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!nom.trim()) {
      newErrors.nom = "Le nom de famille est obligatoire.";
    }

    if (!prenom.trim()) {
      newErrors.prenom = "Le prénom est obligatoire.";
    }

    if (!email.trim()) {
      newErrors.email = "L'adresse email est obligatoire.";
    } else if (!emailRegex.test(email.trim())) {
      newErrors.email = "Veuillez saisir une adresse email valide.";
    } else if (registeredUsers.some(u => u.email.toLowerCase() === email.trim().toLowerCase())) {
      newErrors.email = "Un compte existe déjà avec cette adresse email. Veuillez vous connecter.";
    }

    const cinTrim = cin.trim().toUpperCase();
    if (!cinTrim) {
      newErrors.cin = "Le numéro de CIN / Passeport est obligatoire.";
    } else if (registeredUsers.some(u => u.cin && u.cin.trim().toUpperCase() === cinTrim)) {
      newErrors.cin = "Ce CIN est déjà associé à un compte";
    }

    const cneTrim = cne.trim().toUpperCase();
    if (cneTrim) {
      const cneRegex = /^[A-Z]\d{9}$/;
      if (!cneRegex.test(cneTrim)) {
        newErrors.cne = "Format invalide : 1 lettre suivie de 9 chiffres (ex. N143098765).";
      }
    }

    if (!password) {
      newErrors.password = "Le mot de passe est obligatoire.";
    } else if (password.length < 6) {
      newErrors.password = "Le mot de passe doit comporter au moins 6 caractères.";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "La confirmation du mot de passe est obligatoire.";
    } else if (confirmPassword !== password) {
      newErrors.confirmPassword = "Les mots de passe saisis ne correspondent pas.";
    }

    if (!consentement) {
      newErrors.consentement = "Veuillez accepter le traitement de vos données pour valider votre candidature.";
    }

    if (Object.keys(newErrors).length > 0) {
      setRegisterErrors(newErrors);
      return;
    }

    setRegisterErrors({});
    const isAcademic = email.trim().toLowerCase().endsWith('@usmba.ac.ma');

    // Le rôle est TOUJOURS 'CANDIDAT' pour les inscriptions
    const newCandidateUser: UserAccount = {
      id: `user-cand-${Date.now()}`,
      nom: nom.trim().toUpperCase(),
      prenom: prenom.trim().charAt(0).toUpperCase() + prenom.trim().slice(1),
      email: email.trim().toLowerCase(),
      password: password,
      cin: cinTrim,
      cne: cneTrim || undefined,
      filiere: filiere.trim() || matchedEtudiantUSMBA?.filiere || undefined,
      role: 'CANDIDAT',
      isAcademicUSMBA: isAcademic,
      etablissement: matchedEtudiantUSMBA?.etablissement || (isAcademic ? 'Université Sidi Mohamed Ben Abdellah' : 'Candidat Externe')
    };

    onRegisterCandidate(newCandidateUser);
    onSuccess(newCandidateUser);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-[6px] shadow-xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* En-tête Institutionnel du Portail - Vert-bleu uni sans dégradé */}
        <div className="bg-[#0f766e] text-white p-6 sm:p-7 relative border-b border-[#0d655e]">
          <button 
            onClick={onClose}
            className="absolute top-5 right-5 text-teal-200 hover:text-white p-1 rounded-[4px] hover:bg-white/10 transition cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-100 uppercase tracking-widest">
            <Building2 className="w-4 h-4 text-teal-200" />
            Portail CEDoc USMBA
          </div>
          <div className="flex items-center gap-2.5 mt-1">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white font-serif">
              {view === 'LOGIN' && 'Connexion au Portail'}
              {view === 'REGISTER' && 'Créer un compte candidat'}
            </h2>
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-md">
            {view === 'LOGIN' && 'Accédez à votre espace institutionnel ou à votre dossier de candidature doctorale.'}
            {view === 'REGISTER' && 'Inscription réservée aux candidats pour initialiser leur dossier D1.'}
          </p>

          {/* Rappel des choix de thèses si le visiteur en avait retenu */}
          {nbSujets > 0 && (
            <div className="mt-4 p-3 rounded-[6px] bg-white/10 backdrop-blur-md border border-white/20 text-xs text-teal-50 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                <span>
                  <strong>{libelleSujets}</strong> rattaché{nbSujets > 1 ? 's' : ''} à votre compte.
                </span>
              </div>
              <span className="text-[10px] font-bold bg-[#115e59] px-2 py-0.5 rounded-[4px] border border-white/20">
                Choix priorisés
              </span>
            </div>
          )}
        </div>

        {/* Corps du Formulaire */}
        <div className="p-6 sm:p-8">
          
          {/* ========================================================= */}
          {/* VUE 1 : CONNEXION UNIQUE (POUR TOUS LES UTILISATEURS)     */}
          {/* ========================================================= */}
          {view === 'LOGIN' && (
            <div className="space-y-5">
              
              {/* Message d'erreur de connexion */}
              {loginError && (
                <div className="p-3.5 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{loginError}</span>
                </div>
              )}

              {/* Notice mot de passe oublié */}
              {showForgotPasswordNotice && (
                <div className="p-3.5 rounded-[6px] bg-[#f0fdfa] border border-[#ccfbf1] text-slate-800 text-xs space-y-1 animate-in fade-in">
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5 text-[#0f766e]">
                      <Info className="w-4 h-4 text-[#0f766e]" />
                      Récupération du mot de passe
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowForgotPasswordNotice(false)}
                      className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Un lien de réinitialisation sécurisé sera envoyé à l'adresse email institutionnelle ou personnelle renseignée si un compte correspondant existe.
                  </p>
                </div>
              )}

              {/* Formulaire standard Email + Mot de passe */}
              <form onSubmit={handleLoginSubmit} noValidate className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Adresse Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="email"
                      placeholder="nom.prenom@domaine.com"
                      value={loginEmail}
                      onChange={(e) => {
                        setLoginEmail(e.target.value);
                        if (loginError) setLoginError('');
                      }}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Mot de passe
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgotPasswordNotice(true)}
                      className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type={showLoginPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => {
                        setLoginPassword(e.target.value);
                        if (loginError) setLoginError('');
                      }}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                      title={showLoginPassword ? "Masquer" : "Afficher"}
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#0f766e] hover:bg-[#115e59] text-white rounded-[6px] font-bold text-xs sm:text-sm shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Se connecter</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* Séparateur institutionnel */}
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-4 text-slate-400 text-[11px] font-bold lowercase tracking-wider">
                  ou
                </span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              {/* Bouton Authentification Google réelle (Firebase Authentication) */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isGoogleLoading}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-[6px] text-xs font-bold transition flex items-center justify-center gap-2.5 cursor-pointer shadow-2xs hover:border-[#0f766e] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                <span>{isGoogleLoading ? 'Connexion Google en cours...' : 'Se connecter avec Google'}</span>
              </button>

              {/* Zone Création de Compte Candidat (Uniquement pour les candidats) */}
              <div className="pt-4 border-t border-slate-100 text-center space-y-1.5">
                <p className="text-xs text-slate-500">
                  Nouveau candidat au cycle doctoral ?
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setView('REGISTER');
                    setLoginError('');
                  }}
                  className="text-xs font-bold text-[#0f766e] hover:text-[#115e59] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Créer un compte candidat</span>
                </button>
              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* VUE 2 : CRÉER UN COMPTE CANDIDAT (RÉSERVÉ CANDIDATS)     */}
          {/* ========================================================= */}
          {view === 'REGISTER' && (
            <form onSubmit={handleRegisterSubmit} noValidate className="space-y-3.5">
              
              {/* Nom & Prénom */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nom de famille *</label>
                  <input
                    type="text"
                    placeholder="Ex: MANAR"
                    value={nom}
                    onChange={(e) => {
                      setNom(e.target.value);
                      if (registerErrors.nom) setRegisterErrors(prev => ({ ...prev, nom: '' }));
                    }}
                    className={`w-full px-3.5 py-2 rounded-[6px] border text-xs focus:ring-2 focus:outline-none transition-colors ${
                      registerErrors.nom 
                        ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-400' 
                        : 'border-slate-200 focus:ring-[#0f766e]'
                    }`}
                  />
                  {registerErrors.nom && (
                    <p className="text-[11px] text-rose-600 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {registerErrors.nom}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Prénom *</label>
                  <input
                    type="text"
                    placeholder="Ex: Meryem"
                    value={prenom}
                    onChange={(e) => {
                      setPrenom(e.target.value);
                      if (registerErrors.prenom) setRegisterErrors(prev => ({ ...prev, prenom: '' }));
                    }}
                    className={`w-full px-3.5 py-2 rounded-[6px] border text-xs focus:ring-2 focus:outline-none transition-colors ${
                      registerErrors.prenom 
                        ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-400' 
                        : 'border-slate-200 focus:ring-[#0f766e]'
                    }`}
                  />
                  {registerErrors.prenom && (
                    <p className="text-[11px] text-rose-600 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {registerErrors.prenom}
                    </p>
                  )}
                </div>
              </div>

              {/* Email & CIN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email institutionnel ou personnel *</label>
                  <input
                    type="email"
                    placeholder="meryem.manar@usmba.ac.ma"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (registerErrors.email) setRegisterErrors(prev => ({ ...prev, email: '' }));
                    }}
                    className={`w-full px-3.5 py-2 rounded-[6px] border text-xs focus:ring-2 focus:outline-none transition-colors ${
                      registerErrors.email 
                        ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-400' 
                        : 'border-slate-200 focus:ring-[#0f766e]'
                    }`}
                  />
                  {registerErrors.email && (
                    <p className="text-[11px] text-rose-600 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {registerErrors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">N° CIN / Passeport *</label>
                  <input
                    type="text"
                    placeholder="Ex: CD556677"
                    value={cin}
                    onChange={(e) => {
                      setCin(e.target.value);
                      if (registerErrors.cin) setRegisterErrors(prev => ({ ...prev, cin: '' }));
                    }}
                    className={`w-full px-3.5 py-2 rounded-[6px] border text-xs focus:ring-2 focus:outline-none font-mono uppercase transition-colors ${
                      registerErrors.cin 
                        ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-400' 
                        : 'border-slate-200 focus:ring-[#0f766e]'
                    }`}
                  />
                  {registerErrors.cin && (
                    <p className="text-[11px] text-rose-600 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {registerErrors.cin}
                    </p>
                  )}
                </div>
              </div>

              {/* Code Massar / CNE & Filière */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">Code Massar / CNE</label>
                    <span className="text-[10px] text-slate-400 font-medium">Optionnel</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Ex: N123456789"
                    value={cne}
                    onChange={(e) => {
                      setCne(e.target.value);
                      if (registerErrors.cne) setRegisterErrors(prev => ({ ...prev, cne: '' }));
                    }}
                    className={`w-full px-3.5 py-2 rounded-[6px] border text-xs focus:ring-2 focus:outline-none font-mono uppercase transition-colors ${
                      registerErrors.cne 
                        ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-400' 
                        : 'border-slate-200 focus:ring-[#0f766e]'
                    }`}
                  />
                  {registerErrors.cne && (
                    <p className="text-[11px] text-rose-600 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{registerErrors.cne}</span>
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">Filière / Master</label>
                    <span className="text-[10px] text-slate-400 font-medium">Optionnel</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Ex: Master IA & Science des Données"
                    value={filiere}
                    onChange={(e) => setFiliere(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-[6px] border border-slate-200 text-xs focus:ring-2 focus:ring-[#0f766e] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Sujets de thèse sélectionnés */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Sujets de thèse rattachés
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">1 à 3 sujets</span>
                </div>
                <div className={`p-2.5 rounded-[6px] border text-xs flex items-center justify-between transition-colors ${
                  selectedSujets.length === 0 
                    ? 'border-amber-200 bg-amber-50/50 text-amber-900' 
                    : 'border-slate-200 bg-slate-50 text-slate-800'
                }`}>
                  <div className="flex items-center gap-2">
                    <Sparkles className={`w-3.5 h-3.5 shrink-0 ${selectedSujets.length === 0 ? 'text-amber-600' : 'text-[#0f766e]'}`} />
                    <span className="font-semibold text-[11px]">
                      {selectedSujets.length === 0 
                        ? "Aucun sujet pré-sélectionné (redirection automatique vers le choix des sujets après connexion)" 
                        : `${selectedSujets.length} sujet${selectedSujets.length > 1 ? 's' : ''} sélectionné${selectedSujets.length > 1 ? 's' : ''}`
                      }
                    </span>
                  </div>
                  {selectedSujets.length > 0 && (
                    <span className="text-[10px] font-mono font-bold bg-[#f0fdfa] text-[#0f766e] border border-[#ccfbf1] px-1.5 py-0.5 rounded-[4px]">
                      Priorité{selectedSujets.length > 1 ? 's' : ''} 1 {selectedSujets.length > 1 ? `à ${selectedSujets.length}` : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Mot de passe et Confirmation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mot de passe *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Min. 6 caractères"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (registerErrors.password) setRegisterErrors(prev => ({ ...prev, password: '' }));
                      }}
                      className={`w-full pl-3.5 pr-9 py-2 rounded-[6px] border text-xs focus:ring-2 focus:outline-none transition-colors ${
                        registerErrors.password 
                          ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-400' 
                          : 'border-slate-200 focus:ring-[#0f766e]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {registerErrors.password && (
                    <p className="text-[11px] text-rose-600 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {registerErrors.password}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Confirmer mot de passe *</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Répétez mot de passe"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (registerErrors.confirmPassword) setRegisterErrors(prev => ({ ...prev, confirmPassword: '' }));
                      }}
                      className={`w-full pl-3.5 pr-9 py-2 rounded-[6px] border text-xs focus:ring-2 focus:outline-none transition-colors ${
                        registerErrors.confirmPassword 
                          ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-400' 
                          : 'border-slate-200 focus:ring-[#0f766e]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                    >
                      {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {registerErrors.confirmPassword && (
                    <p className="text-[11px] text-rose-600 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {registerErrors.confirmPassword}
                    </p>
                  )}
                </div>
              </div>

              {/* Note informative pour le scan CIN */}
              <div className="p-3 rounded-[6px] bg-slate-50 border border-slate-200 text-[11px] text-slate-500 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-[#0f766e] shrink-0 mt-0.5" />
                <span>
                  Le scan de votre pièce d'identité sera téléversé ultérieurement à l'étape <strong>Pièces justificatives</strong> de votre espace candidat.
                </span>
              </div>

              {/* Case de consentement */}
              <div>
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={consentement}
                    onChange={(e) => {
                      setConsentement(e.target.checked);
                      if (e.target.checked && registerErrors.consentement) {
                        setRegisterErrors(prev => ({ ...prev, consentement: '' }));
                      }
                    }}
                    className="mt-0.5 rounded border-slate-300 text-[#0f766e] focus:ring-[#0f766e] h-4 w-4 cursor-pointer shrink-0"
                  />
                  <span className="text-xs text-slate-600 leading-snug">
                    J'accepte le traitement de mes données personnelles dans le cadre de ma candidature au cycle doctoral USMBA. *
                  </span>
                </label>
                {registerErrors.consentement && (
                  <p className="text-[11px] text-rose-600 font-medium mt-1 ml-6 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {registerErrors.consentement}
                  </p>
                )}
              </div>

              {/* Bouton Inscription */}
              <div className="pt-2 space-y-1.5">
                <button
                  type="submit"
                  className="w-full py-3 bg-[#0f766e] hover:bg-[#115e59] text-white rounded-[6px] font-bold text-xs sm:text-sm shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#86efac]" />
                  <span>
                    {selectedSujets.length > 0
                      ? 'Créer mon compte candidat & enregistrer ma sélection'
                      : 'Créer mon compte candidat & choisir mes sujets'}
                  </span>
                </button>
              </div>

              {/* Retour vers la Connexion */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setView('LOGIN');
                    setRegisterErrors({});
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-[#0f766e] cursor-pointer"
                >
                  Déjà titulaire d'un compte ? <strong className="text-[#0f766e] underline">Se connecter</strong>
                </button>
              </div>

            </form>
          )}

        </div>

      </div>
    </div>
  );
};

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signOut } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

/**
 * Domaine académique autorisé pour l'authentification Google USMBA.
 * Constante modifiable selon la politique de l'établissement.
 */
export const DOMAINE_ACADEMIQUE_AUTORISE = 'usmba.ac.ma';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  hd: DOMAINE_ACADEMIQUE_AUTORISE,
  prompt: 'select_account'
});

/**
 * Déconnecte explicitement la session Firebase Authentication (Google incluse).
 */
export const deconnecterSessionGoogle = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (err) {
    console.error('Erreur lors de la déconnexion Firebase :', err);
  }
};

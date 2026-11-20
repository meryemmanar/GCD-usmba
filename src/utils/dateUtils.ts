import { VersionCampagne } from '../types';

/**
 * Formate une date quelconque (ISO YYYY-MM-DD ou YYYY-MM-DDTHH:mm) au format français standard JJ/MM/AAAA.
 */
export function formatDateJJMMAAAA(dateStr?: string | null): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();

  // Si c'est au format avec heure ISO (ex: 2026-11-12T10:00)
  if (trimmed.includes('T')) {
    const [datePart, timePart] = trimmed.split('T');
    const parts = datePart.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      const [annee, mois, jour] = parts;
      const formatted = `${jour.padStart(2, '0')}/${mois.padStart(2, '0')}/${annee}`;
      const heure = timePart ? timePart.substring(0, 5) : '';
      return heure ? `${formatted} à ${heure}` : formatted;
    }
  }

  // Si c'est au format YYYY-MM-DD
  const parts = trimmed.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [annee, mois, jour] = parts;
    return `${jour.padStart(2, '0')}/${mois.padStart(2, '0')}/${annee}`;
  }

  // Si c'est déjà JJ/MM/AAAA ou autre chaîne
  return trimmed;
}

/**
 * Calcule le nombre de jours restants jusqu'à la date de clôture de la campagne.
 * Si dateCloture est passée ou si la campagne est clôturée, retourne <= 0.
 */
export function getCampagneBadge(campagne: VersionCampagne) {
  const now = new Date();
  // On considère la fin de journée (23h59:59) de la date limite
  const dateCloturePure = campagne.date_cloture.split('T')[0];
  const dateClotureObj = new Date(`${dateCloturePure}T23:59:59`);
  
  const diffMs = dateClotureObj.getTime() - now.getTime();
  const diffJours = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffJours <= 0 || campagne.statut === 'CLOTUREE') {
    return {
      estOuverte: false,
      joursRestants: 0,
      texte: 'Campagne clôturée',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-300'
    };
  }

  return {
    estOuverte: true,
    joursRestants: diffJours,
    texte: `Campagne ouverte · ${diffJours} ${diffJours > 1 ? 'jours restants' : 'jour restant'}`,
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300'
  };
}

import { createWorker } from 'tesseract.js';

export interface RawCnieExtraction {
  nom: string;
  prenom: string;
  cin: string;
  date_naissance: string;
  lieu_naissance: string;
  adresse: string;
  date_validite: string;
}

export type CnieFieldKey = keyof RawCnieExtraction;

export interface ValidatedCnieField {
  value: string; // Valeur validée (ou "" si illisible / invalide — jamais inventée)
  rawDetected: string; // Valeur brute lue avant validation
  isValid: boolean;
  isHighlighted: boolean; // Surligné si illisible ou invalide
  isExpired?: boolean;
  errorMessage?: string;
}

export interface ValidatedCnieExtraction {
  engine: 'GEMINI' | 'TESSERACT_FALLBACK';
  fields: Record<CnieFieldKey, ValidatedCnieField>;
  hasInvalidOrMissingFields: boolean;
  isCardExpired: boolean;
  remainingCount: number;
  allValid: boolean;
}

/**
 * Compare le nom et le prénom extraits de la CNIE avec ceux du compte connecté.
 * Retourne un message d'avertissement explicite en cas de différence.
 */
export function compareExtractedNameWithAccount(
  extractedNom: string,
  extractedPrenom: string,
  accountNom: string,
  accountPrenom: string
): { hasMismatch: boolean; warningMessage?: string } {
  const norm = (s?: string) =>
    (s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');

  const eNom = norm(extractedNom);
  const ePrenom = norm(extractedPrenom);
  const aNom = norm(accountNom);
  const aPrenom = norm(accountPrenom);

  // Si aucun nom ni prénom n'est encore renseigné dans les champs extraits, pas de comparaison trompeuse
  if (!eNom && !ePrenom) {
    return { hasMismatch: false };
  }

  const nomDiffers = Boolean(eNom && aNom && eNom !== aNom);
  const prenomDiffers = Boolean(ePrenom && aPrenom && ePrenom !== aPrenom);

  if (nomDiffers || prenomDiffers) {
    return {
      hasMismatch: true,
      warningMessage: `Attention : le nom/prénom figurant sur la carte (« ${
        extractedPrenom || '—'
      } ${extractedNom || '—'} ») diffère du nom associé à votre compte (« ${accountPrenom} ${accountNom} »). Veuillez vérifier et corriger avant de continuer.`
    };
  }

  return { hasMismatch: false };
}

/**
 * Parse une chaîne de date (JJ/MM/AAAA, JJ-MM-AAAA, JJ.MM.AAAA ou AAAA-MM-JJ)
 * et vérifie qu'il s'agit d'une date calendaire réelle.
 */
export function parseAndValidateDate(raw: string): {
  formattedJJMMAAAA: string;
  isoAAAAMMJJ: string;
  dateObj: Date;
} | null {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.trim().replace(/\s+/g, '');

  let day = 0;
  let month = 0;
  let year = 0;

  const dmyMatch = cleaned.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmyMatch) {
    day = parseInt(dmyMatch[1], 10);
    month = parseInt(dmyMatch[2], 10);
    year = parseInt(dmyMatch[3], 10);
  } else {
    const ymdMatch = cleaned.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
    if (ymdMatch) {
      year = parseInt(ymdMatch[1], 10);
      month = parseInt(ymdMatch[2], 10);
      day = parseInt(ymdMatch[3], 10);
    } else {
      return null;
    }
  }

  if (year < 1920 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const dt = new Date(year, month - 1, day);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return null;
  }

  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  const yyyy = String(year);

  return {
    formattedJJMMAAAA: `${dd}/${mm}/${yyyy}`,
    isoAAAAMMJJ: `${yyyy}-${mm}-${dd}`,
    dateObj: dt
  };
}

/**
 * Secours OCR local avec Tesseract.js (fra + ara) lorsque Gemini n'est pas disponible.
 * Extrait uniquement les motifs explicitement reconnus sans jamais inventer de valeur.
 */
async function extractWithTesseractFallback(
  rectoDataUrl: string,
  versoDataUrl?: string
): Promise<RawCnieExtraction> {
  const worker = await createWorker(['fra', 'ara']);
  try {
    const rectoRes = await worker.recognize(rectoDataUrl);
    let fullText = rectoRes.data.text || '';

    if (versoDataUrl) {
      const versoRes = await worker.recognize(versoDataUrl);
      fullText += '\n' + (versoRes.data.text || '');
    }

    const lines = fullText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    // 1. Numéro de carte (CNIE) : 1 ou 2 lettres suivies de 5 à 6 chiffres
    let cin = '';
    const cinMatch = fullText.match(/\b([A-Z]{1,2}\s?\d{5,6})\b/i);
    if (cinMatch) {
      cin = cinMatch[1].replace(/\s+/g, '').toUpperCase();
    }

    // 2. Extraction des dates présentes
    const dateRegex = /\b(\d{2}[/\-.]\d{2}[/\-.]\d{4})\b/g;
    const foundDates: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = dateRegex.exec(fullText)) !== null) {
      foundDates.push(m[1]);
    }

    let date_naissance = '';
    let date_validite = '';

    const parsedDates = foundDates
      .map(d => parseAndValidateDate(d))
      .filter((d): d is NonNullable<ReturnType<typeof parseAndValidateDate>> => d !== null)
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

    if (parsedDates.length >= 1) {
      const first = parsedDates[0];
      if (first.dateObj.getFullYear() <= new Date().getFullYear() - 15) {
        date_naissance = first.formattedJJMMAAAA;
      } else {
        date_validite = first.formattedJJMMAAAA;
      }
    }
    if (parsedDates.length >= 2) {
      const last = parsedDates[parsedDates.length - 1];
      if (last.dateObj.getTime() !== parsedDates[0].dateObj.getTime()) {
        date_validite = last.formattedJJMMAAAA;
      }
    }

    // 3. Nom, Prénom, Lieu de naissance, Adresse
    let nom = '';
    let prenom = '';
    let lieu_naissance = '';
    let adresse = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!nom && /(?:nom|family\s*name)/i.test(line)) {
        const after = line.split(/[:\-]/)[1]?.trim();
        if (after && /^[A-Za-zÀ-ÿ\s'-]{2,40}$/.test(after)) {
          nom = after.toUpperCase();
        }
      }
      if (!prenom && /(?:pr[eé]nom|given\s*name)/i.test(line)) {
        const after = line.split(/[:\-]/)[1]?.trim();
        if (after && /^[A-Za-zÀ-ÿ\s'-]{2,40}$/.test(after)) {
          prenom = after;
        }
      }
      if (!lieu_naissance && /(?:n[eé]\(?e?\)?\s*[aà]|lieu\s*de\s*naissance)/i.test(line)) {
        const after = line.split(/(?:n[eé]\(?e?\)?\s*[aà]|[:\-])/i).pop()?.trim();
        if (after && /^[A-Za-zÀ-ÿ\s'-]{2,50}$/.test(after)) {
          lieu_naissance = after;
        }
      }
      if (!adresse && /(?:adresse|domicile|r[eé]sidence|quartier|av\.|bd\.|rue)/i.test(line)) {
        const after = line.replace(/^(?:adresse|domicile|r[eé]sidence)\s*[:\-]?\s*/i, '').trim();
        if (after.length >= 4) {
          adresse = after;
        }
      }
    }

    return {
      nom,
      prenom,
      cin,
      date_naissance,
      lieu_naissance,
      adresse,
      date_validite
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * Exécute l'extraction CNIE via le modèle Gemini (JSON strict) côté serveur,
 * et bascule automatiquement sur Tesseract.js (fra + ara) si Gemini n'est pas disponible.
 */
export async function extractCnieDataFromImages(
  rectoDataUrl: string,
  versoDataUrl?: string
): Promise<{ engine: 'GEMINI' | 'TESSERACT_FALLBACK'; raw: RawCnieExtraction }> {
  try {
    const response = await fetch('/api/cnie/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rectoDataUrl, versoDataUrl })
    });

    if (response.ok) {
      const payload = (await response.json()) as {
        engine: 'GEMINI';
        data: RawCnieExtraction;
      };
      if (payload && payload.data) {
        return {
          engine: 'GEMINI',
          raw: {
            nom: payload.data.nom || '',
            prenom: payload.data.prenom || '',
            cin: payload.data.cin || '',
            date_naissance: payload.data.date_naissance || '',
            lieu_naissance: payload.data.lieu_naissance || '',
            adresse: payload.data.adresse || '',
            date_validite: payload.data.date_validite || ''
          }
        };
      }
    }
  } catch (err) {
    console.warn('Gemini indisponible, bascule sur Tesseract.js (fra + ara) :', err);
  }

  const fallbackData = await extractWithTesseractFallback(rectoDataUrl, versoDataUrl);
  return {
    engine: 'TESSERACT_FALLBACK',
    raw: fallbackData
  };
}

/**
 * Validation stricte avant remplissage et lors de la saisie :
 * - Numéro de carte (CIN) : 1 ou 2 lettres suivies de 5 à 6 chiffres (/^[A-Z]{1,2}\d{5,6}$/)
 * - Dates valides (date de naissance et date de validité)
 * - Carte non expirée (date de validité >= aujourd'hui)
 * - Si un champ est illisible ou invalide, le laisse vide ("") et fournit un message précis (« Le numéro de carte est obligatoire », « Format invalide », etc.).
 */
export function validateCnieExtraction(
  engine: 'GEMINI' | 'TESSERACT_FALLBACK',
  raw: RawCnieExtraction
): ValidatedCnieExtraction {
  const cleanText = (val?: string) => (val || '').trim();

  // 1. Validation du Nom
  const rawNom = cleanText(raw.nom);
  const isNomValid = rawNom.length >= 2 && /^[A-Za-zÀ-ÿ\s'-]+$/.test(rawNom);
  const nomField: ValidatedCnieField = isNomValid
    ? {
        value: rawNom.toUpperCase(),
        rawDetected: rawNom,
        isValid: true,
        isHighlighted: false
      }
    : {
        value: '',
        rawDetected: rawNom,
        isValid: false,
        isHighlighted: true,
        errorMessage: rawNom
          ? 'Format invalide (lettres uniquement, minimum 2 caractères)'
          : 'Le nom de famille est obligatoire'
      };

  // 2. Validation du Prénom
  const rawPrenom = cleanText(raw.prenom);
  const isPrenomValid = rawPrenom.length >= 2 && /^[A-Za-zÀ-ÿ\s'-]+$/.test(rawPrenom);
  const prenomField: ValidatedCnieField = isPrenomValid
    ? {
        value: rawPrenom,
        rawDetected: rawPrenom,
        isValid: true,
        isHighlighted: false
      }
    : {
        value: '',
        rawDetected: rawPrenom,
        isValid: false,
        isHighlighted: true,
        errorMessage: rawPrenom
          ? 'Format invalide (lettres uniquement, minimum 2 caractères)'
          : 'Le prénom est obligatoire'
      };

  // 3. Validation du Numéro de carte (CNIE) : 1 ou 2 lettres suivies de 5 à 6 chiffres
  const rawCin = cleanText(raw.cin).replace(/[\s\-_]/g, '').toUpperCase();
  const cinRegex = /^[A-Z]{1,2}\d{5,6}$/;
  const isCinValid = cinRegex.test(rawCin);
  const cinField: ValidatedCnieField = isCinValid
    ? {
        value: rawCin,
        rawDetected: rawCin,
        isValid: true,
        isHighlighted: false
      }
    : {
        value: '',
        rawDetected: rawCin,
        isValid: false,
        isHighlighted: true,
        errorMessage: rawCin
          ? 'Format invalide (1 ou 2 lettres suivies de 5 à 6 chiffres)'
          : 'Le numéro de carte est obligatoire'
      };

  // 4. Validation de la Date de naissance
  const rawNaissance = cleanText(raw.date_naissance);
  const parsedNaissance = parseAndValidateDate(rawNaissance);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isNaissanceValid =
    parsedNaissance !== null && parsedNaissance.dateObj.getTime() < today.getTime();
  const naissanceField: ValidatedCnieField =
    isNaissanceValid && parsedNaissance
      ? {
          value: parsedNaissance.formattedJJMMAAAA,
          rawDetected: rawNaissance,
          isValid: true,
          isHighlighted: false
        }
      : {
          value: '',
          rawDetected: rawNaissance,
          isValid: false,
          isHighlighted: true,
          errorMessage: rawNaissance
            ? 'Format invalide (date calendaire JJ/MM/AAAA requise)'
            : 'La date de naissance est obligatoire'
        };

  // 5. Validation du Lieu de naissance
  const rawLieu = cleanText(raw.lieu_naissance);
  const isLieuValid = rawLieu.length >= 2 && /[A-Za-zÀ-ÿ]/.test(rawLieu);
  const lieuField: ValidatedCnieField = isLieuValid
    ? {
        value: rawLieu,
        rawDetected: rawLieu,
        isValid: true,
        isHighlighted: false
      }
    : {
        value: '',
        rawDetected: rawLieu,
        isValid: false,
        isHighlighted: true,
        errorMessage: rawLieu
          ? 'Format invalide (minimum 2 caractères alphabétiques)'
          : 'Le lieu de naissance est obligatoire'
      };

  // 6. Validation de l'Adresse
  const rawAdresse = cleanText(raw.adresse);
  const isAdresseValid = rawAdresse.length >= 4 && /[A-Za-zÀ-ÿ0-9]/.test(rawAdresse);
  const adresseField: ValidatedCnieField = isAdresseValid
    ? {
        value: rawAdresse,
        rawDetected: rawAdresse,
        isValid: true,
        isHighlighted: false
      }
    : {
        value: '',
        rawDetected: rawAdresse,
        isValid: false,
        isHighlighted: true,
        errorMessage: rawAdresse
          ? 'Format invalide (adresse complète requise, min. 4 caractères)'
          : "L'adresse est obligatoire"
      };

  // 7. Validation de la Date de validité (date valide ET carte non expirée)
  const rawValidite = cleanText(raw.date_validite);
  const parsedValidite = parseAndValidateDate(rawValidite);
  let validiteField: ValidatedCnieField;
  let isCardExpired = false;

  if (!parsedValidite) {
    validiteField = {
      value: '',
      rawDetected: rawValidite,
      isValid: false,
      isHighlighted: true,
      errorMessage: rawValidite
        ? 'Format invalide (date calendaire JJ/MM/AAAA requise)'
        : 'La date de validité est obligatoire'
    };
  } else if (parsedValidite.dateObj.getTime() < today.getTime()) {
    isCardExpired = true;
    validiteField = {
      value: '',
      rawDetected: parsedValidite.formattedJJMMAAAA,
      isValid: false,
      isHighlighted: true,
      isExpired: true,
      errorMessage: `Carte nationale expirée le ${parsedValidite.formattedJJMMAAAA}`
    };
  } else {
    validiteField = {
      value: parsedValidite.formattedJJMMAAAA,
      rawDetected: rawValidite,
      isValid: true,
      isHighlighted: false
    };
  }

  const fields: Record<CnieFieldKey, ValidatedCnieField> = {
    nom: nomField,
    prenom: prenomField,
    cin: cinField,
    date_naissance: naissanceField,
    lieu_naissance: lieuField,
    adresse: adresseField,
    date_validite: validiteField
  };

  const remainingCount = Object.values(fields).filter(f => !f.isValid).length;
  const hasInvalidOrMissingFields = remainingCount > 0;
  const allValid = remainingCount === 0 && !isCardExpired;

  return {
    engine,
    fields,
    hasInvalidOrMissingFields,
    isCardExpired,
    remainingCount,
    allValid
  };
}


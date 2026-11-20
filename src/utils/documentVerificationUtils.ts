import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createWorker } from 'tesseract.js';
import {
  Candidature,
  ExtractedCandidateDocData,
  ResultatControleConformite,
  StatutConformiteAuto,
  TypePieceObligatoire
} from '../types';

if (typeof window !== 'undefined' && typeof pdfWorkerUrl === 'string') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

export interface StructuredDocAnalysis {
  detectedType: TypePieceObligatoire | 'AUTRE';
  detectedSummary?: string;
  hasMentionCnie: boolean;
  detectedCinNumber: string;
  hasNomEtPrenom: boolean;
  hasDateNaissance: boolean;
  hasDateValidite: boolean;
  hasRectoEtVerso: boolean;
  hasMentionLicence: boolean;
  hasAttestationReussite: boolean;
  hasEtablissement: boolean;
  hasAnnee: boolean;
  hasNom: boolean;
  hasCne: boolean;
  hasMentionMasterOuIngenieur: boolean;
  hasIntituleFiliere: boolean;
  hasMentionReleveNotes: boolean;
  hasSemestreS1: boolean;
  hasSemestreS2: boolean;
  hasSemestreS3: boolean;
  hasSemestreS4: boolean;
  hasNotesOuMoyennes: boolean;
  hasTitreProjetRecherche: boolean;
  hasObjectifsOuProblematique: boolean;
  hasMethodologie: boolean;
  hasRubriquesCv: boolean;
  hasCoordonnees: boolean;
  isScanIllisible?: boolean;
  isTypeIncertain?: boolean;
  extractedCandidate?: ExtractedCandidateDocData;
}

export interface DocumentVerificationResult {
  status: StatutConformiteAuto;
  valid: boolean;
  etape1Valid: boolean;
  etape2Valid: boolean;
  detectedType: TypePieceObligatoire | 'AUTRE';
  missingElements: string[];
  mismatches: string[];
  uncertainties: string[];
  error?: string;
  engine: 'PDFJS_TEXT' | 'GEMINI' | 'TESSERACT_FALLBACK';
  extractedCandidate: ExtractedCandidateDocData;
}

interface PdfExtractionPayload {
  pageCount: number;
  fullText: string;
  pageTexts: string[];
  isScanned: boolean;
  pageImages: string[];
}

const EMPTY_CANDIDATE_DATA: ExtractedCandidateDocData = {
  nom: '',
  prenom: '',
  cin: '',
  cne: '',
  date_naissance: '',
  lieu_naissance: '',
  filiere: '',
  email: '',
  titre_sujet: ''
};

function normalizeText(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeCompareText(input: string): string {
  return normalizeText(input)
    .replace(/['’\-_/.,:;()\[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function decodePdfDataUrlToBytes(dataUrl: string): Uint8Array {
  const base64Marker = ';base64,';
  const base64Index = dataUrl.indexOf(base64Marker);
  const base64 =
    base64Index !== -1 ? dataUrl.substring(base64Index + base64Marker.length) : dataUrl.split(',')[1] || '';
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

const EXPECTED_TYPE_ARTICLE_LABELS: Record<TypePieceObligatoire, string> = {
  "Carte d'identité nationale (CIN)": 'une Carte nationale (CNIE)',
  'Attestation de réussite de Licence': 'une Attestation de réussite de Licence',
  'Diplôme de Master / Ingénieur': 'un Diplôme de Master / Ingénieur',
  'Relevés de notes Master (S1-S4)': 'un Relevé de notes Master (S1-S4)',
  'Projet de recherche rédigé': 'un Projet de recherche rédigé',
  'Curriculum Vitae détaillé': 'un Curriculum Vitae détaillé'
};

const RESEMBLANCE_MESSAGES: Record<TypePieceObligatoire, string> = {
  "Carte d'identité nationale (CIN)":
    'Ce document ressemble à une Carte nationale (CNIE), déposez-le dans la case Carte nationale (CNIE).',
  'Attestation de réussite de Licence':
    'Ce document ressemble à une Attestation de réussite de Licence, déposez-le dans la case Attestation de réussite de Licence.',
  'Diplôme de Master / Ingénieur':
    'Ce document ressemble à un Diplôme de Master / Ingénieur, déposez-le dans la case Diplôme de Master / Ingénieur.',
  'Relevés de notes Master (S1-S4)':
    'Ce document ressemble à un Relevé de notes Master (S1-S4), déposez-le dans la case Relevés de notes Master (S1-S4).',
  'Projet de recherche rédigé':
    'Ce document ressemble à un Projet de recherche rédigé, déposez-le dans la case Projet de recherche rédigé.',
  'Curriculum Vitae détaillé':
    'Ce document ressemble à un CV, déposez-le dans la case Curriculum Vitae.'
};

/**
 * Normalise une date (JJ/MM/AAAA, AAAA-MM-JJ, « 12 mars 2001 », etc.) vers JJ/MM/AAAA.
 */
function normalizeDateValue(rawDate: string): string | null {
  const cleaned = normalizeText(rawDate || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;

  const ymd = cleaned.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (ymd) {
    return `${ymd[3].padStart(2, '0')}/${ymd[2].padStart(2, '0')}/${ymd[1]}`;
  }

  const dmy = cleaned.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b/);
  if (dmy) {
    return `${dmy[1].padStart(2, '0')}/${dmy[2].padStart(2, '0')}/${dmy[3]}`;
  }

  const months: Record<string, string> = {
    janvier: '01',
    fevrier: '02',
    mars: '03',
    avril: '04',
    mai: '05',
    juin: '06',
    juillet: '07',
    aout: '08',
    septembre: '09',
    octobre: '10',
    novembre: '11',
    decembre: '12'
  };
  const named = cleaned.match(/\b(\d{1,2})\s+([a-z]+)\s+(\d{4})\b/);
  if (named && months[named[2]]) {
    return `${named[1].padStart(2, '0')}/${months[named[2]]}/${named[3]}`;
  }

  return null;
}

/**
 * Construit le profil de référence du candidat à partir du dossier et de l'étape « Informations personnelles ».
 */
export function buildCandidateReferenceProfile(candidature?: Candidature) {
  const rawCne = (candidature?.candidat_cne || '').replace(/\s+/g, '').toUpperCase();
  const cneIgnoredValues = new Set(['', 'NONRENSEIGNE', 'N/A', 'NA', '-', 'AUCUN', 'SANS']);
  const cne = cneIgnoredValues.has(rawCne) ? '' : rawCne;

  return {
    nom: (candidature?.donnees_scan_cnie?.nom || candidature?.candidat_nom || '').trim(),
    prenom: (candidature?.donnees_scan_cnie?.prenom || candidature?.candidat_prenom || '').trim(),
    cin: (candidature?.donnees_scan_cnie?.cin || candidature?.candidat_cin || '')
      .replace(/\s+/g, '')
      .toUpperCase(),
    cne,
    date_naissance: (
      candidature?.donnees_scan_cnie?.date_naissance ||
      candidature?.candidat_date_naissance ||
      ''
    ).trim(),
    lieu_naissance: (
      candidature?.donnees_scan_cnie?.lieu_naissance ||
      candidature?.candidat_lieu_naissance ||
      ''
    ).trim(),
    filiere: (candidature?.candidat_filiere || '').trim(),
    email: (candidature?.candidat_email || '').trim().toLowerCase(),
    sujetsTitres: (candidature?.choix_sujets || [])
      .map((cs) => cs.sujet?.titre?.trim() || '')
      .filter(Boolean)
  };
}

function namesMatch(docName: string, dossierName: string): boolean {
  const a = normalizeCompareText(docName);
  const b = normalizeCompareText(dossierName);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.replace(/\s+/g, '') === b.replace(/\s+/g, '')) return true;

  const tokensA = a.split(' ').filter(Boolean);
  const tokensB = b.split(' ').filter(Boolean);
  if (tokensA.length === 0 || tokensB.length === 0) return false;

  const allBInA = tokensB.every((t) => tokensA.includes(t));
  const allAInB = tokensA.every((t) => tokensB.includes(t));
  return allBInA || allAInB;
}

function lieuMatches(docLieu: string, dossierLieu: string): boolean {
  const a = normalizeCompareText(docLieu);
  const b = normalizeCompareText(dossierLieu);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;

  const tokensA = a.split(' ').filter((t) => t.length >= 2);
  const tokensB = b.split(' ').filter((t) => t.length >= 2);
  return tokensA.some((t) => tokensB.includes(t));
}

const FILIERE_STOPWORDS = new Set([
  'master',
  'mastere',
  'diplome',
  'ingenieur',
  'cycle',
  'filiere',
  'specialite',
  'option',
  'parcours',
  'sciences',
  'techniques',
  'technique',
  'et',
  'en',
  'de',
  'des',
  'du',
  'la',
  'le',
  'les',
  'l',
  'd',
  'a',
  'au',
  'aux',
  'universite',
  'usmba',
  'fes',
  'mention',
  'bien',
  'tres',
  'assez',
  'passable'
]);

function significantTokens(input: string, extraStopwords?: Set<string>): string[] {
  return normalizeCompareText(input)
    .split(' ')
    .filter((t) => t.length >= 3 && !FILIERE_STOPWORDS.has(t) && !extraStopwords?.has(t));
}

function filiereMatches(docFiliere: string, dossierFiliere: string): boolean {
  const normDoc = normalizeCompareText(docFiliere);
  const normDos = normalizeCompareText(dossierFiliere);
  if (!normDoc || !normDos) return false;
  if (normDoc === normDos || normDoc.includes(normDos) || normDos.includes(normDoc)) return true;

  const tDoc = significantTokens(docFiliere);
  const tDos = significantTokens(dossierFiliere);
  if (tDoc.length === 0 || tDos.length === 0) {
    return normDoc.includes(normDos) || normDos.includes(normDoc);
  }

  const common = tDoc.filter((t) => tDos.includes(t));
  const minLen = Math.min(tDoc.length, tDos.length);
  return common.length / minLen >= 0.5;
}

const SUJET_STOPWORDS = new Set([
  'pour',
  'avec',
  'dans',
  'par',
  'sur',
  'une',
  'des',
  'les',
  'aux',
  'application',
  'contexte',
  'etude',
  'analyse',
  'approche',
  'systeme',
  'modele',
  'projet',
  'recherche',
  'these'
]);

function sujetMatchesAny(docTitre: string, dossierTitres: string[]): boolean {
  const normDoc = normalizeCompareText(docTitre);
  if (!normDoc) return false;

  for (const titre of dossierTitres) {
    const normDos = normalizeCompareText(titre);
    if (!normDos) continue;
    if (normDoc === normDos || normDoc.includes(normDos) || normDos.includes(normDoc)) {
      return true;
    }

    const tDoc = significantTokens(docTitre, SUJET_STOPWORDS);
    const tDos = significantTokens(titre, SUJET_STOPWORDS);
    if (tDoc.length > 0 && tDos.length > 0) {
      const common = tDoc.filter((t) => tDos.includes(t));
      const ratio = common.length / Math.min(tDoc.length, tDos.length);
      if (ratio >= 0.5) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Extraction du texte avec pdf.js, détection des pages scannées (images)
 * et rendu en images JPEG lorsque le PDF contient des scans.
 */
async function extractPdfContentWithPdfJs(pdfBytes: Uint8Array): Promise<PdfExtractionPayload> {
  const bytesCopy = pdfBytes.slice();
  const loadingTask = pdfjsLib.getDocument({ data: bytesCopy });
  const pdfDoc = await loadingTask.promise;

  try {
    const pageCount = pdfDoc.numPages;
    const pageTexts: string[] = [];
    let anyPageNeedsVision = false;

    const imageOps = new Set<number>([
      pdfjsLib.OPS.paintImageXObject,
      pdfjsLib.OPS.paintInlineImageXObject,
      pdfjsLib.OPS.paintImageMaskXObject
    ]);

    for (let p = 1; p <= pageCount; p++) {
      const page = await pdfDoc.getPage(p);
      const tc = await page.getTextContent();
      const pageStr = tc.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      pageTexts.push(pageStr);

      let hasImageOps = false;
      try {
        const opList = await page.getOperatorList();
        hasImageOps = opList.fnArray.some((fn) => imageOps.has(fn));
      } catch {
        hasImageOps = false;
      }

      const compactLen = pageStr.replace(/\s+/g, '').length;
      if (compactLen < 120 || (hasImageOps && compactLen < 350)) {
        anyPageNeedsVision = true;
      }
    }

    const fullText = pageTexts.join('\n').trim();
    const totalCompactLen = fullText.replace(/\s+/g, '').length;
    const isScanned = anyPageNeedsVision || totalCompactLen < 200;

    const pageImages: string[] = [];
    if (isScanned) {
      const maxPagesToRender = Math.min(pageCount, 4);
      for (let p = 1; p <= maxPagesToRender; p++) {
        const page = await pdfDoc.getPage(p);
        const baseViewport = page.getViewport({ scale: 1 });
        const targetScale = Math.min(2.0, Math.max(1.2, 1200 / Math.max(1, baseViewport.width)));
        const viewport = page.getViewport({ scale: targetScale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, canvas, viewport }).promise;
          pageImages.push(canvas.toDataURL('image/jpeg', 0.85));
        }
      }
    }

    return {
      pageCount,
      fullText,
      pageTexts,
      isScanned,
      pageImages
    };
  } finally {
    await loadingTask.destroy();
  }
}

/**
 * Extrait les champs du candidat depuis le texte brut (repli local lorsque Gemini est indisponible).
 */
export function extractCandidateFieldsFromText(rawText: string): ExtractedCandidateDocData {
  const compact = (rawText || '').replace(/\s+/g, ' ').trim();
  const lines = (rawText || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const emailMatch = compact.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  const email = emailMatch ? emailMatch[0].toLowerCase() : '';

  const cneLabelMatch = compact.match(/\b(?:cne|code\s*massar|massar)\s*[:\-]?\s*([A-Z]\d{9})\b/i);
  const cneFallbackMatch = compact.match(/\b([A-Z]\d{9})\b/);
  const cne = (cneLabelMatch?.[1] || cneFallbackMatch?.[1] || '').toUpperCase();

  const cinLabelMatch = compact.match(
    /\b(?:n[°o]?\s*)?(?:c\.?n\.?i\.?e?\.?|c\.?i\.?n\.?)\s*[:\-]?\s*([A-Z]{1,2}\s?\d{5,6})\b/i
  );
  const cinFallbackMatch = compact.match(/\b([A-Z]{1,2}\s?\d{5,6})\b/);
  const cin = (cinLabelMatch?.[1] || cinFallbackMatch?.[1] || '').replace(/\s+/g, '').toUpperCase();

  const dateNaissMatch = compact.match(
    /(?:n[ée]\(?e?\)?\s*le|date\s+de\s+naissance\s*[:\-]?)\s*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4}|\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})/i
  );
  const date_naissance = dateNaissMatch ? dateNaissMatch[1] : '';

  const lieuNaissMatch = compact.match(
    /(?:n[ée]\(?e?\)?\s*(?:le\s*\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4}\s*)?[àa]|lieu\s+de\s+naissance\s*[:\-]?)\s*([A-ZÀ-Ÿa-zà-ÿ][A-ZÀ-Ÿa-zà-ÿ'’\-\s]{1,30}?)(?=\s*(?:N[°o]|CIN|CNE|Code|Nationalit|Valable|Adresse|E-?mail|\||$))/i
  );
  const lieu_naissance = lieuNaissMatch ? lieuNaissMatch[1].trim() : '';

  let nom = '';
  let prenom = '';

  const nomLabel = compact.match(/\bNom(?:\s+de\s+famille)?\s*[:\-]\s*([A-ZÀ-Ÿ][A-ZÀ-Ÿa-zà-ÿ'\- ]{1,30}?)(?=\s+(?:Pr[ée]nom|N[ée]|Date|N[°o]|CIN|CNE|$))/i);
  const prenomLabel = compact.match(/\bPr[ée]nom\s*[:\-]\s*([A-ZÀ-Ÿa-zà-ÿ][A-ZÀ-Ÿa-zà-ÿ'\- ]{1,30}?)(?=\s+(?:Nom|N[ée]|Date|N[°o]|CIN|CNE|Adresse|$))/i);

  if (nomLabel) nom = nomLabel[1].trim();
  if (prenomLabel) prenom = prenomLabel[1].trim();

  if (!nom || !prenom) {
    const combinedMatch = compact.match(
      /(?:Nom\s+et\s+pr[ée]nom|Candidat|Titulaire|Etudiant(?:\(e\))?)\s*[:\-]?\s*([A-ZÀ-Ÿa-zà-ÿ'\-]{2,25})\s+([A-ZÀ-Ÿa-zà-ÿ'\-]{2,25})/i
    );
    if (combinedMatch) {
      const p1 = combinedMatch[1].trim();
      const p2 = combinedMatch[2].trim();
      const isP1Upper = p1 === p1.toUpperCase() && /[A-Z]/.test(p1);
      const isP2Upper = p2 === p2.toUpperCase() && /[A-Z]/.test(p2);
      if (isP1Upper && !isP2Upper) {
        nom = nom || p1;
        prenom = prenom || p2;
      } else if (!isP1Upper && isP2Upper) {
        prenom = prenom || p1;
        nom = nom || p2;
      } else {
        nom = nom || p1;
        prenom = prenom || p2;
      }
    }
  }

  // En-tête de CV type « PRENOM NOM » sur la première ligne
  if ((!nom || !prenom) && lines.length > 0) {
    const firstHeader = lines[0].match(/^([A-ZÀ-Ÿ]{2,25})\s+([A-ZÀ-Ÿ]{2,25})$/);
    if (firstHeader) {
      prenom = prenom || firstHeader[1];
      nom = nom || firstHeader[2];
    }
  }

  const filiereMatch = compact.match(
    /(?:Fili[èe]re|Sp[ée]cialit[ée]|Parcours|Dipl[ôo]me\s+de)\s*[:\-]\s*([^|\n,]{3,80}?)(?=\s*(?:Candidat|Nom\b|Pr[ée]nom|Etudiant|Ann[ée]e|Session|Mention|CIN|CNE|E-?mail|$))/i
  );
  const masterDirectMatch = compact.match(
    /\b((?:Master(?:\s+en|\s+Sciences\s+et\s+Techniques)?|Cycle\s+Ing[ée]nieur)\s*[-–:]?\s*[A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’\-\s]{4,70}?)(?=\s*(?:,|USMBA|F[èe]s|Mention|Ann[ée]e|Candidat|Nom\b|\(|$))/i
  );
  const filiere = (filiereMatch?.[1] || masterDirectMatch?.[1] || '').trim();

  const titreMatch = compact.match(
    /(?:\bTitre\b|Sujet\s+de\s+th[èe]se|Intitul[ée]\s+du\s+sujet)\s*[:\-]?\s*(.{10,220}?)(?=\s*(?:Candidat|Domaine|Encadrant|Dur[ée]e|1\.|Contexte|$))/i
  );
  const titre_sujet = titreMatch ? titreMatch[1].trim() : '';

  return {
    nom,
    prenom,
    cin,
    cne,
    date_naissance,
    lieu_naissance,
    filiere,
    email,
    titre_sujet
  };
}

/**
 * Analyse heuristique déterministe sur le texte extrait par pdf.js (ou OCR Tesseract en secours).
 * Ne tient jamais compte du nom du fichier.
 */
export function analyzeTextHeuristically(
  rawText: string,
  pageCount: number,
  _pageTexts?: string[]
): StructuredDocAnalysis {
  const norm = normalizeText(rawText);
  const rawCompact = (rawText || '').replace(/\s+/g, ' ');
  const extractedCandidate = extractCandidateFieldsFromText(rawText);

  // --- Détection CNIE ---
  const hasMentionCnie =
    /(carte\s+nationale|c\.?n\.?i\.?e|carte\s+d['’]identite|royaume\s+du\s+maroc.*identite|بطاقة\s+التعريف)/i.test(
      norm
    );
  const cinRegexMatch = rawCompact.match(/\b([A-Z]{1,2}\s?\d{5,6})\b/);
  const detectedCinNumber =
    extractedCandidate.cin || (cinRegexMatch ? cinRegexMatch[1].replace(/\s+/g, '').toUpperCase() : '');
  const allDates = rawCompact.match(/\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4}\b/g) || [];
  const hasDateNaissance =
    /(ne\(?e?\)?\s*le|date\s+de\s+naissance|naissance)/i.test(norm) || allDates.length >= 1;
  const hasDateValidite =
    /(valable\s+jusqu|validite|expire|expiration)/i.test(norm) || allDates.length >= 2;
  const hasNomEtPrenom =
    Boolean(extractedCandidate.nom && extractedCandidate.prenom) ||
    /(nom\s*[:\s]|prenom\s*[:\s]|nom\s+et\s+prenom)/i.test(norm) ||
    /(?:\b[A-Z]{3,}\b.*\b[A-Z][a-z]{2,}\b)/.test(rawCompact);
  const hasRecto = /recto/i.test(norm);
  const hasVerso = /verso|adresse|etat\s+civil|idmar|i<mar/i.test(norm);
  const hasRectoEtVerso = pageCount >= 2 && ((hasRecto && hasVerso) || hasMentionCnie);

  // --- Détection Attestation de réussite de Licence ---
  const hasMentionLicence = /\blicence\b/i.test(norm);
  const hasAttestationReussite =
    /attestation\s+de\s+r[eé]ussite/i.test(norm) ||
    (/\battestation\b/i.test(norm) && /\breussite\b/i.test(norm)) ||
    (/\batteste\b/i.test(norm) && /\bsatisfait\b/i.test(norm));
  const hasEtablissement =
    /(faculte|universite|ecole|institut|fsdm|fst|fsjes|ensa|est|usmba|ump|ucam|um5|uh2c|doyen|directeur)/i.test(
      norm
    );
  const hasAnnee =
    /\b(?:19|20)\d{2}\s*[-/]\s*(?:19|20)\d{2}\b/.test(norm) ||
    /(?:annee\s+(?:universitaire|academique|d'obtention)|promotion|session|juin|juillet|septembre)\s*[:\s\-]*(?:19|20)\d{2}/i.test(
      norm
    ) ||
    /\b20[0-3]\d\b/.test(norm);
  const hasNom =
    Boolean(extractedCandidate.nom) ||
    /(nom\s*(?:et|&)?\s*prenom|candidat\s*:|etudiant\s*:|m\.|mme|mlle|atteste\s+que)/i.test(norm) ||
    /\b[A-Z]{3,}\s+[A-ZÀ-Ÿ][a-zà-ÿ]{2,}\b/.test(rawCompact) ||
    /\b[A-ZÀ-Ÿ][a-zà-ÿ]{2,}\s+[A-Z]{3,}\b/.test(rawCompact);
  const hasCne =
    Boolean(extractedCandidate.cne) || /\b(cne|code\s*massar|massar)\b/i.test(norm);

  // --- Détection Diplôme de Master / Ingénieur ---
  const hasMentionMasterOuIngenieur = /\b(master|mastere|ingenieur)\b/i.test(norm);
  const hasIntituleFiliere =
    Boolean(extractedCandidate.filiere) ||
    /(filiere|specialite|parcours|option|mention\s+de\s+diplome|sciences\s+et\s+techniques|genie\s+[a-z]|ingenierie|intelligence\s+artificielle|systemes\s+intelligents|biotechnologie|matiere|materiaux|management|informatique|mathematiques|physique|chimie|biologie|droit|economie|reseaux|securite|electronique)/i.test(
      norm
    );

  // --- Détection Relevés de notes Master (S1-S4) ---
  const hasMentionReleveNotes =
    /(releve\s+de\s+notes|releves\s+de\s+notes|releve\s+des\s+notes|bulletin\s+de\s+notes|transcript)/i.test(
      norm
    );
  const hasSemestreS1 = /\b(s\s*1|semestre\s*1|semestre\s*i)\b/i.test(norm);
  const hasSemestreS2 = /\b(s\s*2|semestre\s*2|semestre\s*ii)\b/i.test(norm);
  const hasSemestreS3 = /\b(s\s*3|semestre\s*3|semestre\s*iii)\b/i.test(norm);
  const hasSemestreS4 = /\b(s\s*4|semestre\s*4|semestre\s*iv)\b/i.test(norm);
  const hasNotesOuMoyennes =
    /(moyenne|note|notes|credit|module|validation|valide)/i.test(norm) &&
    (/\b(?:[01]?\d|20)[.,]\d{1,2}\b/.test(rawCompact) || /\b\d{1,2}\s*\/\s*20\b/.test(rawCompact));

  // --- Détection Projet de recherche rédigé ---
  const hasProjetKeywords =
    /(projet\s+de\s+recherche|proposition\s+de\s+recherche|avant[- ]projet|note\s+de\s+cadrage|these\s+de\s+doctorat)/i.test(
      norm
    );
  const hasTitreProjetRecherche =
    hasProjetKeywords &&
    (Boolean(extractedCandidate.titre_sujet) || /(titre|sujet|intitule|theme|these\s*:)/i.test(norm));
  const hasObjectifsOuProblematique =
    /(objectif|objectifs|problematique|contexte|question\s+de\s+recherche|hypothese|enjeu|but\s+de)/i.test(
      norm
    );
  const hasMethodologie =
    /(methodologie|methode|methodes|approche|protocole|demarche|plan\s+de\s+travail|etapes\s+de)/i.test(
      norm
    );

  // --- Détection CV ---
  const hasFormationHeading = /\b(formation|formations|education|etudes|diplomes|parcours\s+academique)\b/i.test(
    norm
  );
  const hasExperienceHeading = /\b(experience|experiences|stages?|parcours\s+professionnel|activites)\b/i.test(
    norm
  );
  const hasCompetenceHeading = /\b(competences?|savoir[- ]faire|langues|logiciels|outils)\b/i.test(norm);
  const cvRubriquesCount =
    (hasFormationHeading ? 1 : 0) + (hasExperienceHeading ? 1 : 0) + (hasCompetenceHeading ? 1 : 0);
  const hasRubriquesCv =
    /curriculum\s+vitae|\bcv\b/i.test(norm) ? cvRubriquesCount >= 1 : cvRubriquesCount >= 2;
  const hasEmail = Boolean(extractedCandidate.email);
  const hasPhone = /(?:\+212|0\s*[567])[\s.\-\d]{7,}/.test(rawCompact);
  const hasAddressWord = /\b(adresse|telephone|tel|e-?mail|courriel)\b/i.test(norm);
  const hasCoordonnees = hasEmail || hasPhone || hasAddressWord;

  // --- Classification du type le plus probable ---
  const scores: Array<{ type: TypePieceObligatoire; score: number }> = [
    {
      type: "Carte d'identité nationale (CIN)",
      score:
        (hasMentionCnie ? 4 : 0) +
        (detectedCinNumber ? 2 : 0) +
        (hasRecto && hasVerso ? 2 : 0) +
        (pageCount >= 2 && hasMentionCnie ? 1 : 0)
    },
    {
      type: 'Attestation de réussite de Licence',
      score:
        (hasAttestationReussite ? 4 : 0) +
        (hasMentionLicence ? 3 : 0) +
        (hasEtablissement ? 1 : 0) +
        (hasCne ? 1 : 0)
    },
    {
      type: 'Relevés de notes Master (S1-S4)',
      score:
        (hasMentionReleveNotes ? 5 : 0) +
        (hasSemestreS1 ? 1 : 0) +
        (hasSemestreS2 ? 1 : 0) +
        (hasSemestreS3 ? 1 : 0) +
        (hasSemestreS4 ? 1 : 0) +
        (hasNotesOuMoyennes ? 2 : 0)
    },
    {
      type: 'Diplôme de Master / Ingénieur',
      score:
        (/\bdiplome\b/i.test(norm) && hasMentionMasterOuIngenieur ? 5 : 0) +
        (hasMentionMasterOuIngenieur && !hasMentionReleveNotes && !hasRubriquesCv ? 2 : 0) +
        (hasIntituleFiliere ? 1 : 0)
    },
    {
      type: 'Projet de recherche rédigé',
      score:
        (hasProjetKeywords ? 4 : 0) +
        (hasObjectifsOuProblematique ? 2 : 0) +
        (hasMethodologie ? 2 : 0) +
        (hasTitreProjetRecherche ? 1 : 0)
    },
    {
      type: 'Curriculum Vitae détaillé',
      score:
        (/curriculum\s+vitae/i.test(norm) ? 4 : 0) +
        cvRubriquesCount * 2 +
        (hasCoordonnees ? 2 : 0) -
        (hasProjetKeywords ? 3 : 0) -
        (hasMentionReleveNotes ? 3 : 0) -
        (hasAttestationReussite ? 3 : 0)
    }
  ];

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  const detectedType: TypePieceObligatoire | 'AUTRE' = best && best.score >= 4 ? best.type : 'AUTRE';

  return {
    detectedType,
    hasMentionCnie,
    detectedCinNumber,
    hasNomEtPrenom,
    hasDateNaissance,
    hasDateValidite,
    hasRectoEtVerso,
    hasMentionLicence,
    hasAttestationReussite,
    hasEtablissement,
    hasAnnee,
    hasNom,
    hasCne,
    hasMentionMasterOuIngenieur,
    hasIntituleFiliere,
    hasMentionReleveNotes,
    hasSemestreS1,
    hasSemestreS2,
    hasSemestreS3,
    hasSemestreS4,
    hasNotesOuMoyennes,
    hasTitreProjetRecherche,
    hasObjectifsOuProblematique,
    hasMethodologie,
    hasRubriquesCv,
    hasCoordonnees,
    isScanIllisible: false,
    isTypeIncertain: detectedType === 'AUTRE',
    extractedCandidate
  };
}

/**
 * Étape 1 : Vérification stricte des éléments exigés pour le type attendu.
 */
function evaluateStep1(
  expectedType: TypePieceObligatoire,
  pageCount: number,
  analysis: StructuredDocAnalysis,
  candidateHasCne: boolean
): { missingElements: string[]; wrongTypeDetected: boolean } {
  const missingElements: string[] = [];

  switch (expectedType) {
    case "Carte d'identité nationale (CIN)": {
      if (!analysis.hasMentionCnie) missingElements.push("mention de carte nationale d'identité");
      const validCin = Boolean(
        analysis.detectedCinNumber &&
          /^[A-Z]{1,2}\d{5,6}$/i.test(analysis.detectedCinNumber.replace(/\s+/g, ''))
      );
      if (!validCin) missingElements.push('numéro CIN (1 ou 2 lettres + 5 à 6 chiffres)');
      if (!analysis.hasNomEtPrenom) missingElements.push('nom et prénom');
      if (!analysis.hasDateNaissance) missingElements.push('date de naissance');
      if (!analysis.hasDateValidite) missingElements.push('date de validité');
      if (pageCount < 2 || !analysis.hasRectoEtVerso) missingElements.push('2 pages (recto/verso)');
      break;
    }

    case 'Attestation de réussite de Licence': {
      if (!analysis.hasMentionLicence) missingElements.push('mention « Licence »');
      if (!analysis.hasAttestationReussite) missingElements.push('mention « attestation de réussite »');
      if (!analysis.hasEtablissement) missingElements.push('établissement');
      if (!analysis.hasAnnee) missingElements.push('année');
      if (!analysis.hasNom) missingElements.push('nom');
      if (candidateHasCne && !analysis.hasCne) missingElements.push('CNE');
      break;
    }

    case 'Diplôme de Master / Ingénieur': {
      if (!analysis.hasMentionMasterOuIngenieur) missingElements.push('mention « Master » ou « Ingénieur »');
      if (!analysis.hasIntituleFiliere) missingElements.push('intitulé de la filière');
      if (!analysis.hasAnnee) missingElements.push('année');
      if (!analysis.hasNom) missingElements.push('nom');
      break;
    }

    case 'Relevés de notes Master (S1-S4)': {
      if (!analysis.hasMentionReleveNotes) missingElements.push('mention « relevé de notes »');
      const missingSemesters: string[] = [];
      if (!analysis.hasSemestreS1) missingSemesters.push('S1');
      if (!analysis.hasSemestreS2) missingSemesters.push('S2');
      if (!analysis.hasSemestreS3) missingSemesters.push('S3');
      if (!analysis.hasSemestreS4) missingSemesters.push('S4');
      if (missingSemesters.length > 0) {
        missingElements.push(`semestres manquants (${missingSemesters.join(', ')})`);
      }
      if (!analysis.hasNotesOuMoyennes) missingElements.push('notes ou moyennes');
      if (!analysis.hasNom) missingElements.push('nom');
      if (candidateHasCne && !analysis.hasCne) missingElements.push('CNE');
      break;
    }

    case 'Projet de recherche rédigé': {
      if (!analysis.hasTitreProjetRecherche) missingElements.push('titre du sujet choisi');
      if (!analysis.hasObjectifsOuProblematique) missingElements.push('objectifs ou problématique');
      if (!analysis.hasMethodologie) missingElements.push('méthodologie');
      if (!analysis.hasNom) missingElements.push('nom du candidat');
      break;
    }

    case 'Curriculum Vitae détaillé': {
      if (!analysis.hasRubriquesCv) {
        missingElements.push('rubriques de type formation, expériences ou compétences');
      }
      if (!analysis.hasCoordonnees) missingElements.push('coordonnées du candidat');
      break;
    }
  }

  const wrongTypeDetected =
    analysis.detectedType !== 'AUTRE' && analysis.detectedType !== expectedType;

  return { missingElements, wrongTypeDetected };
}

/**
 * Étape 2 : Compare les données extraites du document avec les informations personnelles du candidat.
 * Ne s'exécute que si l'Étape 1 est réussie.
 */
export function evaluateStep2CandidateComparison(
  expectedType: TypePieceObligatoire,
  extractedCandidate: ExtractedCandidateDocData,
  candidature: Candidature | undefined,
  options?: {
    isScanned?: boolean;
    engine?: 'PDFJS_TEXT' | 'GEMINI' | 'TESSERACT_FALLBACK';
    isScanIllisible?: boolean;
    isTypeIncertain?: boolean;
    rawText?: string;
  }
): { mismatches: string[]; uncertainties: string[] } {
  const mismatches: string[] = [];
  const uncertainties: string[] = [];
  const profile = buildCandidateReferenceProfile(candidature);
  const normFullText = normalizeCompareText(options?.rawText || '');

  const extNom = (extractedCandidate.nom || '').trim();
  const extPrenom = (extractedCandidate.prenom || '').trim();
  const extCin = (extractedCandidate.cin || '').replace(/\s+/g, '').toUpperCase();
  const extCne = (extractedCandidate.cne || '').replace(/\s+/g, '').toUpperCase();
  const extDateNaiss = (extractedCandidate.date_naissance || '').trim();
  const extLieuNaiss = (extractedCandidate.lieu_naissance || '').trim();
  const extFiliere = (extractedCandidate.filiere || '').trim();
  const extEmail = (extractedCandidate.email || '').trim().toLowerCase();
  const extTitreSujet = (extractedCandidate.titre_sujet || '').trim();

  if (options?.isScanIllisible) {
    uncertainties.push('La qualité du scan ou de la numérisation est insuffisante pour garantir une lecture fiable.');
  }
  if (options?.isTypeIncertain) {
    uncertainties.push('La classification automatique du type de document comporte une part d’incertitude.');
  }
  if (options?.engine === 'TESSERACT_FALLBACK') {
    uncertainties.push('Document scanné analysé par OCR local de secours : vérification manuelle requise.');
  }

  // 1. Comparaison Nom & Prénom (avec tolérance si le champ extrait combine « NOM Prénom »)
  if (profile.nom) {
    if (extNom) {
      const combinedMatches =
        namesMatch(`${extNom} ${extPrenom}`, `${profile.nom} ${profile.prenom}`) &&
        namesMatch(extNom, profile.prenom) &&
        namesMatch(extPrenom, profile.nom);
      if (!namesMatch(extNom, profile.nom) && !combinedMatches) {
        mismatches.push(
          `Le nom figurant sur le document (« ${extNom} ») ne correspond pas à celui du dossier (« ${profile.nom} »).`
        );
      }
    } else if (normFullText && !normFullText.includes(normalizeCompareText(profile.nom))) {
      uncertainties.push(
        `Le nom du candidat (« ${profile.nom} ») n'a pas pu être confirmé avec certitude dans le document.`
      );
    } else if (options?.isScanned) {
      uncertainties.push("Le nom de famille n'a pas pu être lu sur le document scanné.");
    }
  }

  if (profile.prenom) {
    if (extPrenom) {
      const combinedMatches =
        namesMatch(`${extNom} ${extPrenom}`, `${profile.nom} ${profile.prenom}`) &&
        namesMatch(extNom, profile.prenom) &&
        namesMatch(extPrenom, profile.nom);
      if (!namesMatch(extPrenom, profile.prenom) && !combinedMatches) {
        mismatches.push(
          `Le prénom figurant sur le document (« ${extPrenom} ») ne correspond pas à celui du dossier (« ${profile.prenom} »).`
        );
      }
    } else if (normFullText && !normFullText.includes(normalizeCompareText(profile.prenom))) {
      uncertainties.push(
        `Le prénom du candidat (« ${profile.prenom} ») n'a pas pu être confirmé avec certitude dans le document.`
      );
    } else if (options?.isScanned && expectedType === "Carte d'identité nationale (CIN)") {
      uncertainties.push("Le prénom n'a pas pu être lu sur la carte scannée.");
    }
  }

  // 2. Comparaison CIN
  if (profile.cin) {
    if (extCin) {
      if (extCin !== profile.cin) {
        mismatches.push(
          `Le numéro CIN du document (« ${extCin} ») ne correspond pas à celui du dossier (« ${profile.cin} »).`
        );
      }
    } else if (expectedType === "Carte d'identité nationale (CIN)" && options?.isScanned) {
      uncertainties.push("Le numéro CIN n'a pas pu être lu clairement sur le scan.");
    }
  }

  // 3. Comparaison CNE (ignoré si le candidat n'a pas de CNE — autre établissement)
  if (profile.cne) {
    if (extCne) {
      if (extCne !== profile.cne) {
        mismatches.push(
          `Le CNE du document (« ${extCne} ») ne correspond pas à celui du dossier (« ${profile.cne} »).`
        );
      }
    } else if (
      (expectedType === 'Attestation de réussite de Licence' ||
        expectedType === 'Relevés de notes Master (S1-S4)') &&
      options?.isScanned
    ) {
      uncertainties.push("Le CNE / Code Massar n'a pas pu être lu clairement sur le scan.");
    }
  }

  // 4. Comparaison Date de naissance
  if (profile.date_naissance) {
    if (extDateNaiss) {
      const normDocDate = normalizeDateValue(extDateNaiss);
      const normDossierDate = normalizeDateValue(profile.date_naissance);
      if (normDocDate && normDossierDate && normDocDate !== normDossierDate) {
        mismatches.push(
          `La date de naissance du document (« ${extDateNaiss} ») ne correspond pas à celle du dossier (« ${profile.date_naissance} »).`
        );
      }
    } else if (expectedType === "Carte d'identité nationale (CIN)" && options?.isScanned) {
      uncertainties.push("La date de naissance n'a pas pu être lue clairement sur le scan de la CNIE.");
    }
  }

  // 5. Comparaison Lieu de naissance
  if (profile.lieu_naissance && extLieuNaiss) {
    if (!lieuMatches(extLieuNaiss, profile.lieu_naissance)) {
      mismatches.push(
        `Le lieu de naissance du document (« ${extLieuNaiss} ») ne correspond pas à celui du dossier (« ${profile.lieu_naissance} »).`
      );
    }
  }

  // 6. Comparaison Filière (Diplôme de Master / Ingénieur, Relevés Master S1-S4, et mention Master/Ingénieur sur CV)
  const shouldCheckFiliere =
    expectedType === 'Diplôme de Master / Ingénieur' ||
    expectedType === 'Relevés de notes Master (S1-S4)' ||
    (expectedType === 'Curriculum Vitae détaillé' &&
      /\b(master|mastere|ingenieur)\b/i.test(normalizeText(extFiliere)));

  if (profile.filiere && extFiliere && shouldCheckFiliere) {
    if (!filiereMatches(extFiliere, profile.filiere)) {
      mismatches.push(
        `La filière figurant sur le document (« ${extFiliere} ») ne correspond pas à celle du dossier (« ${profile.filiere} »).`
      );
    }
  }

  // 7. Comparaison E-mail
  if (profile.email && extEmail) {
    if (extEmail !== profile.email) {
      mismatches.push(
        `L'adresse e-mail figurant sur le document (« ${extEmail} ») ne correspond pas à celle du dossier (« ${profile.email} »).`
      );
    }
  }

  // 8. Comparaison Titre du sujet choisi (Projet de recherche rédigé)
  if (expectedType === 'Projet de recherche rédigé' && profile.sujetsTitres.length > 0) {
    if (extTitreSujet) {
      if (!sujetMatchesAny(extTitreSujet, profile.sujetsTitres)) {
        mismatches.push(
          `Le titre du sujet du projet (« ${extTitreSujet} ») ne correspond pas aux sujets choisis dans votre dossier.`
        );
      }
    } else if (options?.rawText) {
      if (!sujetMatchesAny(options.rawText, profile.sujetsTitres)) {
        uncertainties.push(
          "Le titre exact du sujet choisi n'a pas pu être confirmé automatiquement dans le projet de recherche."
        );
      }
    } else {
      uncertainties.push(
        "Le titre du sujet n'a pas pu être extrait du projet de recherche pour vérification."
      );
    }
  }

  return { mismatches, uncertainties };
}

/**
 * Évaluation complète Étape 1 + Étape 2 produisant l'un des 3 résultats officiels :
 * - CONFORME (vert)
 * - A_CORRIGER (rouge) avec motif précis
 * - A_VERIFIER (orange) en cas de doute (scan illisible, type incertain) — jamais Conforme en cas de doute
 */
export function evaluateStructuredAnalysis(
  expectedType: TypePieceObligatoire,
  pageCount: number,
  analysis: StructuredDocAnalysis,
  engine: 'PDFJS_TEXT' | 'GEMINI' | 'TESSERACT_FALLBACK',
  candidature?: Candidature,
  options?: { isScanned?: boolean; rawText?: string }
): DocumentVerificationResult {
  const profile = buildCandidateReferenceProfile(candidature);
  const candidateHasCne = Boolean(profile.cne);
  const extractedCandidate: ExtractedCandidateDocData = {
    ...EMPTY_CANDIDATE_DATA,
    ...(analysis.extractedCandidate || {}),
    cin: (analysis.extractedCandidate?.cin || analysis.detectedCinNumber || '')
      .replace(/\s+/g, '')
      .toUpperCase()
  };

  // --- ÉTAPE 1 : LE DOCUMENT EST-IL DU BON TYPE ? ---
  const { missingElements, wrongTypeDetected } = evaluateStep1(
    expectedType,
    pageCount,
    analysis,
    candidateHasCne
  );

  // Cas particulier d'un scan illisible (doute sans contradiction de type manifeste)
  const structuralCinPageError = expectedType === "Carte d'identité nationale (CIN)" && pageCount < 2;
  const scanDoubtOnStep1 =
    Boolean(options?.isScanned || analysis.isScanIllisible) &&
    !wrongTypeDetected &&
    !structuralCinPageError &&
    Boolean(analysis.isScanIllisible || analysis.isTypeIncertain);

  if (wrongTypeDetected) {
    const baseRefusal = `Ce document n'est pas ${EXPECTED_TYPE_ARTICLE_LABELS[expectedType]}.`;
    const suggestion = RESEMBLANCE_MESSAGES[analysis.detectedType as TypePieceObligatoire];
    return {
      status: 'A_CORRIGER',
      valid: false,
      etape1Valid: false,
      etape2Valid: false,
      detectedType: analysis.detectedType,
      missingElements,
      mismatches: [],
      uncertainties: [],
      error: `${baseRefusal} ${suggestion}`,
      engine,
      extractedCandidate
    };
  }

  if (missingElements.length > 0 && scanDoubtOnStep1) {
    const motifDoute = `Document scanné difficilement lisible ou type incertain (éléments non confirmés : ${missingElements.join(
      ', '
    )}). Vérification manuelle requise.`;
    return {
      status: 'A_VERIFIER',
      valid: true,
      etape1Valid: false,
      etape2Valid: false,
      detectedType: analysis.detectedType,
      missingElements,
      mismatches: [],
      uncertainties: [motifDoute],
      error: motifDoute,
      engine,
      extractedCandidate
    };
  }

  if (missingElements.length > 0) {
    const baseRefusal = `Ce document n'est pas ${EXPECTED_TYPE_ARTICLE_LABELS[expectedType]}.`;
    return {
      status: 'A_CORRIGER',
      valid: false,
      etape1Valid: false,
      etape2Valid: false,
      detectedType: analysis.detectedType,
      missingElements,
      mismatches: [],
      uncertainties: [],
      error: `${baseRefusal} Éléments manquants : ${missingElements.join(', ')}.`,
      engine,
      extractedCandidate
    };
  }

  // --- ÉTAPE 2 : LE DOCUMENT CORRESPOND-IL AU CANDIDAT ? (seulement si Étape 1 réussie) ---
  const { mismatches, uncertainties } = evaluateStep2CandidateComparison(
    expectedType,
    extractedCandidate,
    candidature,
    {
      isScanned: options?.isScanned,
      engine,
      isScanIllisible: analysis.isScanIllisible,
      isTypeIncertain: analysis.isTypeIncertain,
      rawText: options?.rawText
    }
  );

  if (mismatches.length > 0) {
    return {
      status: 'A_CORRIGER',
      valid: false,
      etape1Valid: true,
      etape2Valid: false,
      detectedType: expectedType,
      missingElements: [],
      mismatches,
      uncertainties,
      error: mismatches.join(' '),
      engine,
      extractedCandidate
    };
  }

  if (uncertainties.length > 0 || analysis.isScanIllisible || analysis.isTypeIncertain) {
    const msg =
      uncertainties.length > 0
        ? uncertainties.join(' ')
        : 'Type de document ou lisibilité incertaine : vérification manuelle requise.';
    return {
      status: 'A_VERIFIER',
      valid: true,
      etape1Valid: true,
      etape2Valid: true,
      detectedType: expectedType,
      missingElements: [],
      mismatches: [],
      uncertainties: uncertainties.length > 0 ? uncertainties : [msg],
      error: msg,
      engine,
      extractedCandidate
    };
  }

  return {
    status: 'CONFORME',
    valid: true,
    etape1Valid: true,
    etape2Valid: true,
    detectedType: expectedType,
    missingElements: [],
    mismatches: [],
    uncertainties: [],
    engine,
    extractedCandidate
  };
}

export function toResultatControleConformite(res: DocumentVerificationResult): ResultatControleConformite {
  return {
    statut: res.status,
    motif: res.error,
    moteur: res.engine,
    date_controle: new Date().toISOString().split('T')[0],
    donnees_extraites: res.extractedCandidate,
    etape1_valide: res.etape1Valid,
    etape2_valide: res.etape2Valid,
    doute_detecte: res.status === 'A_VERIFIER',
    type_detecte: res.detectedType
  };
}

/**
 * Ré-évalue l'Étape 2 d'une pièce déjà analysée lorsque le candidat modifie ses informations personnelles
 * ou ses sujets choisis avant la soumission.
 */
export function reevaluateStoredComplianceAgainstProfile(
  expectedType: TypePieceObligatoire,
  existing: ResultatControleConformite,
  candidature: Candidature
): ResultatControleConformite {
  if (existing.etape1_valide === false || !existing.donnees_extraites) {
    return existing;
  }

  const { mismatches, uncertainties } = evaluateStep2CandidateComparison(
    expectedType,
    existing.donnees_extraites,
    candidature,
    {
      isScanned: existing.moteur === 'GEMINI' || existing.moteur === 'TESSERACT_FALLBACK',
      engine: existing.moteur || 'GEMINI',
      isScanIllisible: false,
      isTypeIncertain: false
    }
  );

  if (mismatches.length > 0) {
    return {
      ...existing,
      statut: 'A_CORRIGER',
      motif: mismatches.join(' '),
      etape2_valide: false,
      doute_detecte: false
    };
  }

  if (uncertainties.length > 0 || existing.doute_detecte) {
    return {
      ...existing,
      statut: 'A_VERIFIER',
      motif: uncertainties.length > 0 ? uncertainties.join(' ') : existing.motif,
      etape2_valide: true,
      doute_detecte: true
    };
  }

  return {
    ...existing,
    statut: 'CONFORME',
    motif: undefined,
    etape2_valide: true,
    doute_detecte: false
  };
}

/**
 * OCR local de secours avec Tesseract.js (fra + ara) sur les pages rendues si Gemini est indisponible.
 */
async function ocrRenderedPagesWithTesseract(pageImages: string[]): Promise<string> {
  if (pageImages.length === 0) return '';
  const worker = await createWorker(['fra', 'ara']);
  try {
    const chunks: string[] = [];
    for (const imgUrl of pageImages) {
      const res = await worker.recognize(imgUrl);
      if (res?.data?.text) {
        chunks.push(res.data.text);
      }
    }
    return chunks.join('\n');
  } finally {
    await worker.terminate();
  }
}

/**
 * Contrôle de conformité des pièces justificatives en 2 étapes :
 * - Étape 1 : le document est-il du bon type ?
 * - Étape 2 : si l'Étape 1 réussit, correspond-il au candidat ?
 * Note : Le nom du fichier n'est JAMAIS utilisé.
 */
export async function verifyUploadedPdfCompliance(params: {
  pdfBytes: Uint8Array;
  pageCount: number;
  expectedType: TypePieceObligatoire;
  candidature?: Candidature;
}): Promise<DocumentVerificationResult> {
  const { pdfBytes, expectedType, candidature } = params;

  // Étape 1A : Extraction du texte via pdf.js et détection de PDF scanné
  let extracted: PdfExtractionPayload;
  try {
    extracted = await extractPdfContentWithPdfJs(pdfBytes);
  } catch (err) {
    console.error('Erreur extraction pdf.js :', err);
    return {
      status: 'A_CORRIGER',
      valid: false,
      etape1Valid: false,
      etape2Valid: false,
      detectedType: 'AUTRE',
      missingElements: ['contenu PDF lisible'],
      mismatches: [],
      uncertainties: [],
      error: `Ce document n'est pas ${EXPECTED_TYPE_ARTICLE_LABELS[expectedType]}. Le contenu du fichier PDF est illisible.`,
      engine: 'PDFJS_TEXT',
      extractedCandidate: { ...EMPTY_CANDIDATE_DATA }
    };
  }

  const effectivePageCount = extracted.pageCount || params.pageCount;

  // Étape 1B : Analyse Gemini (lecture visuelle si scanné, ou confirmation sémantique + extraction Étape 2)
  try {
    const response = await fetch('/api/documents/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedType,
        pageCount: effectivePageCount,
        extractedText: extracted.fullText,
        pageImages: extracted.isScanned ? extracted.pageImages : undefined
      })
    });

    if (response.ok) {
      const payload = (await response.json()) as {
        engine: 'GEMINI';
        analysis: StructuredDocAnalysis;
      };

      if (payload?.analysis) {
        const merged: StructuredDocAnalysis = {
          ...payload.analysis,
          extractedCandidate: {
            ...EMPTY_CANDIDATE_DATA,
            ...(payload.analysis.extractedCandidate || {})
          }
        };

        // Garde-fous objectifs sur le texte extrait par pdf.js quand le PDF n'est pas un scan pur
        if (!extracted.isScanned && extracted.fullText) {
          const textHeuristic = analyzeTextHeuristically(
            extracted.fullText,
            effectivePageCount,
            extracted.pageTexts
          );
          if (expectedType === 'Relevés de notes Master (S1-S4)') {
            merged.hasSemestreS1 = merged.hasSemestreS1 && textHeuristic.hasSemestreS1;
            merged.hasSemestreS2 = merged.hasSemestreS2 && textHeuristic.hasSemestreS2;
            merged.hasSemestreS3 = merged.hasSemestreS3 && textHeuristic.hasSemestreS3;
            merged.hasSemestreS4 = merged.hasSemestreS4 && textHeuristic.hasSemestreS4;
          }
          if (expectedType === "Carte d'identité nationale (CIN)" && !merged.detectedCinNumber) {
            merged.detectedCinNumber = textHeuristic.detectedCinNumber;
          }

          // Compléter les champs vides si le texte pdf.js les contient clairement
          const he = textHeuristic.extractedCandidate;
          if (he && merged.extractedCandidate) {
            if (!merged.extractedCandidate.cin && he.cin) merged.extractedCandidate.cin = he.cin;
            if (!merged.extractedCandidate.cne && he.cne) merged.extractedCandidate.cne = he.cne;
            if (!merged.extractedCandidate.email && he.email) merged.extractedCandidate.email = he.email;
          }
        }

        if (expectedType === "Carte d'identité nationale (CIN)" && effectivePageCount < 2) {
          merged.hasRectoEtVerso = false;
        }

        return evaluateStructuredAnalysis(expectedType, effectivePageCount, merged, 'GEMINI', candidature, {
          isScanned: extracted.isScanned,
          rawText: extracted.fullText
        });
      }
    }
  } catch (err) {
    console.warn('Vérification Gemini indisponible, repli local :', err);
  }

  // Repli déterministe si Gemini indisponible :
  let combinedText = extracted.fullText;
  let engineUsed: 'PDFJS_TEXT' | 'TESSERACT_FALLBACK' = 'PDFJS_TEXT';

  if (extracted.isScanned && extracted.pageImages.length > 0) {
    try {
      const ocrText = await ocrRenderedPagesWithTesseract(extracted.pageImages);
      combinedText = `${extracted.fullText}\n${ocrText}`.trim();
      engineUsed = 'TESSERACT_FALLBACK';
    } catch (ocrErr) {
      console.warn('Échec OCR local Tesseract :', ocrErr);
    }
  }

  const localAnalysis = analyzeTextHeuristically(
    combinedText,
    effectivePageCount,
    extracted.pageTexts
  );

  if (extracted.isScanned && !localAnalysis.extractedCandidate?.cin && !localAnalysis.extractedCandidate?.nom) {
    localAnalysis.isScanIllisible = true;
  }

  return evaluateStructuredAnalysis(
    expectedType,
    effectivePageCount,
    localAnalysis,
    engineUsed,
    candidature,
    {
      isScanned: extracted.isScanned,
      rawText: combinedText
    }
  );
}

/**
 * Vérifie un PDF déjà rattaché depuis son URL ou Data URL.
 */
export async function verifyPdfUrlCompliance(params: {
  fichierUrl: string;
  pageCount?: number;
  expectedType: TypePieceObligatoire;
  candidature?: Candidature;
}): Promise<DocumentVerificationResult> {
  let pdfBytes: Uint8Array;
  if (params.fichierUrl.startsWith('data:')) {
    pdfBytes = decodePdfDataUrlToBytes(params.fichierUrl);
  } else {
    const resp = await fetch(params.fichierUrl);
    if (!resp.ok) {
      throw new Error(`Impossible de lire le fichier PDF (${resp.status}).`);
    }
    const buf = await resp.arrayBuffer();
    pdfBytes = new Uint8Array(buf);
  }

  return verifyUploadedPdfCompliance({
    pdfBytes,
    pageCount: params.pageCount || 1,
    expectedType: params.expectedType,
    candidature: params.candidature
  });
}

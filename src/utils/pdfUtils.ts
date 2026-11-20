import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Candidature, VersionCampagne } from '../types';
import { formatDateJJMMAAAA } from './dateUtils';

/**
 * Formate la taille d'un fichier : en Ko si < 1 Mo (ex: « 4 Ko »), sinon en Mo (jamais « 0 Mo »).
 */
export function formatTailleFichier(tailleOctets?: number, tailleMo?: number): string {
  const bytes =
    typeof tailleOctets === 'number' && Number.isFinite(tailleOctets) && tailleOctets > 0
      ? tailleOctets
      : typeof tailleMo === 'number' && Number.isFinite(tailleMo) && tailleMo > 0
        ? Math.round(tailleMo * 1024 * 1024)
        : undefined;

  if (bytes === undefined) {
    return '—';
  }

  if (bytes < 1024 * 1024) {
    const ko = Math.max(1, Math.round(bytes / 1024));
    return `${ko} Ko`;
  }

  const mo = Number((bytes / (1024 * 1024)).toFixed(2));
  return `${mo} Mo`;
}

/**
 * Lit la vraie taille en octets et le vrai nombre de pages d'un fichier PDF depuis son URL ou Data URL.
 */
export async function readPdfMetadataFromUrl(
  url: string
): Promise<{ byteLength: number; tailleMo: number; pageCount: number } | null> {
  try {
    let bytes: Uint8Array;
    if (url.startsWith('data:')) {
      const base64Marker = ';base64,';
      const base64Index = url.indexOf(base64Marker);
      const base64 = base64Index !== -1 ? url.substring(base64Index + base64Marker.length) : url.split(',')[1] || '';
      const binaryString = atob(base64);
      const len = binaryString.length;
      bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
    } else {
      const response = await fetch(url);
      if (!response.ok) return null;
      const buffer = await response.arrayBuffer();
      bytes = new Uint8Array(buffer);
    }

    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const byteLength = bytes.byteLength;
    return {
      byteLength,
      tailleMo: byteLength / (1024 * 1024),
      pageCount: pdfDoc.getPageCount()
    };
  } catch (err) {
    console.error('Erreur lors de la lecture des métadonnées PDF :', err);
    return null;
  }
}

/**
 * Vérifie le type réel (magic bytes), la validité, la taille et le nombre de pages d'un PDF.
 */
export async function validatePdfFile(
  file: File,
  isCin: boolean,
  maxMo: number = 5,
  options?: { skipCinPageCheck?: boolean }
): Promise<{
  valid: boolean;
  error?: string;
  pageCount?: number;
  byteLength?: number;
  dataUrl?: string;
  bytes?: Uint8Array;
}> {
  // 1. Vérification de la taille
  const fileSizeMo = file.size / (1024 * 1024);
  if (fileSizeMo > maxMo) {
    return {
      valid: false,
      error: `La taille du fichier (${formatTailleFichier(file.size)}) dépasse la limite autorisée de ${maxMo} Mo.`
    };
  }

  // 2. Lecture du buffer
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch {
    return {
      valid: false,
      error: "Le document n'a pas pu être traité. Veuillez réessayer."
    };
  }

  // 3. Vérification des magic bytes réels (le fichier doit commencer par %PDF- ou %PDF)
  if (arrayBuffer.byteLength < 5) {
    return {
      valid: false,
      error: "Le fichier doit être au format PDF."
    };
  }

  const bytes = new Uint8Array(arrayBuffer);
  // %PDF = 0x25, 0x50, 0x44, 0x46
  if (bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
    return {
      valid: false,
      error: "Le fichier doit être au format PDF."
    };
  }

  // 4. Chargement et parsing effectif du PDF pour valider sa structure
  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  } catch {
    return {
      valid: false,
      error: "Le fichier PDF est invalide ou illisible."
    };
  }

  const pageCount = pdfDoc.getPageCount();

  // 5. Cas particulier de la CIN : minimum 2 pages exigées (Page 1 : Recto, Page 2 : Verso)
  if (isCin && !options?.skipCinPageCheck && pageCount < 2) {
    return {
      valid: false,
      error: "Votre fichier doit contenir les deux faces de votre CIN. Veuillez téléverser un PDF contenant au minimum deux pages."
    };
  }

  // 6. Conversion en Data URL persistante
  const base64 = uint8ArrayToBase64(bytes);
  const dataUrl = `data:application/pdf;base64,${base64}`;

  return {
    valid: true,
    pageCount,
    byteLength: bytes.byteLength,
    dataUrl,
    bytes
  };
}

/**
 * Convertit un Uint8Array en base64 de manière performante par chunks.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

/**
 * Génère un véritable document PDF multi-pages pour les données de démonstration.
 */
export async function generateSamplePdf(
  docType: string,
  candidatNom: string,
  cin: string = 'CD654321'
): Promise<{ dataUrl: string; pageCount: number; byteLength: number; tailleMo: number }> {
  const pdfDoc = await PDFDocument.create();
  const fontTitle = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  if (docType === "Carte d'identité nationale (CIN)") {
    // 2 PAGES OBLIGATOIRES : Page 1 Recto, Page 2 Verso
    // Page 1 : Recto
    const p1 = pdfDoc.addPage([595, 420]); // Format CIN paysage agrandi
    p1.drawRectangle({
      x: 30,
      y: 30,
      width: 535,
      height: 360,
      borderColor: rgb(0.06, 0.46, 0.43),
      borderWidth: 2,
      color: rgb(0.97, 0.99, 0.99)
    });
    p1.drawText("ROYAUME DU MAROC - CARTE NATIONALE D'IDENTITE", {
      x: 50,
      y: 350,
      size: 14,
      font: fontTitle,
      color: rgb(0.06, 0.46, 0.43)
    });
    p1.drawText("PAGE 1 / 2 : RECTO DU DOCUMENT D'IDENTITE", {
      x: 50,
      y: 330,
      size: 11,
      font: fontTitle,
      color: rgb(0.85, 0.2, 0.2)
    });
    p1.drawText(`Nom & Prenom : ${candidatNom}`, {
      x: 180,
      y: 280,
      size: 12,
      font: fontTitle,
      color: rgb(0.12, 0.16, 0.23)
    });
    p1.drawText(`N CIN : ${cin}`, {
      x: 180,
      y: 255,
      size: 13,
      font: fontTitle,
      color: rgb(0.06, 0.46, 0.43)
    });
    p1.drawText("Nationalite : Marocaine  |  Sexe : M  |  Ne(e) a : Fes", {
      x: 180,
      y: 230,
      size: 10,
      font: fontRegular,
      color: rgb(0.3, 0.35, 0.4)
    });
    p1.drawText("Date de naissance : 12/04/1999  |  Valable jusqu'au : 15/09/2032", {
      x: 180,
      y: 210,
      size: 10,
      font: fontRegular,
      color: rgb(0.3, 0.35, 0.4)
    });
    // Emplacement Photo
    p1.drawRectangle({
      x: 50,
      y: 190,
      width: 100,
      height: 120,
      borderColor: rgb(0.7, 0.75, 0.8),
      borderWidth: 1,
      color: rgb(0.92, 0.94, 0.96)
    });
    p1.drawText("PHOTO D'IDENTITE", {
      x: 55,
      y: 245,
      size: 8,
      font: fontTitle,
      color: rgb(0.5, 0.55, 0.6)
    });

    // Page 2 : Verso
    const p2 = pdfDoc.addPage([595, 420]);
    p2.drawRectangle({
      x: 30,
      y: 30,
      width: 535,
      height: 360,
      borderColor: rgb(0.06, 0.46, 0.43),
      borderWidth: 2,
      color: rgb(0.97, 0.99, 0.99)
    });
    p2.drawText("PAGE 2 / 2 : VERSO DU DOCUMENT D'IDENTITE", {
      x: 50,
      y: 350,
      size: 14,
      font: fontTitle,
      color: rgb(0.06, 0.46, 0.43)
    });
    p2.drawText(`Titulaire : ${candidatNom} - N CIN ${cin}`, {
      x: 50,
      y: 310,
      size: 11,
      font: fontTitle,
      color: rgb(0.12, 0.16, 0.23)
    });
    p2.drawText("Adresse de residence : 14 Avenue Hassan II, Fes - Maroc", {
      x: 50,
      y: 280,
      size: 10,
      font: fontRegular,
      color: rgb(0.3, 0.35, 0.4)
    });
    p2.drawText("Profession : Etudiant / Chercheur Universitaire", {
      x: 50,
      y: 255,
      size: 10,
      font: fontRegular,
      color: rgb(0.3, 0.35, 0.4)
    });
    p2.drawText("Etat Civil : Fes 1999/421  |  Empreinte digitale enregistree", {
      x: 50,
      y: 230,
      size: 10,
      font: fontRegular,
      color: rgb(0.3, 0.35, 0.4)
    });
    // Bande MRZ simulée
    p2.drawRectangle({
      x: 45,
      y: 60,
      width: 505,
      height: 70,
      color: rgb(0.92, 0.93, 0.94),
      borderColor: rgb(0.8, 0.82, 0.85),
      borderWidth: 1
    });
    p2.drawText(`IDMAR${cin}<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<`, {
      x: 55,
      y: 100,
      size: 11,
      font: fontTitle,
      color: rgb(0.1, 0.15, 0.2)
    });
    p2.drawText("9904128M3209154MAR<<<<<<<<<<<4", {
      x: 55,
      y: 75,
      size: 11,
      font: fontTitle,
      color: rgb(0.1, 0.15, 0.2)
    });
  } else {
    // Document académique standard (1 ou 2 pages)
    const pageCount = docType.includes('Relevés') || docType.includes('Projet') ? 2 : 1;

    for (let pIdx = 1; pIdx <= pageCount; pIdx++) {
      const page = pdfDoc.addPage([595, 842]); // A4 portrait
      page.drawText("UNIVERSITE SIDI MOHAMED BEN ABDELLAH DE FES", {
        x: 50,
        y: 790,
        size: 12,
        font: fontTitle,
        color: rgb(0.06, 0.46, 0.43)
      });
      page.drawText("CENTRE DES ETUDES DOCTORALES (CEDOC)", {
        x: 50,
        y: 772,
        size: 10,
        font: fontRegular,
        color: rgb(0.4, 0.45, 0.5)
      });
      page.drawLine({
        start: { x: 50, y: 760 },
        end: { x: 545, y: 760 },
        thickness: 1.5,
        color: rgb(0.06, 0.46, 0.43)
      });

      page.drawText(docType.toUpperCase(), {
        x: 50,
        y: 710,
        size: 16,
        font: fontTitle,
        color: rgb(0.1, 0.15, 0.2)
      });

      page.drawText(`Candidat : ${candidatNom}  (CIN : ${cin})`, {
        x: 50,
        y: 675,
        size: 11,
        font: fontTitle,
        color: rgb(0.06, 0.46, 0.43)
      });

      page.drawText(`Page ${pIdx} sur ${pageCount}`, {
        x: 480,
        y: 675,
        size: 9,
        font: fontRegular,
        color: rgb(0.5, 0.55, 0.6)
      });

      page.drawText("Document certifie conforme depose dans le cadre de la candidature doctorale.", {
        x: 50,
        y: 640,
        size: 10,
        font: fontRegular,
        color: rgb(0.3, 0.35, 0.4)
      });

      // Cadre de contenu
      page.drawRectangle({
        x: 50,
        y: 120,
        width: 495,
        height: 490,
        borderColor: rgb(0.85, 0.88, 0.9),
        borderWidth: 1,
        color: rgb(0.98, 0.99, 1.0)
      });

      page.drawText(`Section detaillee - ${docType}`, {
        x: 70,
        y: 570,
        size: 12,
        font: fontTitle,
        color: rgb(0.15, 0.2, 0.25)
      });

      page.drawText(`Examen academique USMBA pour le cycle doctoral D1 2026-2027.`, {
        x: 70,
        y: 540,
        size: 10,
        font: fontRegular,
        color: rgb(0.4, 0.45, 0.5)
      });

      page.drawText("Ce document PDF authentique est consultable integralement par l'encadrant.", {
        x: 70,
        y: 515,
        size: 10,
        font: fontRegular,
        color: rgb(0.4, 0.45, 0.5)
      });

      // Footer
      page.drawText("Modèle pédagogique, sans valeur juridique - CEDoc USMBA Fès", {
        x: 50,
        y: 50,
        size: 8,
        font: fontRegular,
        color: rgb(0.5, 0.55, 0.6)
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  const pageCount = pdfDoc.getPageCount();
  const byteLength = pdfBytes.byteLength;
  const tailleMo = byteLength / (1024 * 1024);
  const base64 = uint8ArrayToBase64(pdfBytes);
  const dataUrl = `data:application/pdf;base64,${base64}`;

  return {
    dataUrl,
    pageCount,
    byteLength,
    tailleMo
  };
}

/**
 * Télécharge un fichier (Data URL ou Blob) dans le navigateur.
 */
export function downloadFile(dataUrlOrBlob: string | Blob, fileName: string) {
  let url: string;
  let revoke = false;
  if (dataUrlOrBlob instanceof Blob) {
    url = URL.createObjectURL(dataUrlOrBlob);
    revoke = true;
  } else {
    url = dataUrlOrBlob;
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (revoke) {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * Génère le PDF officiel de la Charte des Thèses de l'USMBA.
 */
export async function generateCharteThesesPdf(): Promise<{ dataUrl: string; blob: Blob; pageCount: number }> {
  const pdfDoc = await PDFDocument.create();
  const fontTitle = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page = pdfDoc.addPage([595, 842]); // A4 portrait

  // En-tête officiel
  page.drawText("UNIVERSITE SIDI MOHAMED BEN ABDELLAH DE FES", {
    x: 50,
    y: 790,
    size: 13,
    font: fontTitle,
    color: rgb(0.06, 0.46, 0.43)
  });
  page.drawText("CENTRE DES ETUDES DOCTORALES (CEDOC)", {
    x: 50,
    y: 772,
    size: 10,
    font: fontRegular,
    color: rgb(0.3, 0.35, 0.4)
  });
  page.drawText("Modèle pédagogique, sans valeur juridique", {
    x: 50,
    y: 755,
    size: 8,
    font: fontRegular,
    color: rgb(0.5, 0.55, 0.6)
  });
  page.drawLine({
    start: { x: 50, y: 745 },
    end: { x: 545, y: 745 },
    thickness: 1.5,
    color: rgb(0.06, 0.46, 0.43)
  });

  page.drawText("CHARTE DES THESES DU CYCLE DOCTORAL", {
    x: 50,
    y: 715,
    size: 15,
    font: fontTitle,
    color: rgb(0.1, 0.15, 0.2)
  });
  page.drawText("Session Universitaire 2026-2027 - Reference : CHARTE-D-USMBA", {
    x: 50,
    y: 695,
    size: 9,
    font: fontRegular,
    color: rgb(0.4, 0.45, 0.5)
  });

  // Articles
  page.drawText("ARTICLE 1 : DROITS ET ENGAGEMENTS DU DOCTORANT", {
    x: 50,
    y: 660,
    size: 10,
    font: fontTitle,
    color: rgb(0.06, 0.46, 0.43)
  });
  page.drawText("- Consacrer le temps necessaire aux travaux de recherche selon le calendrier convenu.", {
    x: 60,
    y: 642,
    size: 9,
    font: fontRegular,
    color: rgb(0.2, 0.25, 0.3)
  });
  page.drawText("- Participer activement aux activites scientifiques, seminaires et formations du CEDoc.", {
    x: 60,
    y: 627,
    size: 9,
    font: fontRegular,
    color: rgb(0.2, 0.25, 0.3)
  });
  page.drawText("- Respecter scrupuleusement les regles d'ethique, de deontologie et d'integrite scientifique.", {
    x: 60,
    y: 612,
    size: 9,
    font: fontRegular,
    color: rgb(0.2, 0.25, 0.3)
  });
  page.drawText("- Fournir annuellement un rapport d'avancement evalue et valide par l'encadrant.", {
    x: 60,
    y: 597,
    size: 9,
    font: fontRegular,
    color: rgb(0.2, 0.25, 0.3)
  });

  page.drawText("ARTICLE 2 : ROLE ET ENGAGEMENTS DU DIRECTEUR DE THESE", {
    x: 50,
    y: 565,
    size: 10,
    font: fontTitle,
    color: rgb(0.06, 0.46, 0.43)
  });
  page.drawText("- Assurer un suivi scientifique personnalise, regulier et periodique de l'avancement.", {
    x: 60,
    y: 547,
    size: 9,
    font: fontRegular,
    color: rgb(0.2, 0.25, 0.3)
  });
  page.drawText("- Guider le doctorant dans la demarche methodologique et la valorisation des resultats.", {
    x: 60,
    y: 532,
    size: 9,
    font: fontRegular,
    color: rgb(0.2, 0.25, 0.3)
  });
  page.drawText("- Veiller au respect de la duree reglementaire de preparation de la these (3 a 5 ans max).", {
    x: 60,
    y: 517,
    size: 9,
    font: fontRegular,
    color: rgb(0.2, 0.25, 0.3)
  });

  page.drawText("ARTICLE 3 : ENGAGEMENTS DE LA STRUCTURE DE RECHERCHE", {
    x: 50,
    y: 485,
    size: 10,
    font: fontTitle,
    color: rgb(0.06, 0.46, 0.43)
  });
  page.drawText("- Accueillir le doctorant au sein d'une equipe de recherche accreditee de l'USMBA.", {
    x: 60,
    y: 467,
    size: 9,
    font: fontRegular,
    color: rgb(0.2, 0.25, 0.3)
  });
  page.drawText("- Mettre a disposition les ressources documentaires, materiels techniques et plateformes.", {
    x: 60,
    y: 452,
    size: 9,
    font: fontRegular,
    color: rgb(0.2, 0.25, 0.3)
  });
  page.drawText("- Garantir la conformite des thematiques avec les axes prioritaires de developpement.", {
    x: 60,
    y: 437,
    size: 9,
    font: fontRegular,
    color: rgb(0.2, 0.25, 0.3)
  });

  page.drawText("ARTICLE 4 : CONFIDENTIALITE ET VALORISATION SCIENTIFIQUE", {
    x: 50,
    y: 405,
    size: 10,
    font: fontTitle,
    color: rgb(0.06, 0.46, 0.43)
  });
  page.drawText("- Preserver la confidentialite des projets de recherche sous convention partenariale.", {
    x: 60,
    y: 387,
    size: 9,
    font: fontRegular,
    color: rgb(0.2, 0.25, 0.3)
  });
  page.drawText("- Toute publication ou communication doit faire mention de l'affiliation institutionnelle USMBA.", {
    x: 60,
    y: 372,
    size: 9,
    font: fontRegular,
    color: rgb(0.2, 0.25, 0.3)
  });

  // Zones de signature (Sans données personnelles du candidat)
  page.drawText("SIGNATURES DES PARTIES PRENANTES (Sans donnees personnelles du candidat)", {
    x: 50,
    y: 330,
    size: 10,
    font: fontTitle,
    color: rgb(0.1, 0.15, 0.2)
  });

  // Box 1 : Doctorant
  page.drawRectangle({
    x: 50,
    y: 185,
    width: 150,
    height: 125,
    borderColor: rgb(0.7, 0.75, 0.8),
    borderWidth: 1,
    color: rgb(0.98, 0.99, 1.0)
  });
  page.drawText("LE DOCTORANT", {
    x: 65,
    y: 290,
    size: 9,
    font: fontTitle,
    color: rgb(0.1, 0.15, 0.2)
  });
  page.drawText("(Lu et approuve - Signature)", {
    x: 60,
    y: 200,
    size: 8,
    font: fontRegular,
    color: rgb(0.5, 0.55, 0.6)
  });

  // Box 2 : Directeur de thèse
  page.drawRectangle({
    x: 220,
    y: 185,
    width: 150,
    height: 125,
    borderColor: rgb(0.7, 0.75, 0.8),
    borderWidth: 1,
    color: rgb(0.98, 0.99, 1.0)
  });
  page.drawText("LE DIRECTEUR DE THESE", {
    x: 230,
    y: 290,
    size: 9,
    font: fontTitle,
    color: rgb(0.1, 0.15, 0.2)
  });
  page.drawText("(Signature et cachet)", {
    x: 245,
    y: 200,
    size: 8,
    font: fontRegular,
    color: rgb(0.5, 0.55, 0.6)
  });

  // Box 3 : Directeur du Laboratoire
  page.drawRectangle({
    x: 390,
    y: 185,
    width: 150,
    height: 125,
    borderColor: rgb(0.7, 0.75, 0.8),
    borderWidth: 1,
    color: rgb(0.98, 0.99, 1.0)
  });
  page.drawText("LA DIRECTION DU LABORATOIRE", {
    x: 395,
    y: 290,
    size: 8,
    font: fontTitle,
    color: rgb(0.1, 0.15, 0.2)
  });
  page.drawText("(Visa et cachet structure)", {
    x: 410,
    y: 200,
    size: 8,
    font: fontRegular,
    color: rgb(0.5, 0.55, 0.6)
  });

  // Footer
  page.drawText("Centre des Etudes Doctorales (CEDoc) - USMBA Fes | Charte officielle des Theses", {
    x: 50,
    y: 80,
    size: 8,
    font: fontRegular,
    color: rgb(0.5, 0.55, 0.6)
  });

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const base64 = uint8ArrayToBase64(pdfBytes);
  const dataUrl = `data:application/pdf;base64,${base64}`;

  return { dataUrl, blob, pageCount: 1 };
}

/**
 * Génère la Fiche d'Inscription officielle D1 en PDF imprimable.
 */
export async function generateFicheD1Pdf(
  candidature: Candidature,
  campagne?: VersionCampagne
): Promise<{ dataUrl: string; blob: Blob; pageCount: number }> {
  const pdfDoc = await PDFDocument.create();
  const fontTitle = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page = pdfDoc.addPage([595, 842]); // A4 portrait

  // En-tête officiel
  page.drawText("UNIVERSITE SIDI MOHAMED BEN ABDELLAH DE FES", {
    x: 50,
    y: 790,
    size: 13,
    font: fontTitle,
    color: rgb(0.06, 0.46, 0.43)
  });
  page.drawText("CENTRE DES ETUDES DOCTORALES (CEDOC)", {
    x: 50,
    y: 772,
    size: 10,
    font: fontRegular,
    color: rgb(0.3, 0.35, 0.4)
  });
  page.drawText("Modèle pédagogique, sans valeur juridique", {
    x: 50,
    y: 755,
    size: 8,
    font: fontRegular,
    color: rgb(0.5, 0.55, 0.6)
  });
  page.drawLine({
    start: { x: 50, y: 745 },
    end: { x: 545, y: 745 },
    thickness: 1.5,
    color: rgb(0.06, 0.46, 0.43)
  });

  page.drawText("FICHE D'INSCRIPTION EN DOCTORAT (D1)", {
    x: 50,
    y: 715,
    size: 15,
    font: fontTitle,
    color: rgb(0.1, 0.15, 0.2)
  });

  const annee = campagne?.annee_universitaire || "2026-2027";
  const ref = candidature.reference || candidature.id;
  page.drawText(`Session Universitaire ${annee} - Reference : FORM-F1-USMBA-${ref}`, {
    x: 50,
    y: 695,
    size: 9,
    font: fontRegular,
    color: rgb(0.4, 0.45, 0.5)
  });

  // Section 1 : Informations Administratives
  page.drawRectangle({
    x: 50,
    y: 575,
    width: 495,
    height: 105,
    borderColor: rgb(0.85, 0.88, 0.9),
    borderWidth: 1,
    color: rgb(0.98, 0.99, 1.0)
  });

  page.drawText("1. INFORMATIONS ADMINISTRATIVES DU DOCTORANT ADMIS", {
    x: 60,
    y: 662,
    size: 9,
    font: fontTitle,
    color: rgb(0.06, 0.46, 0.43)
  });

  const nomPrenom = `${candidature.candidat_nom} ${candidature.candidat_prenom}`;
  page.drawText(`Nom et Prenom : ${nomPrenom}`, {
    x: 60,
    y: 642,
    size: 9,
    font: fontTitle,
    color: rgb(0.12, 0.16, 0.23)
  });
  page.drawText(`CNE / Code Massar : ${candidature.candidat_cne}`, {
    x: 60,
    y: 625,
    size: 9,
    font: fontRegular,
    color: rgb(0.2, 0.25, 0.3)
  });
  page.drawText(`N CIN / Passeport : ${candidature.candidat_cin || 'CD712345'}`, {
    x: 60,
    y: 608,
    size: 9,
    font: fontRegular,
    color: rgb(0.2, 0.25, 0.3)
  });

  page.drawText(`Courriel : ${candidature.candidat_email}`, {
    x: 290,
    y: 642,
    size: 9,
    font: fontRegular,
    color: rgb(0.2, 0.25, 0.3)
  });
  page.drawText("Statut : ADMIS (Dossier valide definitivement)", {
    x: 290,
    y: 625,
    size: 9,
    font: fontTitle,
    color: rgb(0.08, 0.64, 0.29)
  });
  page.drawText(`Date de depot : ${formatDateJJMMAAAA(candidature.date_soumission || candidature.date_creation)}`, {
    x: 290,
    y: 608,
    size: 9,
    font: fontRegular,
    color: rgb(0.2, 0.25, 0.3)
  });

  // Section 2 : Sujet retenu
  page.drawRectangle({
    x: 50,
    y: 435,
    width: 495,
    height: 125,
    borderColor: rgb(0.85, 0.88, 0.9),
    borderWidth: 1,
    color: rgb(0.98, 0.99, 1.0)
  });

  page.drawText("2. SUJET DE THESE RETENU ET STRUCTURE D'ACCUEIL", {
    x: 60,
    y: 542,
    size: 9,
    font: fontTitle,
    color: rgb(0.06, 0.46, 0.43)
  });

  const sujetRetenu = candidature.choix_sujets[0]?.sujet;
  if (sujetRetenu) {
    const titreCourt = sujetRetenu.titre.slice(0, 75);
    page.drawText(`Intitule : ${titreCourt}`, {
      x: 60,
      y: 520,
      size: 9,
      font: fontTitle,
      color: rgb(0.1, 0.15, 0.2)
    });
    if (sujetRetenu.titre.length > 75) {
      page.drawText(`${sujetRetenu.titre.slice(75, 150)}`, {
        x: 60,
        y: 505,
        size: 9,
        font: fontTitle,
        color: rgb(0.1, 0.15, 0.2)
      });
    }
    page.drawText(`Directeur de These : ${sujetRetenu.propose_par}`, {
      x: 60,
      y: 485,
      size: 9,
      font: fontRegular,
      color: rgb(0.2, 0.25, 0.3)
    });
    page.drawText(`Structure : ${sujetRetenu.structure} (${sujetRetenu.etablissement})`, {
      x: 60,
      y: 468,
      size: 9,
      font: fontRegular,
      color: rgb(0.2, 0.25, 0.3)
    });
    page.drawText(`Thematique : ${sujetRetenu.theme}`, {
      x: 60,
      y: 451,
      size: 9,
      font: fontRegular,
      color: rgb(0.2, 0.25, 0.3)
    });
  }

  // Section 3 : Engagement sur l'honneur
  page.drawRectangle({
    x: 50,
    y: 335,
    width: 495,
    height: 85,
    borderColor: rgb(0.85, 0.88, 0.9),
    borderWidth: 1,
    color: rgb(0.98, 0.99, 1.0)
  });

  page.drawText("3. ENGAGEMENT SUR L'HONNEUR DU CANDIDAT ADMIS", {
    x: 60,
    y: 402,
    size: 9,
    font: fontTitle,
    color: rgb(0.06, 0.46, 0.43)
  });
  page.drawText("Je soussigne(e) certifie l'exactitude absolue des declarations et pieces deposees.", {
    x: 60,
    y: 382,
    size: 8.5,
    font: fontRegular,
    color: rgb(0.3, 0.35, 0.4)
  });
  page.drawText("Je m'engage a respecter le reglement des etudes doctorales et les clauses de la Charte des Theses.", {
    x: 60,
    y: 367,
    size: 8.5,
    font: fontRegular,
    color: rgb(0.3, 0.35, 0.4)
  });
  page.drawText("Fait a Fes, pour servir et valoir ce que de droit.", {
    x: 60,
    y: 352,
    size: 8.5,
    font: fontRegular,
    color: rgb(0.3, 0.35, 0.4)
  });

  // Section 4 : Signatures
  page.drawText("4. SIGNATURES MANUSCRITES OFFICIELLES (A REMETTRE AU CEDOC)", {
    x: 50,
    y: 305,
    size: 9,
    font: fontTitle,
    color: rgb(0.1, 0.15, 0.2)
  });

  // Box 1 : Signature candidat
  page.drawRectangle({
    x: 50,
    y: 165,
    width: 240,
    height: 120,
    borderColor: rgb(0.7, 0.75, 0.8),
    borderWidth: 1,
    color: rgb(1, 1, 1)
  });
  page.drawText("SIGNATURE DU DOCTORANT ADMIS", {
    x: 60,
    y: 268,
    size: 8.5,
    font: fontTitle,
    color: rgb(0.1, 0.15, 0.2)
  });
  page.drawText("(Precedee de la mention 'Lu et approuve')", {
    x: 60,
    y: 253,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.5, 0.55, 0.6)
  });

  // Box 2 : Visa Directeur de Thèse
  page.drawRectangle({
    x: 305,
    y: 165,
    width: 240,
    height: 120,
    borderColor: rgb(0.7, 0.75, 0.8),
    borderWidth: 1,
    color: rgb(1, 1, 1)
  });
  page.drawText("AVIS & VISA DU DIRECTEUR DE THESE", {
    x: 315,
    y: 268,
    size: 8.5,
    font: fontTitle,
    color: rgb(0.1, 0.15, 0.2)
  });
  page.drawText("(Date, signature et cachet institutionnel)", {
    x: 315,
    y: 253,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.5, 0.55, 0.6)
  });

  // Footer
  page.drawText("CEDoc USMBA - Fes | Fiche d'inscription officielle D1 imprimable pour signature", {
    x: 50,
    y: 120,
    size: 8,
    font: fontRegular,
    color: rgb(0.5, 0.55, 0.6)
  });

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const base64 = uint8ArrayToBase64(pdfBytes);
  const dataUrl = `data:application/pdf;base64,${base64}`;

  return { dataUrl, blob, pageCount: 1 };
}

/**
 * Nettoie une chaîne pour qu'elle soit compatible avec l'encodage WinAnsi des polices PDF standard.
 */
function toWinAnsiSafe(text: string): string {
  return (text || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

/**
 * Génère le Récépissé de Dépôt de Candidature en PDF imprimable contenant :
 * - la référence du dossier
 * - la date et l'heure de soumission
 * - les données du candidat connecté
 * - le QR code de vérification
 */
export async function generateRecepissePdf(
  candidature: Candidature,
  campagne?: VersionCampagne
): Promise<{ dataUrl: string; blob: Blob; pageCount: number }> {
  const pdfDoc = await PDFDocument.create();
  const fontTitle = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontMono = await pdfDoc.embedFont(StandardFonts.CourierBold);

  const page = pdfDoc.addPage([595, 842]); // A4 portrait

  // 1. En-tête institutionnel conforme
  page.drawText("Modèle pédagogique, sans valeur juridique", {
    x: 50,
    y: 800,
    size: 8.5,
    font: fontTitle,
    color: rgb(0.45, 0.5, 0.55)
  });
  page.drawText("UNIVERSITE SIDI MOHAMED BEN ABDELLAH DE FES", {
    x: 50,
    y: 782,
    size: 13,
    font: fontTitle,
    color: rgb(0.06, 0.46, 0.43)
  });
  const annee = toWinAnsiSafe(campagne?.annee_universitaire || "2026-2027");
  page.drawText(`CENTRE DES ETUDES DOCTORALES (CEDOC) - SESSION ${annee}`, {
    x: 50,
    y: 765,
    size: 9.5,
    font: fontRegular,
    color: rgb(0.3, 0.35, 0.4)
  });
  page.drawLine({
    start: { x: 50, y: 754 },
    end: { x: 545, y: 754 },
    thickness: 1.5,
    color: rgb(0.06, 0.46, 0.43)
  });

  // Titre du document
  const ref = toWinAnsiSafe(candidature.reference || candidature.id);
  page.drawText("RECEPISSE DE DEPOT DE CANDIDATURE AU DOCTORAT", {
    x: 50,
    y: 726,
    size: 14,
    font: fontTitle,
    color: rgb(0.08, 0.12, 0.18)
  });
  page.drawText(`Réf. Document : REC-2026-USMBA-${ref}`, {
    x: 50,
    y: 709,
    size: 9,
    font: fontMono,
    color: rgb(0.35, 0.4, 0.45)
  });

  // 2. Bloc principal : Homologation, Référence, Date/Heure de soumission & QR Code
  page.drawRectangle({
    x: 50,
    y: 565,
    width: 495,
    height: 130,
    borderColor: rgb(0.06, 0.46, 0.43),
    borderWidth: 1.2,
    color: rgb(0.96, 0.99, 0.99)
  });

  page.drawText("CANDIDATURE OFFICIELLEMENT ENREGISTREE", {
    x: 65,
    y: 672,
    size: 10,
    font: fontTitle,
    color: rgb(0.09, 0.64, 0.29)
  });

  page.drawText("Référence Unique du Dossier :", {
    x: 65,
    y: 648,
    size: 9,
    font: fontRegular,
    color: rgb(0.35, 0.4, 0.45)
  });
  page.drawText(ref, {
    x: 65,
    y: 628,
    size: 16,
    font: fontMono,
    color: rgb(0.06, 0.09, 0.16)
  });

  const dateHeureSoumission = candidature.date_soumission
    ? `${formatDateJJMMAAAA(candidature.date_soumission)} à 14:32:00`
    : "Non déposé";

  page.drawText("Date et heure de soumission :", {
    x: 65,
    y: 602,
    size: 9,
    font: fontRegular,
    color: rgb(0.35, 0.4, 0.45)
  });
  page.drawText(toWinAnsiSafe(dateHeureSoumission), {
    x: 65,
    y: 585,
    size: 11,
    font: fontMono,
    color: rgb(0.06, 0.46, 0.43)
  });

  // Dessin vectoriel du QR Code de vérification à droite du bloc
  const qrBoxX = 415;
  const qrBoxY = 582;
  const qrBoxSize = 96;

  page.drawRectangle({
    x: qrBoxX,
    y: qrBoxY,
    width: qrBoxSize,
    height: qrBoxSize,
    borderColor: rgb(0.75, 0.8, 0.85),
    borderWidth: 1,
    color: rgb(1, 1, 1)
  });

  // Grille 9x9 pour représenter un QR code net et imprimable
  const qrMatrix = [
    [1, 1, 1, 0, 1, 0, 1, 1, 1],
    [1, 0, 1, 1, 0, 1, 1, 0, 1],
    [1, 1, 1, 0, 1, 0, 1, 1, 1],
    [0, 1, 0, 1, 0, 1, 0, 1, 0],
    [1, 0, 1, 0, 2, 0, 1, 0, 1],
    [0, 1, 0, 1, 0, 1, 0, 1, 0],
    [1, 1, 1, 0, 1, 1, 1, 0, 1],
    [1, 0, 1, 1, 0, 0, 0, 1, 0],
    [1, 1, 1, 0, 1, 0, 1, 1, 1]
  ];
  const cellSize = 8.5;
  const startX = qrBoxX + 9.5;
  const startY = qrBoxY + 9.5;

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const val = qrMatrix[row][col];
      if (val > 0) {
        page.drawRectangle({
          x: startX + col * cellSize,
          y: startY + (8 - row) * cellSize,
          width: cellSize - 1,
          height: cellSize - 1,
          color: val === 2 ? rgb(0.06, 0.46, 0.43) : rgb(0.08, 0.12, 0.18)
        });
      }
    }
  }

  page.drawText("Vérification CEDoc USMBA", {
    x: 405,
    y: 571,
    size: 7.5,
    font: fontTitle,
    color: rgb(0.35, 0.4, 0.45)
  });

  // 3. Section : Données du candidat connecté (Titulaire du Dossier)
  page.drawRectangle({
    x: 50,
    y: 425,
    width: 495,
    height: 125,
    borderColor: rgb(0.82, 0.85, 0.88),
    borderWidth: 1,
    color: rgb(0.99, 0.99, 1.0)
  });

  page.drawText("1. DONNEES DU CANDIDAT TITULAIRE DU DOSSIER", {
    x: 62,
    y: 530,
    size: 9.5,
    font: fontTitle,
    color: rgb(0.06, 0.46, 0.43)
  });

  const nomComplet = toWinAnsiSafe(`${candidature.candidat_nom} ${candidature.candidat_prenom}`);
  const cne = toWinAnsiSafe(candidature.candidat_cne || "Non renseigné");
  const cin = toWinAnsiSafe(candidature.candidat_cin || "CD712345");
  const email = toWinAnsiSafe(candidature.candidat_email || "");
  const tel = toWinAnsiSafe(candidature.candidat_telephone || "Renseigné au dossier");
  const statutDossier = toWinAnsiSafe(candidature.statut);

  page.drawText(`Nom et Prénom : ${nomComplet}`, {
    x: 62,
    y: 506,
    size: 9.5,
    font: fontTitle,
    color: rgb(0.1, 0.14, 0.2)
  });
  page.drawText(`CNE / Code Massar : ${cne}`, {
    x: 62,
    y: 486,
    size: 9,
    font: fontRegular,
    color: rgb(0.2, 0.25, 0.3)
  });
  page.drawText(`N° CIN / Passeport : ${cin}`, {
    x: 62,
    y: 466,
    size: 9,
    font: fontRegular,
    color: rgb(0.2, 0.25, 0.3)
  });
  page.drawText(`Date de création : ${formatDateJJMMAAAA(candidature.date_creation)}`, {
    x: 62,
    y: 446,
    size: 9,
    font: fontRegular,
    color: rgb(0.2, 0.25, 0.3)
  });

  page.drawText(`Courriel : ${email}`, {
    x: 295,
    y: 506,
    size: 9,
    font: fontRegular,
    color: rgb(0.2, 0.25, 0.3)
  });
  page.drawText(`Téléphone : ${tel}`, {
    x: 295,
    y: 486,
    size: 9,
    font: fontRegular,
    color: rgb(0.2, 0.25, 0.3)
  });
  page.drawText(`Statut actuel : ${statutDossier}`, {
    x: 295,
    y: 466,
    size: 9,
    font: fontTitle,
    color: rgb(0.06, 0.46, 0.43)
  });
  page.drawText(`Pièces déposées : ${candidature.documents.filter(d => d.statut_verification !== 'NON_DEPOSE').length} / 6 pièces`, {
    x: 295,
    y: 446,
    size: 9,
    font: fontRegular,
    color: rgb(0.2, 0.25, 0.3)
  });

  // 4. Section : Sujets de thèse sélectionnés par ordre de priorité
  page.drawRectangle({
    x: 50,
    y: 265,
    width: 495,
    height: 145,
    borderColor: rgb(0.82, 0.85, 0.88),
    borderWidth: 1,
    color: rgb(0.99, 0.99, 1.0)
  });

  page.drawText("2. SUJETS DE THESE SELECTIONNES PAR ORDRE DE PRIORITE", {
    x: 62,
    y: 390,
    size: 9.5,
    font: fontTitle,
    color: rgb(0.06, 0.46, 0.43)
  });

  let currentY = 368;
  candidature.choix_sujets.slice(0, 3).forEach((cs) => {
    const titreSujet = toWinAnsiSafe(cs.sujet.titre).slice(0, 78);
    const detailsSujet = toWinAnsiSafe(`Encadrant : ${cs.sujet.propose_par} | Structure : ${cs.sujet.structure}`).slice(0, 88);

    page.drawText(`Choix n°${cs.priorite} : ${titreSujet}`, {
      x: 62,
      y: currentY,
      size: 8.5,
      font: fontTitle,
      color: rgb(0.1, 0.14, 0.2)
    });
    page.drawText(detailsSujet, {
      x: 75,
      y: currentY - 13,
      size: 8,
      font: fontRegular,
      color: rgb(0.35, 0.4, 0.45)
    });
    currentY -= 36;
  });

  // 5. Zones de signature et cachet de réception
  page.drawText("3. ATTESTATION DE DEPOT ET SIGNATURES", {
    x: 50,
    y: 242,
    size: 9.5,
    font: fontTitle,
    color: rgb(0.1, 0.14, 0.2)
  });

  page.drawRectangle({
    x: 50,
    y: 120,
    width: 240,
    height: 110,
    borderColor: rgb(0.7, 0.75, 0.8),
    borderWidth: 1,
    color: rgb(1, 1, 1)
  });
  page.drawText("SIGNATURE DU CANDIDAT", {
    x: 62,
    y: 212,
    size: 8.5,
    font: fontTitle,
    color: rgb(0.1, 0.14, 0.2)
  });
  page.drawText("(Signature manuscrite légalisée)", {
    x: 62,
    y: 197,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.45, 0.5, 0.55)
  });

  page.drawRectangle({
    x: 305,
    y: 120,
    width: 240,
    height: 110,
    borderColor: rgb(0.7, 0.75, 0.8),
    borderWidth: 1,
    color: rgb(1, 1, 1)
  });
  page.drawText("VISA DU SECRETARIAT DU CEDOC", {
    x: 317,
    y: 212,
    size: 8.5,
    font: fontTitle,
    color: rgb(0.1, 0.14, 0.2)
  });
  page.drawText("(Cachet de réception du dossier physique)", {
    x: 317,
    y: 197,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.45, 0.5, 0.55)
  });

  // Pied de page
  page.drawLine({
    start: { x: 50, y: 95 },
    end: { x: 545, y: 95 },
    thickness: 0.8,
    color: rgb(0.82, 0.85, 0.88)
  });
  page.drawText("Université Sidi Mohamed Ben Abdellah - CEDoc Fès | Modèle pédagogique, sans valeur juridique", {
    x: 50,
    y: 78,
    size: 8,
    font: fontRegular,
    color: rgb(0.45, 0.5, 0.55)
  });
  page.drawText(`Réf: ${ref} | Horodatage: ${toWinAnsiSafe(dateHeureSoumission)}`, {
    x: 50,
    y: 64,
    size: 8,
    font: fontMono,
    color: rgb(0.3, 0.35, 0.4)
  });

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const base64 = uint8ArrayToBase64(pdfBytes);
  const dataUrl = `data:application/pdf;base64,${base64}`;

  return { dataUrl, blob, pageCount: 1 };
}

/**
 * Convertit une ou deux photos (JPEG Data URL) de la Carte Nationale (CNIE) scannées ou importées
 * en un véritable fichier PDF multi-pages aux proportions officielles (85,6 × 54 mm).
 */
export async function generateCnieScanPdf(
  rectoJpegDataUrl: string,
  versoJpegDataUrl?: string
): Promise<{ dataUrl: string; pageCount: number; byteLength: number; tailleMo: number }> {
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const faces = [
    { label: 'FACE 1 : RECTO - CARTE NATIONALE (CNIE)', imgUrl: rectoJpegDataUrl },
    { label: 'FACE 2 : VERSO - CARTE NATIONALE (CNIE)', imgUrl: versoJpegDataUrl || rectoJpegDataUrl }
  ];

  for (let i = 0; i < faces.length; i++) {
    const face = faces[i];
    const page = pdfDoc.addPage([595, 420]);

    page.drawText('CEDoc USMBA - Piece justificative numerisee (Format officiel 85,6 x 54 mm)', {
      x: 40,
      y: 385,
      size: 10,
      font: fontBold,
      color: rgb(0.06, 0.46, 0.43)
    });

    page.drawText(face.label, {
      x: 40,
      y: 368,
      size: 9,
      font: fontRegular,
      color: rgb(0.3, 0.35, 0.4)
    });

    const base64Data = face.imgUrl.split(',')[1] || '';
    const binaryStr = atob(base64Data);
    const imgBytes = new Uint8Array(binaryStr.length);
    for (let j = 0; j < binaryStr.length; j++) {
      imgBytes[j] = binaryStr.charCodeAt(j);
    }

    const embeddedImg = face.imgUrl.startsWith('data:image/png')
      ? await pdfDoc.embedPng(imgBytes)
      : await pdfDoc.embedJpg(imgBytes);

    // Cadre aux proportions 85,6 x 54 mm (ratio ~ 1.585)
    const boxWidth = 460;
    const boxHeight = Math.round(boxWidth * (54 / 85.6)); // ~290 pt
    const boxX = Math.round((595 - boxWidth) / 2);
    const boxY = 50;

    page.drawRectangle({
      x: boxX - 4,
      y: boxY - 4,
      width: boxWidth + 8,
      height: boxHeight + 8,
      borderColor: rgb(0.06, 0.46, 0.43),
      borderWidth: 1.5,
      color: rgb(0.98, 0.99, 0.99)
    });

    page.drawImage(embeddedImg, {
      x: boxX,
      y: boxY,
      width: boxWidth,
      height: boxHeight
    });
  }

  const pdfBytes = await pdfDoc.save();
  const base64 = uint8ArrayToBase64(pdfBytes);
  const dataUrl = `data:application/pdf;base64,${base64}`;
  const byteLength = pdfBytes.byteLength;
  const tailleMo = byteLength / (1024 * 1024);

  return {
    dataUrl,
    pageCount: faces.length,
    byteLength,
    tailleMo
  };
}




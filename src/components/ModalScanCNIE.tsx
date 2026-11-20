import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  Upload,
  X,
  Check,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Sun,
  Focus,
  Sparkles,
  IdCard,
  CheckCircle2,
  Cpu,
  ShieldCheck,
  Edit3,
  Lock
} from 'lucide-react';
import { generateCnieScanPdf } from '../utils/pdfUtils';
import {
  extractCnieDataFromImages,
  validateCnieExtraction,
  compareExtractedNameWithAccount,
  RawCnieExtraction,
  ValidatedCnieExtraction,
  CnieFieldKey
} from '../utils/cnieExtractionUtils';

export type GuidanceMessage =
  | 'Placez la carte dans le cadre'
  | 'Trop sombre'
  | 'Image floue, ne bougez pas'
  | 'Reflet détecté, inclinez la carte'
  | 'Parfait, prise de photo';

interface QualityAnalysisResult {
  valid: boolean;
  brightness: number; // 0 - 255
  sharpness: number; // score Laplacien
  glareRatio: number; // 0 - 1
  contrastStd: number;
  guidance: GuidanceMessage;
  refusalReason?: string;
}

export interface CnieScanCompletePayload {
  dataUrl?: string;
  pageCount?: number;
  byteLength?: number;
  tailleMo?: number;
  nomFichier?: string;
  extractedFields: RawCnieExtraction;
  engine: 'GEMINI' | 'TESSERACT_FALLBACK' | 'MANUEL';
  isManualOnly?: boolean;
}

interface ModalScanCNIEProps {
  isOpen: boolean;
  accountNom: string;
  accountPrenom: string;
  initialFields?: Partial<RawCnieExtraction>;
  onClose: () => void;
  onScanComplete: (
    result: CnieScanCompletePayload
  ) => void | Promise<{ valid: boolean; error?: string } | void>;
}

// Seuils de contrôle qualité (luminosité, netteté, reflet, présence de carte)
const MIN_BRIGHTNESS = 58;
const MIN_SHARPNESS = 13.5;
const MAX_GLARE_RATIO = 0.085;
const MIN_CARD_CONTRAST = 15;

/**
 * Analyse la netteté (variance du Laplacien), la luminosité moyenne, les reflets (zones saturées)
 * et le contraste d'un ImageData correspondant au cadre de la carte (85,6 × 54 mm).
 */
function analyzeCardImageData(
  imageData: ImageData,
  prevGrayBuffer?: Float32Array | null,
  isStaticImport: boolean = false
): { result: QualityAnalysisResult; grayBuffer: Float32Array } {
  const { data, width, height } = imageData;
  const numPixels = width * height;
  const gray = new Float32Array(numPixels);

  let sumLum = 0;
  let sumLumSq = 0;
  let glarePixels = 0;

  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[i] = lum;
    sumLum += lum;
    sumLumSq += lum * lum;

    if (lum > 246 && r > 240 && g > 240 && b > 240) {
      glarePixels++;
    }
  }

  const brightness = sumLum / Math.max(1, numPixels);
  const varianceLum = Math.max(0, sumLumSq / Math.max(1, numPixels) - brightness * brightness);
  const contrastStd = Math.sqrt(varianceLum);
  const glareRatio = glarePixels / Math.max(1, numPixels);

  // Calcul de la netteté par opérateur Laplacien 3x3 sur la zone centrale de la carte
  let lapSum = 0;
  let lapSumSq = 0;
  let lapCount = 0;

  for (let y = 2; y < height - 2; y += 2) {
    for (let x = 2; x < width - 2; x += 2) {
      const center = gray[y * width + x];
      const top = gray[(y - 1) * width + x];
      const bottom = gray[(y + 1) * width + x];
      const left = gray[y * width + (x - 1)];
      const right = gray[y * width + (x + 1)];
      const lap = Math.abs(4 * center - top - bottom - left - right);
      lapSum += lap;
      lapSumSq += lap * lap;
      lapCount++;
    }
  }

  const meanLap = lapSum / Math.max(1, lapCount);
  const varLap = Math.max(0, lapSumSq / Math.max(1, lapCount) - meanLap * meanLap);
  let sharpness = Math.sqrt(varLap);

  // Pénalité de mouvement entre deux frames caméra consécutives
  let motionDiff = 0;
  if (!isStaticImport && prevGrayBuffer && prevGrayBuffer.length === numPixels) {
    let diffSum = 0;
    let sampleCount = 0;
    for (let i = 0; i < numPixels; i += 8) {
      diffSum += Math.abs(gray[i] - prevGrayBuffer[i]);
      sampleCount++;
    }
    motionDiff = diffSum / Math.max(1, sampleCount);
    if (motionDiff > 14) {
      sharpness = sharpness * 0.45;
    }
  }

  if (brightness < MIN_BRIGHTNESS) {
    return {
      grayBuffer: gray,
      result: {
        valid: false,
        brightness: Math.round(brightness),
        sharpness: Number(sharpness.toFixed(1)),
        glareRatio,
        contrastStd,
        guidance: 'Trop sombre',
        refusalReason: `Image refusée : la photo est trop sombre (luminosité mesurée : ${Math.round(
          brightness
        )}/255, minimum requis : ${MIN_BRIGHTNESS}/255). Veuillez éclairer davantage votre carte nationale (CNIE) sans créer d'ombre.`
      }
    };
  }

  if (!isStaticImport && contrastStd < MIN_CARD_CONTRAST) {
    return {
      grayBuffer: gray,
      result: {
        valid: false,
        brightness: Math.round(brightness),
        sharpness: Number(sharpness.toFixed(1)),
        glareRatio,
        contrastStd,
        guidance: 'Placez la carte dans le cadre',
        refusalReason:
          "Image refusée : aucune carte nationale distincte n'est détectée dans le cadre guide (85,6 × 54 mm). Placez la carte bien à plat dans le cadre."
      }
    };
  }

  if (glareRatio > MAX_GLARE_RATIO) {
    return {
      grayBuffer: gray,
      result: {
        valid: false,
        brightness: Math.round(brightness),
        sharpness: Number(sharpness.toFixed(1)),
        glareRatio,
        contrastStd,
        guidance: 'Reflet détecté, inclinez la carte',
        refusalReason: `Image refusée : un reflet lumineux excessif (${Math.round(
          glareRatio * 100
        )}% de surface saturée) masque les informations de la carte. Inclinez légèrement la carte ou éloignez le flash.`
      }
    };
  }

  if (sharpness < MIN_SHARPNESS || motionDiff > 14) {
    return {
      grayBuffer: gray,
      result: {
        valid: false,
        brightness: Math.round(brightness),
        sharpness: Number(sharpness.toFixed(1)),
        glareRatio,
        contrastStd,
        guidance: 'Image floue, ne bougez pas',
        refusalReason: `Image refusée : la photo est floue (indice de netteté : ${sharpness.toFixed(
          1
        )}, minimum requis : ${MIN_SHARPNESS}). Stabilisez l'appareil et vérifiez que le texte de la CNIE est parfaitement net.`
      }
    };
  }

  return {
    grayBuffer: gray,
    result: {
      valid: true,
      brightness: Math.round(brightness),
      sharpness: Number(sharpness.toFixed(1)),
      glareRatio,
      contrastStd,
      guidance: 'Parfait, prise de photo'
    }
  };
}

export const ModalScanCNIE: React.FC<ModalScanCNIEProps> = ({
  isOpen,
  accountNom,
  accountPrenom,
  initialFields,
  onClose,
  onScanComplete
}) => {
  // Étape de confidentialité & consentement obligatoire avant de passer au scan
  const [consentChecked, setConsentChecked] = useState(false);
  const [hasConfirmedConsent, setHasConfirmedConsent] = useState(false);

  // Mode saisie manuelle des champs si la caméra est bloquée ou refusée (Point 2 & Point 8)
  const [manualEntryMode, setManualEntryMode] = useState(false);

  // Case de vérification obligatoire des champs par le candidat avant de pouvoir continuer (Point 6)
  const [candidateVerifiedFields, setCandidateVerifiedFields] = useState(false);

  const [activeFace, setActiveFace] = useState<'RECTO' | 'VERSO'>('RECTO');
  const [rectoPhoto, setRectoPhoto] = useState<{
    dataUrl: string;
    brightness: number;
    sharpness: number;
    source: 'CAMERA' | 'GALERIE';
  } | null>(null);
  const [versoPhoto, setVersoPhoto] = useState<{
    dataUrl: string;
    brightness: number;
    sharpness: number;
    source: 'CAMERA' | 'GALERIE';
  } | null>(null);

  // État caméra (le bouton « Prise auto » est décoché au début)
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraRequesting, setCameraRequesting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(false);

  // Guidage en direct & métriques temps réel
  const [liveGuidance, setLiveGuidance] = useState<GuidanceMessage>('Placez la carte dans le cadre');
  const [liveMetrics, setLiveMetrics] = useState<{
    brightness: number;
    sharpness: number;
    glareRatio: number;
    valid: boolean;
  }>({
    brightness: 0,
    sharpness: 0,
    glareRatio: 0,
    valid: false
  });

  // Messages qualité
  const [refusalMessage, setRefusalMessage] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // État d'extraction OCR (Gemini JSON strict + secours Tesseract.js fra + ara) et validation avant remplissage
  const [isExtractingOcr, setIsExtractingOcr] = useState(false);
  const [ocrValidation, setOcrValidation] = useState<ValidatedCnieExtraction | null>(null);
  const [formValues, setFormValues] = useState<RawCnieExtraction>({
    nom: initialFields?.nom || '',
    prenom: initialFields?.prenom || '',
    cin: initialFields?.cin || '',
    date_naissance: initialFields?.date_naissance || '',
    lieu_naissance: initialFields?.lieu_naissance || '',
    adresse: initialFields?.adresse || '',
    date_validite: initialFields?.date_validite || ''
  });

  // Suivi de l'affichage différé des erreurs (après tentative ou après avoir quitté le champ, pas dès l'ouverture)
  const [touchedFields, setTouchedFields] = useState<Partial<Record<CnieFieldKey, boolean>>>({});
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [hasScannedAttempt, setHasScannedAttempt] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const shouldRunCameraRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevGrayRef = useRef<Float32Array | null>(null);
  const perfectStreakRef = useRef<number>(0);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // Arrête immédiatement le flux vidéo (stop sur chaque piste) pour éteindre la caméra et faire disparaître le voyant
  const stopCamera = useCallback(() => {
    shouldRunCameraRef.current = false;
    setCameraRequesting(false);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {
          // Ignorer erreur d'arrêt de piste
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      const videoStream = videoRef.current.srcObject as MediaStream | null;
      if (videoStream && typeof videoStream.getTracks === 'function') {
        videoStream.getTracks().forEach(track => {
          try {
            track.stop();
          } catch {
            // Ignorer erreur d'arrêt de piste
          }
        });
      }
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
    prevGrayRef.current = null;
    perfectStreakRef.current = 0;
  }, []);

  // Demande d'accès à la caméra uniquement à l'ouverture de l'écran de scan (après clic sur « Scanner ma carte nationale »)
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    setRefusalMessage(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        "La caméra est indisponible sur ce navigateur. Veuillez utiliser l'import de photo ci-dessous, puis la saisie manuelle des champs."
      );
      return;
    }

    shouldRunCameraRef.current = true;
    setCameraRequesting(true);

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      // Si l'écran de scan a été fermé, annulé ou quitté pendant la demande d'autorisation, on coupe immédiatement chaque piste
      if (!isMountedRef.current || !shouldRunCameraRef.current) {
        stream.getTracks().forEach(track => {
          try {
            track.stop();
          } catch {
            // Ignorer
          }
        });
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch {
          // Ignorer interruption play() si arrêt immédiat
        }
      }
      setCameraRequesting(false);
      setCameraActive(true);
      setLiveGuidance('Placez la carte dans le cadre');
    } catch {
      stopCamera();
      setCameraError(
        "Autorisation d'accès à la caméra refusée ou bloquée. Vous pouvez importer une photo de votre carte nationale (Option 1), puis passer à la saisie manuelle des champs (Option 2)."
      );
    }
  }, [stopCamera]);

  // Réinitialisation à l'ouverture : demande d'abord le consentement du candidat avant de passer au scan, et « Prise auto » décoché au début
  useEffect(() => {
    isMountedRef.current = true;
    if (isOpen) {
      setConsentChecked(false);
      setHasConfirmedConsent(false);
      setAutoCaptureEnabled(false);
      setManualEntryMode(false);
      setCandidateVerifiedFields(false);
      setTouchedFields({});
      setAttemptedSubmit(false);
      setHasScannedAttempt(false);
      setRefusalMessage(null);
      setSuccessBanner(null);
      stopCamera();
    } else {
      stopCamera();
    }
    return () => {
      isMountedRef.current = false;
      stopCamera();
    };
  }, [isOpen, stopCamera]);

  // Démarre la caméra uniquement après que le candidat a donné son consentement et est passé au scan
  useEffect(() => {
    if (isOpen && hasConfirmedConsent && !manualEntryMode) {
      startCamera();
    }
  }, [isOpen, hasConfirmedConsent, manualEntryMode, startCamera]);

  // En quittant la page (fermeture d'onglet, navigation, masquage de la page), arrête immédiatement chaque piste vidéo
  useEffect(() => {
    const handlePageLeave = () => {
      stopCamera();
    };
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopCamera();
      }
    };

    window.addEventListener('pagehide', handlePageLeave);
    window.addEventListener('beforeunload', handlePageLeave);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', handlePageLeave);
      window.removeEventListener('beforeunload', handlePageLeave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopCamera();
    };
  }, [stopCamera]);

  // Exécute l'extraction (Gemini JSON strict ou secours Tesseract.js fra+ara) puis la validation stricte
  const lancerExtractionEtValidation = useCallback(
    async (rectoUrl: string, versoUrl?: string) => {
      setIsExtractingOcr(true);
      setCandidateVerifiedFields(false);
      try {
        const { engine, raw } = await extractCnieDataFromImages(rectoUrl, versoUrl);
        const validated = validateCnieExtraction(engine, raw);
        setOcrValidation(validated);
        setHasScannedAttempt(true);

        // Pré-remplissage UNIQUEMENT avec les valeurs valides ; tout champ illisible ou invalide reste VIDE ("")
        setFormValues({
          nom: validated.fields.nom.value,
          prenom: validated.fields.prenom.value,
          cin: validated.fields.cin.value,
          date_naissance: validated.fields.date_naissance.value,
          lieu_naissance: validated.fields.lieu_naissance.value,
          adresse: validated.fields.adresse.value,
          date_validite: validated.fields.date_validite.value
        });
      } catch (err) {
        console.error('Erreur extraction OCR CNIE :', err);
      } finally {
        setIsExtractingOcr(false);
      }
    },
    []
  );

  // Mise à jour d'un champ par le candidat avec re-validation immédiate (1-2 lettres + 5-6 chiffres, dates valides, carte non expirée)
  const handleFieldChange = (fieldKey: CnieFieldKey, newValue: string) => {
    const updatedRaw: RawCnieExtraction = {
      ...formValues,
      [fieldKey]: newValue
    };
    setFormValues(updatedRaw);

    const currentEngine = ocrValidation?.engine || 'GEMINI';
    const revalidated = validateCnieExtraction(currentEngine, updatedRaw);
    setOcrValidation(revalidated);
  };

  const handleFieldBlur = (fieldKey: CnieFieldKey) => {
    setTouchedFields(prev => ({ ...prev, [fieldKey]: true }));
  };

  // Capture de la région du cadre guide (85,6 × 54 mm)
  const captureFrameFromVideo = useCallback((): {
    dataUrl: string;
    analysis: QualityAnalysisResult;
  } | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      return null;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cardAspect = 85.6 / 54;

    let cropW = vw * 0.82;
    let cropH = cropW / cardAspect;
    if (cropH > vh * 0.82) {
      cropH = vh * 0.82;
      cropW = cropH * cardAspect;
    }
    const cropX = (vw - cropW) / 2;
    const cropY = (vh - cropH) / 2;

    const analysisW = 320;
    const analysisH = Math.round(analysisW / cardAspect);
    let analysisCanvas = analysisCanvasRef.current;
    if (!analysisCanvas) {
      analysisCanvas = document.createElement('canvas');
      analysisCanvasRef.current = analysisCanvas;
    }
    analysisCanvas.width = analysisW;
    analysisCanvas.height = analysisH;
    const aCtx = analysisCanvas.getContext('2d', { willReadFrequently: true });
    if (!aCtx) return null;

    aCtx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, analysisW, analysisH);
    const imgData = aCtx.getImageData(0, 0, analysisW, analysisH);
    const { result, grayBuffer } = analyzeCardImageData(imgData, prevGrayRef.current, false);
    prevGrayRef.current = grayBuffer;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = 856;
    outCanvas.height = 540;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return null;
    outCtx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, 856, 540);
    const dataUrl = outCanvas.toDataURL('image/jpeg', 0.92);

    return { dataUrl, analysis: result };
  }, []);

  // Enregistrement d'une photo validée + ARRÊT IMMÉDIAT du flux caméra après la capture + lancement de l'extraction
  const enregistrerPhotoValidee = useCallback(
    (dataUrl: string, analysis: QualityAnalysisResult, source: 'CAMERA' | 'GALERIE') => {
      // Point 3 : Après la capture, arrête le flux vidéo (stop sur chaque piste) pour que la caméra s'éteigne et que le voyant disparaisse
      stopCamera();

      setRefusalMessage(null);
      setManualEntryMode(false);
      const item = {
        dataUrl,
        brightness: analysis.brightness,
        sharpness: analysis.sharpness,
        source
      };

      if (activeFace === 'RECTO') {
        setRectoPhoto(item);
        setSuccessBanner(
          'Recto de la CNIE capturé et validé (caméra éteinte). Extraction automatique des informations personnelles en cours...'
        );
        lancerExtractionEtValidation(dataUrl, versoPhoto?.dataUrl);
      } else {
        setVersoPhoto(item);
        setSuccessBanner(
          'Verso de la CNIE capturé et validé (caméra éteinte). Mise à jour de l’extraction (adresse, validité) en cours...'
        );
        if (rectoPhoto) {
          lancerExtractionEtValidation(rectoPhoto.dataUrl, dataUrl);
        } else {
          lancerExtractionEtValidation(dataUrl);
        }
      }
      perfectStreakRef.current = 0;
    },
    [activeFace, rectoPhoto, versoPhoto, lancerExtractionEtValidation, stopCamera]
  );

  // Boucle de guidage en direct (toutes les 260 ms)
  useEffect(() => {
    if (!isOpen || !cameraActive || manualEntryMode) return;

    const interval = setInterval(() => {
      const captured = captureFrameFromVideo();
      if (!captured) return;

      const { dataUrl, analysis } = captured;
      setLiveGuidance(analysis.guidance);
      setLiveMetrics({
        brightness: analysis.brightness,
        sharpness: analysis.sharpness,
        glareRatio: analysis.glareRatio,
        valid: analysis.valid
      });

      const currentFaceAlreadyCaptured =
        (activeFace === 'RECTO' && !!rectoPhoto) || (activeFace === 'VERSO' && !!versoPhoto);

      if (autoCaptureEnabled && !currentFaceAlreadyCaptured) {
        if (analysis.valid && analysis.guidance === 'Parfait, prise de photo') {
          perfectStreakRef.current += 1;
          if (perfectStreakRef.current >= 5) {
            enregistrerPhotoValidee(dataUrl, analysis, 'CAMERA');
          }
        } else {
          perfectStreakRef.current = 0;
        }
      }
    }, 260);

    return () => clearInterval(interval);
  }, [
    isOpen,
    cameraActive,
    manualEntryMode,
    autoCaptureEnabled,
    activeFace,
    rectoPhoto,
    versoPhoto,
    captureFrameFromVideo,
    enregistrerPhotoValidee
  ]);

  const handleManualCapture = () => {
    setRefusalMessage(null);
    setSuccessBanner(null);

    const captured = captureFrameFromVideo();
    if (!captured) {
      setRefusalMessage("La caméra n'est pas encore prête. Veuillez patienter ou importer une photo.");
      return;
    }

    const { dataUrl, analysis } = captured;
    setLiveGuidance(analysis.guidance);
    setLiveMetrics({
      brightness: analysis.brightness,
      sharpness: analysis.sharpness,
      glareRatio: analysis.glareRatio,
      valid: analysis.valid
    });

    if (!analysis.valid) {
      setRefusalMessage(
        analysis.refusalReason ||
          "Image refusée : les critères de netteté et de luminosité ne sont pas respectés."
      );
      return;
    }

    enregistrerPhotoValidee(dataUrl, analysis, 'CAMERA');
  };

  // Alternative obligatoire : « Importer une photo » (galerie) avec les mêmes contrôles de qualité
  const handleImportGalleryPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRefusalMessage(null);
    setSuccessBanner(null);

    if (!file.type.startsWith('image/')) {
      setRefusalMessage("Fichier refusé : veuillez sélectionner une image (JPEG, PNG, WebP) depuis votre galerie.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const cardAspect = 85.6 / 54;

        const srcW = img.width;
        const srcH = img.height;
        let cropW = srcW;
        let cropH = cropW / cardAspect;
        if (cropH > srcH) {
          cropH = srcH;
          cropW = cropH * cardAspect;
        }
        const cropX = (srcW - cropW) / 2;
        const cropY = (srcH - cropH) / 2;

        const analysisW = 320;
        const analysisH = Math.round(analysisW / cardAspect);
        const aCanvas = document.createElement('canvas');
        aCanvas.width = analysisW;
        aCanvas.height = analysisH;
        const aCtx = aCanvas.getContext('2d');
        if (!aCtx) return;

        aCtx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, analysisW, analysisH);
        const imgData = aCtx.getImageData(0, 0, analysisW, analysisH);
        const { result } = analyzeCardImageData(imgData, null, true);

        setLiveGuidance(result.guidance);
        setLiveMetrics({
          brightness: result.brightness,
          sharpness: result.sharpness,
          glareRatio: result.glareRatio,
          valid: result.valid
        });

        if (!result.valid) {
          setRefusalMessage(
            result.refusalReason ||
              "Photo importée refusée : l'image est trop floue ou trop sombre pour permettre la vérification de votre CNIE."
          );
          return;
        }

        const outCanvas = document.createElement('canvas');
        outCanvas.width = 856;
        outCanvas.height = 540;
        const outCtx = outCanvas.getContext('2d');
        if (!outCtx) return;
        outCtx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, 856, 540);
        const jpegDataUrl = outCanvas.toDataURL('image/jpeg', 0.92);

        enregistrerPhotoValidee(jpegDataUrl, result, 'GALERIE');
      };
      img.onerror = () => {
        setRefusalMessage("Impossible de lire l'image sélectionnée. Veuillez choisir une autre photo.");
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Passage en mode saisie manuelle des champs (repli si la caméra est bloquée — Point 8)
  const activerSaisieManuelle = () => {
    stopCamera();
    setManualEntryMode(true);
    setRefusalMessage(null);
    setTouchedFields({});
    setAttemptedSubmit(false);
    setHasScannedAttempt(false);
    const validated = validateCnieExtraction('GEMINI', formValues);
    setOcrValidation(validated);
  };

  // Validation temps réel de tous les champs obligatoires
  const currentValidation = validateCnieExtraction(ocrValidation?.engine || 'GEMINI', formValues);

  // Validation finale dans le dossier (impossible d'enregistrer sans tous les champs obligatoires remplis et valides)
  const handleValiderDansDossier = async () => {
    setAttemptedSubmit(true);

    if (!consentChecked) {
      setRefusalMessage(
        "Veuillez cocher la case de consentement (« Votre carte sera enregistrée comme pièce justificative de votre dossier ») avant de valider."
      );
      return;
    }

    if (!rectoPhoto && !manualEntryMode) {
      setRefusalMessage("Veuillez scanner ou importer au moins le Recto de votre carte nationale (CNIE), ou choisir la saisie manuelle.");
      return;
    }

    if (currentValidation.isCardExpired) {
      setRefusalMessage(
        "Impossible de valider : la date de validité indique que la carte nationale (CNIE) est expirée. Veuillez présenter une carte non expirée."
      );
      return;
    }

    if (!currentValidation.allValid) {
      setRefusalMessage(
        `Validation bloquée : tous les champs obligatoires doivent être remplis et valides (${currentValidation.remainingCount} ${
          currentValidation.remainingCount > 1 ? 'champs restants' : 'champ restant'
        }).`
      );
      return;
    }

    if (!candidateVerifiedFields) {
      setRefusalMessage(
        "Veuillez cocher la case confirmant que vous avez vérifié (et corrigé si nécessaire) chaque champ avant de continuer."
      );
      return;
    }

    try {
      setIsGeneratingPdf(true);

      const finalValidated: RawCnieExtraction = {
        nom: currentValidation.fields.nom.value,
        prenom: currentValidation.fields.prenom.value,
        cin: currentValidation.fields.cin.value,
        date_naissance: currentValidation.fields.date_naissance.value,
        lieu_naissance: currentValidation.fields.lieu_naissance.value,
        adresse: currentValidation.fields.adresse.value,
        date_validite: currentValidation.fields.date_validite.value
      };

      if (rectoPhoto) {
        const pdfRes = await generateCnieScanPdf(rectoPhoto.dataUrl, versoPhoto?.dataUrl);
        stopCamera();

        const completionRes = await onScanComplete({
          dataUrl: pdfRes.dataUrl,
          pageCount: pdfRes.pageCount,
          byteLength: pdfRes.byteLength,
          tailleMo: pdfRes.tailleMo,
          nomFichier: `CNIE_Scan_${new Date().toISOString().slice(0, 10)}.pdf`,
          extractedFields: finalValidated,
          engine: currentValidation.engine || 'GEMINI',
          isManualOnly: false
        });

        if (completionRes && completionRes.valid === false) {
          setRefusalMessage(
            completionRes.error || "Ce document n'est pas une Carte nationale (CNIE)."
          );
          return;
        }
      } else {
        stopCamera();
        await onScanComplete({
          extractedFields: finalValidated,
          engine: 'MANUEL',
          isManualOnly: true
        });
      }
      onClose();
    } catch (err) {
      console.error('Erreur génération PDF CNIE :', err);
      setRefusalMessage("Une erreur est survenue lors de l'enregistrement. Veuillez réessayer.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (!isOpen) return null;

  const getGuidanceBadgeStyle = (msg: GuidanceMessage) => {
    switch (msg) {
      case 'Parfait, prise de photo':
        return 'bg-[#16a34a] text-white border-emerald-400';
      case 'Trop sombre':
        return 'bg-amber-600 text-white border-amber-400';
      case 'Image floue, ne bougez pas':
        return 'bg-rose-600 text-white border-rose-400';
      case 'Reflet détecté, inclinez la carte':
        return 'bg-amber-600 text-white border-amber-400';
      default:
        return 'bg-slate-900/90 text-white border-slate-500';
    }
  };

  const currentFacePhoto = activeFace === 'RECTO' ? rectoPhoto : versoPhoto;

  // Comparaison entre le nom extrait de la CNIE et le nom du compte candidat (Point 6)
  const nameComparison = compareExtractedNameWithAccount(
    formValues.nom,
    formValues.prenom,
    accountNom,
    accountPrenom
  );

  const fieldDefinitions: Array<{
    key: CnieFieldKey;
    label: string;
    placeholder: string;
    hint: string;
    fullWidth?: boolean;
  }> = [
    {
      key: 'nom',
      label: 'Nom de famille',
      placeholder: 'Non détecté — saisir le nom',
      hint: 'Lettres uniquement (majuscules)'
    },
    {
      key: 'prenom',
      label: 'Prénom',
      placeholder: 'Non détecté — saisir le prénom',
      hint: 'Lettres uniquement'
    },
    {
      key: 'cin',
      label: 'Numéro de carte (CIN / CNIE)',
      placeholder: 'Ex : CD123456',
      hint: '1 ou 2 lettres suivies de 5 à 6 chiffres'
    },
    {
      key: 'date_naissance',
      label: 'Date de naissance',
      placeholder: 'JJ/MM/AAAA',
      hint: 'Date calendaire valide'
    },
    {
      key: 'lieu_naissance',
      label: 'Lieu de naissance',
      placeholder: 'Non détecté — saisir le lieu de naissance',
      hint: 'Ville ou commune figurant sur la CNIE'
    },
    {
      key: 'date_validite',
      label: 'Date de validité (Expiration)',
      placeholder: 'JJ/MM/AAAA',
      hint: 'Date valide et carte non expirée'
    },
    {
      key: 'adresse',
      label: 'Adresse de résidence',
      placeholder: 'Non détectée (figure au verso) — saisir ou compléter votre adresse',
      hint: 'Adresse figurant au verso de la CNIE',
      fullWidth: true
    }
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-[6px] shadow-2xl border border-slate-200 overflow-hidden my-4 animate-in fade-in">
        {/* En-tête */}
        <div className="bg-[#0f766e] text-white px-5 py-4 flex items-center justify-between border-b border-[#0d655e]">
          <div className="flex items-center gap-2.5">
            <IdCard className="w-5 h-5 text-teal-200 shrink-0" />
            <div>
              <h3 className="text-base font-bold font-serif leading-snug">
                Scan de la Carte Nationale (CNIE) &amp; Informations personnelles
              </h3>
              <p className="text-[11px] text-teal-100">
                Cadre officiel (85,6 × 54 mm) &bull; Remplissage automatique &bull; Protection &amp; Confidentialité CEDoc
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-teal-100 hover:text-white p-1.5 rounded-[4px] hover:bg-white/10 transition cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ===================================================================== */}
        {/* ÉTAPE PRÉALABLE OBLIGATOIRE : DEMANDE DE CONSENTEMENT AVANT LE SCAN   */}
        {/* ===================================================================== */}
        {!hasConfirmedConsent ? (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="p-5 rounded-[6px] bg-[#f0fdfa] border border-[#99f6e4] space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#0f766e] text-white flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#0f766e]">
                    Engagement de confidentialité &bull; CEDoc USMBA
                  </span>
                  <h4 className="text-base sm:text-lg font-extrabold text-slate-900 font-serif">
                    Votre carte sera enregistrée comme pièce justificative de votre dossier
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                    L&apos;image n&apos;est visible que par le candidat et le personnel autorisé du CEDoc, et n&apos;est utilisée pour aucun autre usage.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-teal-200/70 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] text-slate-700">
                <div className="p-2.5 rounded-[4px] bg-white border border-teal-100 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#0f766e] shrink-0" />
                  <span>Accès restreint au candidat et aux agents habilités du CEDoc</span>
                </div>
                <div className="p-2.5 rounded-[4px] bg-white border border-teal-100 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#0f766e] shrink-0" />
                  <span>Pré-remplissage supervisé de vos informations personnelles</span>
                </div>
                <div className="p-2.5 rounded-[4px] bg-white border border-teal-100 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#0f766e] shrink-0" />
                  <span>Aucun partage externe ni utilisation à d&apos;autres fins</span>
                </div>
              </div>
            </div>

            {/* Case de consentement obligatoire */}
            <label className="flex items-start gap-3 p-4 rounded-[6px] bg-slate-50 border border-slate-300 hover:border-[#0f766e] cursor-pointer transition select-none">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#0f766e] rounded cursor-pointer shrink-0"
              />
              <div className="space-y-1 text-xs">
                <span className="font-bold text-slate-900 block">
                  J&apos;ai pris connaissance de cette mention et je consens à ce que ma carte nationale (CNIE) soit scannée et enregistrée comme pièce justificative de mon dossier de candidature. *
                </span>
                <span className="text-slate-500 block text-[11px]">
                  Ce consentement est obligatoire avant de passer au scan de votre carte nationale.
                </span>
              </div>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  onClose();
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[6px] text-xs font-bold cursor-pointer transition"
              >
                Annuler
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!consentChecked}
                  onClick={() => {
                    setHasConfirmedConsent(true);
                  }}
                  className="px-5 py-2.5 bg-[#0f766e] hover:bg-[#115e59] disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-[6px] text-xs font-bold flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed transition shadow-2xs"
                >
                  <Camera className="w-4 h-4" />
                  <span>Continuer vers le scan de ma carte</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
        /* ===================================================================== */
        /* ÉCRAN DE SCAN / IMPORT / SAISIE MANUELLE & REMPLISSAGE                */
        /* ===================================================================== */
        <div className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
          {/* Bandeau rappel de confidentialité validée */}
          <div className="px-3.5 py-2 rounded-[6px] bg-[#f0fdfa] border border-[#ccfbf1] text-[11px] text-slate-700 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#0f766e] shrink-0" />
              <span>
                <strong>Confidentialité garantie :</strong> Votre carte sera enregistrée comme pièce justificative de votre dossier (visible uniquement par vous et le personnel autorisé du CEDoc).
              </span>
            </div>
            {manualEntryMode && (
              <button
                type="button"
                onClick={() => {
                  setManualEntryMode(false);
                  if (!currentFacePhoto) {
                    startCamera();
                  }
                }}
                className="text-[11px] font-bold text-[#0f766e] hover:underline cursor-pointer shrink-0"
              >
                Revenir au scan caméra / photo
              </button>
            )}
          </div>

          {!manualEntryMode && (
            <>
              {/* Sélecteur de face : Recto / Verso */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-[6px] border border-slate-200">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFace('RECTO');
                      setRefusalMessage(null);
                      setSuccessBanner(null);
                      if (rectoPhoto) {
                        stopCamera();
                      } else if (!cameraActive) {
                        startCamera();
                      }
                    }}
                    className={`px-3 py-1.5 rounded-[4px] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
                      activeFace === 'RECTO'
                        ? 'bg-[#0f766e] text-white shadow-2xs'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {rectoPhoto ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : <span>1.</span>}
                    <span>Face Recto (Obligatoire)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveFace('VERSO');
                      setRefusalMessage(null);
                      setSuccessBanner(null);
                      if (versoPhoto) {
                        stopCamera();
                      } else if (!cameraActive) {
                        startCamera();
                      }
                    }}
                    className={`px-3 py-1.5 rounded-[4px] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
                      activeFace === 'VERSO'
                        ? 'bg-[#0f766e] text-white shadow-2xs'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {versoPhoto ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : <span>2.</span>}
                    <span>Face Verso (Adresse &amp; Code)</span>
                  </button>
                </div>

                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoCaptureEnabled}
                    onChange={(e) => setAutoCaptureEnabled(e.target.checked)}
                    className="accent-[#0f766e] rounded cursor-pointer"
                  />
                  <span>Prise auto dès « Parfait, prise de photo »</span>
                </label>
              </div>

              {/* Zone Caméra / Aperçu avec Cadre Guide 85,6 × 54 mm */}
              <div className="relative bg-slate-950 rounded-[6px] overflow-hidden border border-slate-800 aspect-video flex items-center justify-center">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${
                    currentFacePhoto || !cameraActive ? 'hidden' : 'block'
                  }`}
                />

                {currentFacePhoto && (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-slate-900">
                    <div
                      className="relative w-[84%] max-w-[460px] rounded-[8px] overflow-hidden border-2 border-[#16a34a] shadow-lg"
                      style={{ aspectRatio: '85.6 / 54' }}
                    >
                      <img
                        src={currentFacePhoto.dataUrl}
                        alt={`CNIE ${activeFace}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2 bg-[#16a34a] text-white text-[10px] font-bold px-2.5 py-1 rounded-[4px] flex items-center gap-1 shadow">
                        <Check className="w-3 h-3 stroke-[2.5]" />
                        <span>
                          {activeFace} validé ({currentFacePhoto.source === 'CAMERA' ? 'Caméra' : 'Galerie'})
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* POINT 2 & POINT 8 : Si l'autorisation caméra est refusée ou bloquée, affiche un message clair et propose l'import de photo puis la saisie manuelle */}
                {!cameraActive && !currentFacePhoto && (
                  <div className="p-6 text-center text-slate-200 max-w-lg space-y-4">
                    <div className="w-11 h-11 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center mx-auto">
                      <AlertTriangle className="w-6 h-6 text-amber-400" />
                    </div>
                    <div className="space-y-1.5">
                      <h4 className="text-sm font-bold text-white font-serif">
                        {cameraError
                          ? 'Accès à la caméra refusé ou bloqué'
                          : cameraRequesting
                            ? "Demande d'accès à la caméra en cours..."
                            : 'Caméra en attente'}
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {cameraError ||
                          "Veuillez autoriser l'accès à la caméra dans votre navigateur. Si l'autorisation est refusée, vous pouvez importer une photo de votre carte nationale (Option 1) puis passer à la saisie manuelle des champs (Option 2)."}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (galleryInputRef.current) {
                            galleryInputRef.current.value = '';
                            galleryInputRef.current.click();
                          }
                        }}
                        className="px-3.5 py-2 bg-[#0f766e] hover:bg-[#115e59] text-white rounded-[4px] text-xs font-bold cursor-pointer transition flex items-center gap-1.5 shadow"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>1. Importer une photo</span>
                      </button>

                      <button
                        type="button"
                        onClick={activerSaisieManuelle}
                        className="px-3.5 py-2 bg-white text-slate-900 hover:bg-slate-100 rounded-[4px] text-xs font-bold cursor-pointer transition flex items-center gap-1.5 shadow"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#0f766e]" />
                        <span>2. Saisie manuelle des champs</span>
                      </button>

                      <button
                        type="button"
                        onClick={startCamera}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-[4px] text-xs font-bold cursor-pointer transition"
                      >
                        Réessayer la caméra
                      </button>
                    </div>
                  </div>
                )}

                {cameraActive && !currentFacePhoto && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
                    <div
                      className={`mb-3 px-4 py-1.5 rounded-[6px] border text-xs sm:text-sm font-extrabold tracking-wide shadow-lg transition-all duration-200 flex items-center gap-2 ${getGuidanceBadgeStyle(
                        liveGuidance
                      )}`}
                    >
                      {liveGuidance === 'Parfait, prise de photo' ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                      )}
                      <span>{liveGuidance}</span>
                    </div>

                    <div
                      className={`relative w-[82%] max-w-[450px] rounded-[10px] transition-colors duration-200 ${
                        liveGuidance === 'Parfait, prise de photo'
                          ? 'border-2 border-[#16a34a] shadow-[0_0_0_9999px_rgba(15,23,42,0.55)]'
                          : liveGuidance === 'Placez la carte dans le cadre'
                            ? 'border-2 border-dashed border-white/85 shadow-[0_0_0_9999px_rgba(15,23,42,0.55)]'
                            : 'border-2 border-amber-400 shadow-[0_0_0_9999px_rgba(15,23,42,0.55)]'
                      }`}
                      style={{ aspectRatio: '85.6 / 54' }}
                    >
                      <div className="absolute -top-0.5 -left-0.5 w-5 h-5 border-t-4 border-l-4 border-teal-400 rounded-tl-[6px]" />
                      <div className="absolute -top-0.5 -right-0.5 w-5 h-5 border-t-4 border-r-4 border-teal-400 rounded-tr-[6px]" />
                      <div className="absolute -bottom-0.5 -left-0.5 w-5 h-5 border-b-4 border-l-4 border-teal-400 rounded-bl-[6px]" />
                      <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-4 border-r-4 border-teal-400 rounded-br-[6px]" />

                      <div className="absolute bottom-2 right-2.5 bg-slate-900/75 text-teal-200 text-[10px] font-mono font-bold px-2 py-0.5 rounded-[4px] border border-teal-500/30">
                        CNIE {activeFace} &bull; 85,6 × 54 mm
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Indicateurs de contrôle qualité en temps réel */}
              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div
                  className={`p-2.5 rounded-[6px] border flex items-center justify-between ${
                    liveMetrics.brightness >= MIN_BRIGHTNESS
                      ? 'bg-emerald-50/60 border-emerald-200 text-slate-800'
                      : 'bg-amber-50/70 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-[#0f766e] shrink-0" />
                    <span className="font-bold text-[11px]">Luminosité</span>
                  </div>
                  <span className="font-mono font-bold text-[11px]">
                    {liveMetrics.brightness > 0
                      ? liveMetrics.brightness >= MIN_BRIGHTNESS
                        ? 'OK'
                        : 'Sombre'
                      : '—'}
                  </span>
                </div>

                <div
                  className={`p-2.5 rounded-[6px] border flex items-center justify-between ${
                    liveMetrics.sharpness >= MIN_SHARPNESS
                      ? 'bg-emerald-50/60 border-emerald-200 text-slate-800'
                      : 'bg-amber-50/70 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Focus className="w-3.5 h-3.5 text-[#0f766e] shrink-0" />
                    <span className="font-bold text-[11px]">Netteté</span>
                  </div>
                  <span className="font-mono font-bold text-[11px]">
                    {liveMetrics.sharpness > 0
                      ? liveMetrics.sharpness >= MIN_SHARPNESS
                        ? 'Nette'
                        : 'Floue'
                      : '—'}
                  </span>
                </div>

                <div
                  className={`p-2.5 rounded-[6px] border flex items-center justify-between ${
                    liveMetrics.glareRatio <= MAX_GLARE_RATIO
                      ? 'bg-emerald-50/60 border-emerald-200 text-slate-800'
                      : 'bg-amber-50/70 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#0f766e] shrink-0" />
                    <span className="font-bold text-[11px]">Reflets</span>
                  </div>
                  <span className="font-mono font-bold text-[11px]">
                    {liveMetrics.brightness > 0
                      ? liveMetrics.glareRatio <= MAX_GLARE_RATIO
                        ? 'Aucun'
                        : 'Reflet'
                      : '—'}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Message d'explication en cas de refus (image floue, trop sombre ou avec reflet) */}
          {refusalMessage && (
            <div className="p-3.5 rounded-[6px] bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <strong className="block font-bold text-rose-900">
                  Attention :
                </strong>
                <p className="leading-relaxed font-medium">{refusalMessage}</p>
              </div>
            </div>
          )}

          {/* Message de confirmation de capture conforme */}
          {successBanner && !refusalMessage && (
            <div className="p-3 rounded-[6px] bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs flex items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-2 font-semibold">
                <Check className="w-4 h-4 text-[#16a34a] stroke-[2.5] shrink-0" />
                <span>{successBanner}</span>
              </div>
              {activeFace === 'RECTO' && rectoPhoto && !versoPhoto && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveFace('VERSO');
                    setSuccessBanner(null);
                    startCamera();
                  }}
                  className="px-2.5 py-1 bg-[#0f766e] hover:bg-[#115e59] text-white rounded-[4px] text-[11px] font-bold shrink-0 cursor-pointer transition"
                >
                  Scanner le Verso &rarr;
                </button>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* ÉTAPES 4, 5 & 6 : EXTRACTION, VALIDATION & REMPLISSAGE AUTOMATIQUE DE     */}
          {/* L'ÉTAPE « INFORMATIONS PERSONNELLES » + COMPARAISON AVEC LE NOM DU COMPTE */}
          {/* ========================================================================= */}
          {(rectoPhoto || versoPhoto || isExtractingOcr || ocrValidation || manualEntryMode) && (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                handleValiderDansDossier();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleValiderDansDossier();
                }
              }}
              className="p-4 rounded-[6px] bg-slate-50 border border-slate-200 space-y-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#0f766e]" />
                  <div>
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 font-serif">
                      Étape « Informations personnelles » — Vérification &amp; Correction
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Tous les champs sont obligatoires et doivent être valides avant de pouvoir enregistrer ou continuer.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Compteur obligatoire « X champs restants » */}
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-[4px] border ${
                      currentValidation.remainingCount === 0
                        ? 'bg-emerald-50 text-[#16a34a] border-emerald-300'
                        : 'bg-amber-100 text-amber-950 border-amber-400'
                    }`}
                  >
                    {currentValidation.remainingCount} {currentValidation.remainingCount > 1 ? 'champs restants' : 'champ restant'}
                  </span>

                  {manualEntryMode ? (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-[4px] bg-amber-50 text-amber-800 border border-amber-300">
                      Mode : Saisie manuelle des champs
                    </span>
                  ) : (
                    ocrValidation && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-[4px] bg-[#f0fdfa] text-[#0f766e] border border-[#ccfbf1]">
                        {ocrValidation.engine === 'GEMINI'
                          ? 'Moteur : Gemini (JSON strict)'
                          : 'Moteur : Secours Tesseract.js (fra + ara)'}
                      </span>
                    )
                  )}

                  {rectoPhoto && !manualEntryMode && (
                    <button
                      type="button"
                      disabled={isExtractingOcr}
                      onClick={() => lancerExtractionEtValidation(rectoPhoto.dataUrl, versoPhoto?.dataUrl)}
                      className="px-2.5 py-1 bg-white border border-slate-300 hover:border-[#0f766e] text-slate-700 rounded-[4px] text-[11px] font-bold flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isExtractingOcr ? 'animate-spin' : ''}`} />
                      <span>{isExtractingOcr ? 'Extraction...' : 'Relancer l’extraction'}</span>
                    </button>
                  )}
                </div>
              </div>

              {isExtractingOcr ? (
                <div className="p-4 text-center text-xs text-slate-600 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 text-[#0f766e] animate-spin" />
                  <span>
                    Extraction JSON stricte et remplissage automatique des informations personnelles en cours...
                  </span>
                </div>
              ) : (
                <>
                  {/* POINT 6 : Comparaison du nom extrait au nom du compte avec avertissement en cas de différence */}
                  {nameComparison.hasMismatch && (
                    <div className="p-3.5 rounded-[6px] bg-amber-50 border-2 border-amber-400 text-amber-950 text-xs flex items-start gap-2.5 animate-in fade-in">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <strong className="font-bold block text-amber-900">
                          Avertissement — Différence entre le nom extrait de la CNIE et le nom du compte :
                        </strong>
                        <p className="leading-relaxed font-medium">
                          {nameComparison.warningMessage}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Alerte si carte expirée */}
                  {currentValidation.isCardExpired && (
                    <div className="p-3 rounded-[6px] bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-bold block">Carte nationale expirée :</strong>
                        <span>
                          La date de validité ({currentValidation.fields.date_validite.rawDetected}) est dépassée. Une carte expirée ne peut pas être validée.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Notice d'explication du surlignage des champs illisibles ou invalides */}
                  {(hasScannedAttempt || attemptedSubmit) && currentValidation.hasInvalidOrMissingFields && (
                    <div className="p-2.5 rounded-[4px] bg-amber-50 border border-amber-300 text-[11px] text-amber-900 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        Les champs <strong>vides, illisibles ou invalides</strong> sont <strong>surlignés</strong> ci-dessous. Tous les champs obligatoires doivent être complétés et valides ({currentValidation.remainingCount} {currentValidation.remainingCount > 1 ? 'champs restants' : 'champ restant'}).
                      </span>
                    </div>
                  )}

                  {/* Grille des champs de l'étape « Informations personnelles » (nom, prénom, CIN, date et lieu de naissance, adresse, validité) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {fieldDefinitions.map(({ key, label, placeholder, hint, fullWidth }) => {
                      const fieldState = currentValidation.fields[key];
                      const isValid = fieldState?.isValid;
                      const isExpired = fieldState?.isExpired;
                      // Les messages d'erreur apparaissent après la tentative (scan ou validation) ou après avoir quitté le champ (onBlur), pas dès l'ouverture
                      const showError = Boolean(touchedFields[key] || attemptedSubmit || hasScannedAttempt) && !isValid;

                      return (
                        <div
                          key={key}
                          className={`${fullWidth ? 'sm:col-span-2' : ''} p-2.5 rounded-[6px] border transition-colors ${
                            showError && isExpired
                              ? 'bg-rose-50/90 border-rose-400 ring-2 ring-rose-300/60'
                              : showError
                                ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-300/60'
                                : isValid
                                  ? 'bg-emerald-50/30 border-emerald-300'
                                  : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-bold text-slate-800">
                              {label} <span className="text-rose-600">*</span>
                            </label>
                            {isValid ? (
                              <span className="text-[10px] font-bold text-[#16a34a] flex items-center gap-0.5">
                                <Check className="w-3 h-3 stroke-[2.5]" /> Valide
                              </span>
                            ) : showError ? (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-[3px] ${
                                  isExpired
                                    ? 'bg-rose-200 text-rose-900'
                                    : 'bg-amber-200 text-amber-950'
                                }`}
                              >
                                {isExpired ? 'Carte expirée' : 'Champ requis / Invalide'}
                              </span>
                            ) : null}
                          </div>

                          <input
                            type="text"
                            value={formValues[key]}
                            placeholder={placeholder}
                            onChange={(e) => handleFieldChange(key, e.target.value)}
                            onBlur={() => handleFieldBlur(key)}
                            className={`w-full px-2.5 py-1.5 rounded-[4px] border text-xs font-medium focus:outline-none focus:ring-2 ${
                              showError && isExpired
                                ? 'border-rose-400 bg-white text-rose-950 focus:ring-rose-500'
                                : showError
                                  ? 'border-amber-400 bg-white text-slate-900 focus:ring-amber-500'
                                  : 'border-slate-200 bg-white text-slate-900 focus:ring-[#0f766e]'
                            } ${key === 'cin' ? 'font-mono uppercase' : ''}`}
                          />

                          {showError && fieldState?.errorMessage ? (
                            <p
                              className={`text-[10px] mt-1 font-semibold leading-snug ${
                                isExpired ? 'text-rose-700' : 'text-amber-800'
                              }`}
                            >
                              {fieldState.errorMessage}
                            </p>
                          ) : (
                            <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Case de vérification obligatoire par le candidat avant de pouvoir continuer (Point 6) */}
                  <label className="flex items-start gap-2.5 p-3 rounded-[6px] bg-white border border-slate-300 hover:border-[#0f766e] cursor-pointer transition select-none mt-2">
                    <input
                      type="checkbox"
                      checked={candidateVerifiedFields}
                      onChange={(e) => setCandidateVerifiedFields(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#0f766e] rounded cursor-pointer shrink-0"
                    />
                    <span className="text-xs font-bold text-slate-800 leading-snug">
                      J&apos;ai vérifié et, le cas échéant, corrigé chacun des champs de l&apos;étape « Informations personnelles » (nom, prénom, CIN, date et lieu de naissance, adresse) ci-dessus.
                    </span>
                  </label>
                </>
              )}
            </form>
          )}

          {/* Input caché pour l'alternative obligatoire « Importer une photo » (galerie) */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={handleImportGalleryPhoto}
            className="hidden"
          />

          {/* Barre d'actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              {/* Bouton Annuler qui coupe immédiatement le flux vidéo et ferme l'écran de scan (Point 3) */}
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  onClose();
                }}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[6px] text-xs font-bold cursor-pointer transition"
              >
                Annuler
              </button>

              {!manualEntryMode && (
                <>
                  {!currentFacePhoto ? (
                    <button
                      type="button"
                      onClick={handleManualCapture}
                      disabled={!cameraActive}
                      className="px-4 py-2.5 bg-[#0f766e] hover:bg-[#115e59] disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-[6px] text-xs font-bold flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed transition shadow-2xs"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Prendre la photo ({activeFace})</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (activeFace === 'RECTO') setRectoPhoto(null);
                        else setVersoPhoto(null);
                        setRefusalMessage(null);
                        setSuccessBanner(null);
                        startCamera();
                      }}
                      className="px-3.5 py-2 bg-white border border-slate-300 hover:border-[#0f766e] text-slate-700 rounded-[6px] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reprendre la photo ({activeFace})</span>
                    </button>
                  )}
                </>
              )}

              {/* Alternative obligatoire : bouton « Importer une photo » (galerie) */}
              <button
                type="button"
                onClick={() => {
                  if (galleryInputRef.current) {
                    galleryInputRef.current.value = '';
                    galleryInputRef.current.click();
                  }
                }}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-[6px] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
              >
                <Upload className="w-4 h-4 text-[#0f766e]" />
                <span>Importer une photo</span>
              </button>

              {/* Repli saisie manuelle des champs */}
              {!manualEntryMode && (
                <button
                  type="button"
                  onClick={activerSaisieManuelle}
                  className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-[6px] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#0f766e]" />
                  <span>Saisie manuelle des champs</span>
                </button>
              )}
            </div>

            <button
              type="button"
              disabled={
                !consentChecked ||
                (!rectoPhoto && !manualEntryMode) ||
                isGeneratingPdf ||
                isExtractingOcr ||
                !currentValidation.allValid ||
                !candidateVerifiedFields
              }
              onClick={handleValiderDansDossier}
              className="px-4 py-2.5 bg-[#16a34a] hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-[6px] text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition shadow-2xs"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>
                {isGeneratingPdf
                  ? 'Enregistrement...'
                  : 'Valider / Enregistrer et continuer'}
              </span>
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

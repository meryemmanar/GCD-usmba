/// <reference types="vite/client" />
import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Download, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  Printer, 
  ZoomIn, 
  ZoomOut,
  ShieldCheck,
  Loader2,
  AlertCircle
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configuration du worker PDF.js local (via Vite asset URL)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface ModalVisualiseurPdfProps {
  isOpen: boolean;
  docTitle: string;
  fileName: string;
  pdfUrl?: string;
  pageCount?: number;
  statut?: string;
  motifRejet?: string;
  candidatNom?: string;
  cin?: string;
  onClose: () => void;
}

/**
 * Convertit une Data URL (data:application/pdf;base64,...) ou une URL en Uint8Array binaire exact.
 */
async function getPdfBytesFromUrl(url: string): Promise<Uint8Array> {
  if (url.startsWith('data:')) {
    const base64Marker = ';base64,';
    const base64Index = url.indexOf(base64Marker);
    const base64 = base64Index !== -1 ? url.substring(base64Index + base64Marker.length) : url.split(',')[1] || '';
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

interface PdfPageCanvasProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  totalPages: number;
  scale: number;
  isCin: boolean;
}

/**
 * Composant qui rend une page réelle du document PDF téléversé sur un élément <canvas>.
 */
const PdfPageCanvas: React.FC<PdfPageCanvasProps> = ({
  pdfDoc,
  pageNumber,
  totalPages,
  scale,
  isCin
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let renderTask: pdfjsLib.RenderTask | null = null;

    const renderPage = async () => {
      if (!canvasRef.current) return;
      setRendering(true);
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled || !canvasRef.current) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale });
        const outputViewport = page.getViewport({ scale: scale * dpr });

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = Math.floor(outputViewport.width);
        canvas.height = Math.floor(outputViewport.height);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        renderTask = page.render({
          canvasContext: context,
          viewport: outputViewport,
          canvas
        });

        await renderTask.promise;
      } catch (err: unknown) {
        // Ignorer l'annulation normale lors d'un changement de zoom
        if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'RenderingCancelledException') {
          return;
        }
        console.error(`Erreur de rendu de la page ${pageNumber} :`, err);
      } finally {
        if (!cancelled) {
          setRendering(false);
        }
      }
    };

    renderPage();

    return () => {
      cancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [pdfDoc, pageNumber, scale]);

  return (
    <div className="flex flex-col items-center space-y-2 w-full">
      <div className="flex items-center justify-between w-full max-w-3xl px-2 text-xs font-bold text-slate-600">
        <span>
          {isCin
            ? pageNumber === 1
              ? `Page 1 / ${totalPages} — Recto`
              : pageNumber === 2
                ? `Page 2 / ${totalPages} — Verso`
                : `Page ${pageNumber} / ${totalPages}`
            : `Page ${pageNumber} sur ${totalPages}`}
        </span>
        {rendering && (
          <span className="inline-flex items-center gap-1 text-[#0f766e]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Rendu de la page...</span>
          </span>
        )}
      </div>

      <div className="bg-white rounded-[6px] shadow-md border border-slate-300 p-2 overflow-x-auto max-w-full flex justify-center">
        <canvas ref={canvasRef} className="block max-w-full h-auto" />
      </div>
    </div>
  );
};

export const ModalVisualiseurPdf: React.FC<ModalVisualiseurPdfProps> = ({
  isOpen,
  docTitle,
  fileName,
  pdfUrl,
  pageCount = 1,
  statut,
  motifRejet,
  candidatNom,
  onClose
}) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(pageCount || 1);
  const [selectedPage, setSelectedPage] = useState<'ALL' | number>('ALL');
  const [scale, setScale] = useState<number>(1.25);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const isCin = docTitle.toLowerCase().includes('cin') || docTitle.toLowerCase().includes('identité');

  // Chargement du véritable fichier PDF binaire téléversé par le candidat
  useEffect(() => {
    if (!isOpen || !pdfUrl) {
      setPdfDoc(null);
      setLoadError(null);
      return;
    }

    let active = true;
    let currentBlobUrl: string | null = null;
    let loadedDocument: pdfjsLib.PDFDocumentProxy | null = null;
    let loadingTaskRef: pdfjsLib.PDFDocumentLoadingTask | null = null;

    const loadPdf = async () => {
      setLoading(true);
      setLoadError(null);
      setSelectedPage('ALL');

      try {
        const bytes = await getPdfBytesFromUrl(pdfUrl);
        if (!active) return;

        // Création d'un Blob URL pour le téléchargement fidèle du fichier original
        const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
        currentBlobUrl = URL.createObjectURL(blob);
        setBlobUrl(currentBlobUrl);

        // Chargement du document avec PDF.js à partir d'une copie du buffer
        const bytesCopy = new Uint8Array(bytes);
        const loadingTask = pdfjsLib.getDocument({ data: bytesCopy });
        loadingTaskRef = loadingTask;
        const doc = await loadingTask.promise;

        if (!active) {
          await doc.cleanup();
          await loadingTask.destroy();
          return;
        }

        loadedDocument = doc;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
      } catch (err) {
        console.error("Erreur lors de la lecture du fichier PDF :", err);
        if (active) {
          setLoadError("Impossible d'afficher ce fichier PDF. Le document est peut-être endommagé.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      active = false;
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
      if (loadedDocument) {
        loadedDocument.cleanup();
      }
      if (loadingTaskRef) {
        loadingTaskRef.destroy();
      }
    };
  }, [isOpen, pdfUrl]);

  if (!isOpen) return null;

  // Téléchargement exact du fichier PDF téléversé par le candidat
  const handleDownload = () => {
    const targetUrl = blobUrl || pdfUrl;
    if (!targetUrl) return;
    const a = document.createElement('a');
    a.href = targetUrl;
    a.download = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const pagesToRender =
    selectedPage === 'ALL'
      ? Array.from({ length: numPages }, (_, i) => i + 1)
      : [selectedPage];

  return (
    <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white w-full max-w-5xl max-h-[94vh] rounded-[6px] shadow-2xl border border-slate-300 flex flex-col overflow-hidden my-auto">
        
        {/* ==================================================================== */}
        {/* EN-TÊTE DU VISUALISEUR                                              */}
        {/* ==================================================================== */}
        <div className="bg-[#0f766e] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-[4px] bg-white/10 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-teal-200" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm truncate font-serif text-white">{docTitle}</h3>
                <span className="px-2 py-0.5 rounded-[4px] bg-teal-900/60 text-teal-100 text-[10px] font-mono font-bold flex items-center gap-1 shrink-0">
                  <Layers className="w-3 h-3 text-teal-300" />
                  {numPages} page{numPages > 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-[11px] text-teal-100/90 truncate font-mono">
                Fichier déposé : {fileName} {candidatNom ? `• Candidat : ${candidatNom}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Contrôles de zoom sur les pages du PDF */}
            <div className="hidden sm:flex items-center bg-teal-900/50 rounded-[4px] p-0.5 border border-teal-600/40">
              <button
                type="button"
                onClick={() => setScale(prev => Math.max(0.75, Number((prev - 0.25).toFixed(2))))}
                className="p-1.5 rounded text-xs text-teal-100 hover:text-white hover:bg-white/15 cursor-pointer"
                title="Réduire le zoom"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 text-[11px] font-mono font-bold text-white tabular-nums">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setScale(prev => Math.min(2.25, Number((prev + 0.25).toFixed(2))))}
                className="p-1.5 rounded text-xs text-teal-100 hover:text-white hover:bg-white/15 cursor-pointer"
                title="Agrandir le zoom"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Imprimer */}
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-[6px] bg-white/15 hover:bg-white/25 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
              title="Imprimer cette pièce"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Imprimer</span>
            </button>

            {/* Télécharger le PDF original */}
            {pdfUrl && (
              <button
                type="button"
                onClick={handleDownload}
                className="px-3 py-1.5 rounded-[6px] bg-white text-[#0f766e] hover:bg-teal-50 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                title="Télécharger le fichier PDF original déposé"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Télécharger le PDF</span>
              </button>
            )}

            {/* Fermer */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-teal-100 hover:text-white rounded-[4px] hover:bg-white/10 cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* BARRE D'ÉTAT & NAVIGATION DES PAGES RÉELLES DU PDF                   */}
        {/* ==================================================================== */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-2.5 flex flex-wrap items-center justify-between text-xs gap-3 shrink-0">
          
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600">Statut de la pièce :</span>
            {statut === 'VALIDE' && (
              <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-emerald-50 text-[#16a34a] border border-[#16a34a]/30 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-[#16a34a]" /> Validé
              </span>
            )}
            {statut === 'REJETE' && (
              <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-300 inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-600" /> Rejeté
              </span>
            )}
            {statut === 'EN_ATTENTE' && (
              <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                En attente de contrôle
              </span>
            )}
            {(!statut || statut === 'NON_DEPOSE') && (
              <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                Non déposé
              </span>
            )}
          </div>

          {/* Sélecteur de pages du fichier PDF téléversé */}
          {numPages > 1 && (
            <div className="flex flex-wrap items-center gap-1 bg-white border border-slate-300 rounded-[6px] p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setSelectedPage('ALL')}
                className={`px-2.5 py-1 rounded-[4px] text-xs font-bold transition cursor-pointer ${
                  selectedPage === 'ALL'
                    ? 'bg-[#0f766e] text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Toutes les pages ({numPages})
              </button>
              {Array.from({ length: numPages }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setSelectedPage(num)}
                  className={`px-2.5 py-1 rounded-[4px] text-xs font-bold transition cursor-pointer ${
                    selectedPage === num
                      ? 'bg-[#0f766e] text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {isCin ? (num === 1 ? 'Page 1 (Recto)' : num === 2 ? 'Page 2 (Verso)' : `Page ${num}`) : `Page ${num}`}
                </button>
              ))}
            </div>
          )}

          {isCin && numPages >= 2 && (
            <div className="text-[11px] font-bold text-[#0f766e] bg-[#f0fdfa] border border-[#ccfbf1] px-2.5 py-1 rounded-[4px] inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Document PDF multi-pages ({numPages} pages)
            </div>
          )}
        </div>

        {/* Motif de rejet éventuel */}
        {statut === 'REJETE' && motifRejet && (
          <div className="bg-rose-50 border-b border-rose-200 px-5 py-2.5 text-xs text-rose-800 flex items-start gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">Motif du rejet :</strong>
              <p className="text-[11px] text-rose-900 mt-0.5 leading-relaxed">{motifRejet}</p>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* ZONE DE RENDU FIDÈLE DU FICHIER PDF TÉLÉVERSÉ PAR LE CANDIDAT       */}
        {/* ==================================================================== */}
        <div className="flex-1 bg-slate-200/80 p-4 sm:p-6 overflow-y-auto flex flex-col items-center space-y-6">
          {loading && (
            <div className="py-16 flex flex-col items-center justify-center space-y-3 text-slate-700">
              <Loader2 className="w-8 h-8 text-[#0f766e] animate-spin" />
              <p className="text-sm font-bold">Chargement du fichier PDF original ({fileName})...</p>
            </div>
          )}

          {!loading && loadError && (
            <div className="bg-white p-8 rounded-[6px] border border-rose-300 max-w-lg text-center space-y-3 shadow-sm">
              <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
              <h4 className="font-bold text-sm text-slate-900">{loadError}</h4>
              {pdfUrl && (
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-4 py-2 bg-[#0f766e] text-white rounded-[6px] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Télécharger le fichier PDF</span>
                </button>
              )}
            </div>
          )}

          {!loading && !loadError && pdfDoc && (
            <div className="w-full flex flex-col items-center space-y-6">
              {pagesToRender.map((pageNumber) => (
                <PdfPageCanvas
                  key={pageNumber}
                  pdfDoc={pdfDoc}
                  pageNumber={pageNumber}
                  totalPages={numPages}
                  scale={scale}
                  isCin={isCin}
                />
              ))}
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* PIED DE PAGE DU MODAL                                               */}
        {/* ==================================================================== */}
        <div className="bg-white px-5 py-3 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2 shrink-0">
          <span className="text-[11px] text-slate-500 font-sans text-center sm:text-left">
            Affichage direct du fichier PDF téléversé : <strong>{fileName}</strong> ({numPages} page{numPages > 1 ? 's' : ''})
          </span>
          <div className="flex items-center gap-2">
            {pdfUrl && (
              <button
                type="button"
                onClick={handleDownload}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[6px] text-xs font-bold cursor-pointer transition shadow-2xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger ({fileName})</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-[6px] text-xs font-bold cursor-pointer transition shadow-xs"
            >
              Fermer l'aperçu
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

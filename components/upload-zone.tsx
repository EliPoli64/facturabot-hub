'use client';

import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AlertCircle,
  ImageUp,
  Loader2,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import type { UploadResult, UploadState } from '@/lib/dashboard-types';
import { formatCurrency, getUploadWidthClass } from '@/lib/dashboard-utils';

interface UploadZoneProps {
  onUploadComplete: () => void;
}

export default function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let progressTimer: number | null = null;

    if (uploadState === 'uploading') {
      progressTimer = window.setInterval(() => {
        setUploadProgress((current) => (current >= 88 ? current : current + 6));
      }, 180);
    }

    return () => {
      if (progressTimer) window.clearInterval(progressTimer);
    };
  }, [uploadState]);

  function resetUploadState(): void {
    setUploadState('idle');
    setUploadProgress(0);
    setUploadFileName('');
    setUploadError('');
    setUploadResult(null);
  }

  async function processUpload(file: File): Promise<void> {
    const lowerName = file.name.toLowerCase();
    const isXml = lowerName.endsWith('.xml');
    const isPdf = lowerName.endsWith('.pdf');
    const isImage = /\.(jpg|jpeg|png|webp)$/i.test(lowerName);

    if (!isXml && !isPdf && !isImage) {
      setUploadState('error');
      setUploadError('Solo se aceptan archivos XML, PDF o imagenes.');
      return;
    }

    setUploadState('uploading');
    setUploadFileName(file.name);
    setUploadProgress(12);
    setUploadError('');
    setUploadResult(null);

    let ocrTimer: number | null = null;

    try {
      if (isImage || isPdf) {
        ocrTimer = window.setTimeout(() => {
          setUploadState('processing_ocr');
          setUploadProgress(74);
        }, 500);
      }

      const formData = new FormData();
      formData.append('file', file);

      const endpoint = isXml ? '/api/factura/xml' : isPdf ? '/api/factura/pdf' : '/api/factura/image';
      let response = await fetch(endpoint, { method: 'POST', body: formData });

      if (isXml && !response.ok) {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/xml' },
          body: await file.text(),
        });
      }

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        type?: string;
        data?: { merchantName?: string; subTotal?: number };
      };

      if (!response.ok) {
        throw new Error(payload.error || 'No se pudo procesar el archivo.');
      }

      setUploadProgress(100);
      setUploadState('success');
      setUploadResult({
        typeLabel:
          payload.type === 'PURCHASE'
            ? 'Compra registrada'
            : payload.type === 'SALE'
              ? 'Venta registrada'
              : 'Registro completado',
        summary:
          payload.data?.merchantName && payload.data?.subTotal
            ? `Compra a ${payload.data.merchantName} · ${formatCurrency(payload.data.subTotal)}`
            : payload.type === 'SALE'
              ? 'Venta registrada · Factura procesada'
              : payload.message || 'Documento integrado correctamente',
      });

      window.setTimeout(() => resetUploadState(), 3000);
      onUploadComplete();
    } catch (error) {
      setUploadState('error');
      setUploadError(error instanceof Error ? error.message : 'Ocurrio un error inesperado.');
      setUploadProgress(0);
    } finally {
      if (ocrTimer) window.clearTimeout(ocrTimer);
    }
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>): void {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;
    void processUpload(nextFile);
    event.target.value = '';
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    if (uploadState !== 'uploading' && uploadState !== 'processing_ocr') {
      setUploadState('dragging');
    }
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    if (uploadState === 'dragging') setUploadState('idle');
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file) {
      setUploadState('idle');
      return;
    }
    void processUpload(file);
  }

  function renderContent() {
    if (uploadState === 'uploading') {
      return (
        <div className="flex flex-col items-center gap-3 text-center" role="status" aria-live="polite">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-100">Procesando {uploadFileName}...</p>
            <p className="text-xs text-slate-400">Preparando datos para FacturaBot. {Math.round(uploadProgress)}%</p>
          </div>
        </div>
      );
    }

    if (uploadState === 'processing_ocr') {
      return (
        <div className="flex flex-col items-center gap-3 text-center" role="status" aria-live="polite">
          <div className="flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs text-indigo-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            OCR + IA
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-100">Extrayendo texto con OCR...</p>
            <p className="text-xs text-slate-400">Limpiando con IA para registrar la transaccion. {Math.round(uploadProgress)}%</p>
          </div>
        </div>
      );
    }

    if (uploadState === 'success' && uploadResult) {
      return (
        <div className="flex flex-col items-center gap-3 text-center" aria-live="polite">
          <ShieldCheck className="h-12 w-12 text-emerald-400" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-emerald-300">¡Registrado!</p>
            <p className="text-sm text-slate-100">{uploadResult.typeLabel}</p>
            <p className="text-xs text-slate-400">{uploadResult.summary}</p>
          </div>
        </div>
      );
    }

    if (uploadState === 'error') {
      return (
        <div className="flex flex-col items-center gap-3 text-center" aria-live="polite">
          <AlertCircle className="h-12 w-12 text-rose-400" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-rose-300">No se pudo registrar</p>
            <p className="text-xs text-slate-400">{uploadError}</p>
          </div>
          <button
            type="button"
            onClick={resetUploadState}
            className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:border-rose-400/40 hover:bg-rose-500/20"
          >
            Intentar de nuevo
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-4 text-center">
        {uploadState === 'dragging' ? (
          <ImageUp className="h-12 w-12 text-indigo-400" />
        ) : (
          <Upload className="h-12 w-12 text-slate-600 dark:text-slate-500" />
        )}
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-100">
            {uploadState === 'dragging' ? 'Solta para subir' : 'Arrastra tu factura aqui'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            XML del Ministerio de Hacienda, PDF o foto de recibo (JPG, PNG, WEBP)
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-950"
        >
          Seleccionar archivo
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex min-h-[180px] flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-slate-50/80 px-6 py-7 transition-transform duration-200 dark:bg-slate-900/50 ${
        uploadState === 'dragging'
          ? 'scale-[1.02] border-indigo-500 bg-indigo-500/10'
          : uploadState === 'success'
            ? 'border-emerald-500 bg-emerald-500/10 animate-glow-pulse'
            : uploadState === 'error'
              ? 'border-rose-500 bg-rose-500/10'
              : 'border-slate-300 dark:border-slate-700'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xml,.pdf,.jpg,.jpeg,.png,.webp"
        onChange={handleFileInputChange}
        className="hidden"
      />
      {renderContent()}
      {(uploadState === 'uploading' || uploadState === 'processing_ocr') && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-slate-200 dark:bg-slate-800">
          <div
            className={`h-full rounded-full ${getUploadWidthClass(uploadProgress)} ${
              uploadState === 'processing_ocr' ? 'bg-indigo-400' : 'bg-indigo-500'
            } transition-all duration-300`}
          />
        </div>
      )}
    </div>
  );
}

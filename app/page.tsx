'use client';

import {
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  AlertCircle,
  Bell,
  BellRing,
  Bot,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  Database,
  Download,
  FileDown,
  FileSpreadsheet,
  ImageUp,
  Loader2,
  Moon,
  Receipt,
  RefreshCw,
  Search,
  SendHorizonal,
  ShieldCheck,
  Sun,
  TriangleAlert,
  TrendingUp,
  Upload,
  Wallet,
} from 'lucide-react';

type UploadState =
  | 'idle'
  | 'dragging'
  | 'uploading'
  | 'processing_ocr'
  | 'success'
  | 'error';

interface KPIData {
  salesToday: number;
  balance: number;
  activeAlerts: number;
  transactionsToday: number;
  purchasesToday: number;
  salesCountToday: number;
  deltaVsYesterday: number;
  lastUpdatedMinutes: number;
}

interface InventoryItem {
  sku: string;
  name: string;
  currentStock: number;
  purchasePrice: number;
  salePrice: number;
  status: 'ok' | 'lowStock';
}

interface AlertItem {
  sku: string;
  message: string;
  productName: string;
  daysOfStock: number;
  isActive: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

interface UploadResult {
  typeLabel: string;
  summary: string;
}

interface SectionErrors {
  kpis: string | null;
  alerts: string | null;
  chat: string | null;
}

type SortKey =
  | 'sku'
  | 'name'
  | 'currentStock'
  | 'purchasePrice'
  | 'salePrice'
  | 'margin';

type SortDirection = 'asc' | 'desc' | null;

const currencyFormatter = new Intl.NumberFormat('es-CR', {
  style: 'currency',
  currency: 'CRC',
  maximumFractionDigits: 0,
});



const quickChips = [
  '📊 Resumen de hoy',
  '🚨 Ver alertas',
  '💰 Balance de caja',
  '📦 Stock crítico',
];

const animationDelayClasses = [
  '[animation-delay:0ms]',
  '[animation-delay:50ms]',
  '[animation-delay:100ms]',
  '[animation-delay:150ms]',
  '[animation-delay:200ms]',
  '[animation-delay:250ms]',
  '[animation-delay:300ms]',
  '[animation-delay:350ms]',
  '[animation-delay:400ms]',
  '[animation-delay:450ms]',
];

const initialBotMessage: ChatMessage = {
  id: 'welcome-message',
  role: 'bot',
  content:
    '¡Hola! Soy FacturaBot. Puedo mostrarte el resumen de ventas de hoy, las alertas de inventario y el balance de caja. ¿En qué te ayudo?',
  timestamp: new Date(),
};

function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatCurrency(value: number): string {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatTimestamp(value: Date): string {
  return value.toLocaleTimeString('es-CR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getMarginPercent(item: InventoryItem): number {
  if (item.salePrice <= 0) {
    return 0;
  }

  return ((item.salePrice - item.purchasePrice) / item.salePrice) * 100;
}

function getMarginTone(margin: number): string {
  if (margin > 20) {
    return 'text-emerald-400';
  }

  if (margin >= 10) {
    return 'text-amber-400';
  }

  return 'text-rose-400';
}

function getUploadWidthClass(progress: number): string {
  if (progress >= 95) {
    return 'w-full';
  }

  if (progress >= 80) {
    return 'w-5/6';
  }

  if (progress >= 60) {
    return 'w-2/3';
  }

  if (progress >= 40) {
    return 'w-1/2';
  }

  if (progress >= 20) {
    return 'w-1/3';
  }

  return 'w-1/6';
}

function parseFirstJson<T>(source: string): T | null {
  const cleaned = source.replace(/```json|```/gi, '').trim();

  const directJsonStart = cleaned[0];
  if (directJsonStart === '{' || directJsonStart === '[') {
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      return null;
    }
  }

  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]) as T;
    } catch {
      return null;
    }
  }

  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]) as T;
    } catch {
      return null;
    }
  }

  return null;
}

async function requestChat(message: string): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  });

  const payload = (await response.json()) as { text?: string; error?: string };

  if (!response.ok) {
    throw new Error(payload.error || 'No fue posible obtener datos del asistente.');
  }

  return payload.text || '';
}

function RobotLogo(): ReactNode {
  return (
    <svg
      aria-hidden="true"
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="4" y="7" width="16" height="11" rx="4" className="fill-indigo-500/20 stroke-indigo-400" />
      <path d="M12 4V7" className="stroke-slate-400" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="9" cy="12" r="1.25" className="fill-indigo-300" />
      <circle cx="15" cy="12" r="1.25" className="fill-indigo-300" />
      <path d="M9 15.2C9.9 16 10.9 16.4 12 16.4C13.1 16.4 14.1 16 15 15.2" className="stroke-slate-300" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function DashboardPage() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);
  const [businessName, setBusinessName] = useState('FacturaBot CR');
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleRows, setVisibleRows] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey>('currentStock');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([initialBotMessage]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [mongoConnected, setMongoConnected] = useState(false);
  const [telegramActive, setTelegramActive] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [kpiData, setKpiData] = useState<KPIData>({
    salesToday: 0,
    balance: 0,
    activeAlerts: 0,
    transactionsToday: 0,
    purchasesToday: 0,
    salesCountToday: 0,
    deltaVsYesterday: 12,
    lastUpdatedMinutes: 0,
  });
  const [sectionErrors, setSectionErrors] = useState<SectionErrors>({
    kpis: null,
    alerts: null,
    chat: null,
  });

  const alertsSectionRef = useRef<HTMLElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const businessNameRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('facturabotTheme');
    const nextDarkMode = storedTheme ? storedTheme === 'dark' : true;
    setIsDarkMode(nextDarkMode);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    window.localStorage.setItem('facturabotTheme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    const savedBusinessName = window.localStorage.getItem('facturabotBusinessName');
    if (savedBusinessName) {
      setBusinessName(savedBusinessName);
    }
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1280px)');
    const updateBreakpoint = () => {
      const desktop = mediaQuery.matches;
      setIsDesktop(desktop);
      if (desktop) {
        setUnreadCount(0);
        setIsChatOpen(false);
      }
    };

    updateBreakpoint();
    mediaQuery.addEventListener('change', updateBreakpoint);

    return () => mediaQuery.removeEventListener('change', updateBreakpoint);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatLoading]);

  useEffect(() => {
    if (isChatOpen && !isDesktop) {
      setUnreadCount(0);
      window.setTimeout(() => {
        chatInputRef.current?.focus();
      }, 180);
    }
  }, [isChatOpen, isDesktop]);

  useEffect(() => {
    let progressTimer: number | null = null;

    if (uploadState === 'uploading') {
      progressTimer = window.setInterval(() => {
        setUploadProgress((current) => {
          if (current >= 88) {
            return current;
          }

          return current + 6;
        });
      }, 180);
    }

    return () => {
      if (progressTimer) {
        window.clearInterval(progressTimer);
      }
    };
  }, [uploadState]);

  const loadDashboardData = useCallback(async (): Promise<void> => {
    setKpiLoading(true);
    setAlertsLoading(true);
    setSectionErrors((current) => ({
      ...current,
      kpis: null,
      alerts: null,
    }));

    const [statsResult, alertsResult, inventoryResult] = await Promise.allSettled([
      fetch('/api/stats'),
      fetch('/api/alerts'),
      fetch('/api/inventory'),
    ]);

    let fetchedInventory: InventoryItem[] = [];
    if (inventoryResult.status === 'fulfilled') {
      fetchedInventory = await inventoryResult.value.json();
      setInventoryItems(fetchedInventory);
    }

    if (statsResult.status === 'fulfilled') {
      const stats = await statsResult.value.json();
      setMongoConnected(true);
      setKpiData((current) => ({
        ...current,
        salesToday: stats.salesToday ?? 0,
        balance: stats.balance ?? 0,
        salesCountToday: stats.salesCountToday ?? 0,
        purchasesToday: stats.purchasesToday ?? 0,
        transactionsToday: stats.transactionsToday ?? 0,
        deltaVsYesterday: stats.deltaVsYesterday ?? 0,
        lastUpdatedMinutes: stats.lastUpdatedMinutes ?? 1,
      }));
    } else {
      setMongoConnected(false);
      setSectionErrors((current) => ({
        ...current,
        kpis: 'No fue posible cargar las metricas desde el motor de datos.',
      }));
    }

    if (alertsResult.status === 'fulfilled') {
      const rawAlerts = await alertsResult.value.json();

      const mappedAlerts: AlertItem[] = rawAlerts.map((item: { sku?: string; message?: string }) => {
        const product = fetchedInventory.find((inventoryItem) => inventoryItem.sku === item.sku);
        const estimatedDays = product ? Math.max(1, Math.ceil(product.currentStock / 2)) : 3;

        return {
          sku: item.sku || 'SKU',
          message: item.message || 'Producto en riesgo de quiebre',
          productName: product?.name || item.sku || 'Producto sin nombre',
          daysOfStock: estimatedDays,
          isActive: true,
        };
      });

      setTelegramActive(true);
      setAlerts(mappedAlerts);
      setKpiData((current) => ({
        ...current,
        activeAlerts: mappedAlerts.length,
      }));
    } else {
      setTelegramActive(false);
      setSectionErrors((current) => ({
        ...current,
        alerts: 'No se pudieron obtener las alertas activas del sistema.',
      }));
      setAlerts([]);
      setKpiData((current) => ({
        ...current,
        activeAlerts: 0,
      }));
    }

    setKpiLoading(false);
    setAlertsLoading(false);
  }, []);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  function handleBusinessNameSave(): void {
    const nextValue = businessNameRef.current?.textContent?.trim() || 'FacturaBot CR';
    setBusinessName(nextValue);
    window.localStorage.setItem('facturabotBusinessName', nextValue);
    if (businessNameRef.current) {
      businessNameRef.current.textContent = nextValue;
    }
  }

  function handleSort(nextKey: SortKey): void {
    if (sortKey !== nextKey) {
      setSortKey(nextKey);
      setSortDirection('asc');
      return;
    }

    if (sortDirection === 'asc') {
      setSortDirection('desc');
      return;
    }

    if (sortDirection === 'desc') {
      setSortDirection(null);
      return;
    }

    setSortDirection('asc');
  }

  const filteredInventory = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();

    const filtered = normalizedTerm
      ? inventoryItems.filter((item) => {
          return (
            item.name.toLowerCase().includes(normalizedTerm) ||
            item.sku.toLowerCase().includes(normalizedTerm)
          );
        })
      : inventoryItems;

    const sorted = [...filtered];

    if (!sortDirection) {
      return sorted;
    }

    sorted.sort((left, right) => {
      const leftValue =
        sortKey === 'margin'
          ? getMarginPercent(left)
          : left[sortKey as keyof InventoryItem];
      const rightValue =
        sortKey === 'margin'
          ? getMarginPercent(right)
          : right[sortKey as keyof InventoryItem];

      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        return sortDirection === 'asc' ? leftValue - rightValue : rightValue - leftValue;
      }

      const leftText = String(leftValue).toLowerCase();
      const rightText = String(rightValue).toLowerCase();

      if (leftText < rightText) {
        return sortDirection === 'asc' ? -1 : 1;
      }

      if (leftText > rightText) {
        return sortDirection === 'asc' ? 1 : -1;
      }

      return 0;
    });

    return sorted;
  }, [inventoryItems, searchTerm, sortKey, sortDirection]);

  const visibleInventory = filteredInventory.slice(0, visibleRows);

  function renderSortIcon(column: SortKey): ReactNode {
    if (sortKey !== column || !sortDirection) {
      return <ChevronDown className="h-3.5 w-3.5 text-slate-600 dark:text-slate-500" />;
    }

    return sortDirection === 'asc' ? (
      <ChevronUp className="h-3.5 w-3.5 text-indigo-400" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5 text-indigo-400" />
    );
  }

  function isAlertedSku(sku: string): boolean {
    return alerts.some((alert) => alert.sku === sku && alert.isActive);
  }

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
    const isImage = /\.(jpg|jpeg|png|webp)$/i.test(lowerName);

    if (!isXml && !isImage) {
      setUploadState('error');
      setUploadError('Solo se aceptan archivos XML o imagenes.');
      return;
    }

    setUploadState('uploading');
    setUploadFileName(file.name);
    setUploadProgress(12);
    setUploadError('');
    setUploadResult(null);

    let ocrTimer: number | null = null;

    try {
      if (isImage) {
        ocrTimer = window.setTimeout(() => {
          setUploadState('processing_ocr');
          setUploadProgress(74);
        }, 500);
      }

      const formData = new FormData();
      formData.append('file', file);

      const endpoint = isXml ? '/api/factura/xml' : '/api/factura/image';
      let response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (isXml && !response.ok) {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/xml',
          },
          body: await file.text(),
        });
      }

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        type?: string;
        data?: {
          merchantName?: string;
          subTotal?: number;
        };
      };

      if (!response.ok) {
        throw new Error(payload.error || 'No se pudo procesar el archivo.');
      }

      setUploadProgress(100);
      setUploadState('success');
      setUploadResult({
        typeLabel: payload.type === 'PURCHASE' ? 'Compra registrada' : payload.type === 'SALE' ? 'Venta registrada' : 'Registro completado',
        summary:
          payload.data?.merchantName && payload.data?.subTotal
            ? `Compra a ${payload.data.merchantName} · ${formatCurrency(payload.data.subTotal)}`
            : payload.type === 'SALE'
              ? 'Venta registrada · Factura procesada'
              : payload.message || 'Documento integrado correctamente',
      });

      window.setTimeout(() => {
        resetUploadState();
      }, 3000);

      void loadDashboardData();
    } catch (error) {
      setUploadState('error');
      setUploadError(error instanceof Error ? error.message : 'Ocurrio un error inesperado.');
      setUploadProgress(0);
    } finally {
      if (ocrTimer) {
        window.clearTimeout(ocrTimer);
      }
    }
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>): void {
    const nextFile = event.target.files?.[0];
    if (!nextFile) {
      return;
    }

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
    if (uploadState === 'dragging') {
      setUploadState('idle');
    }
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

  function renderUploadContent(): ReactNode {
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
            XML del Ministerio de Hacienda o foto de recibo (JPG, PNG, WEBP)
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

  async function sendChatMessage(message: string): Promise<void> {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return;
    }

    const userMessage: ChatMessage = {
      id: generateId('user'),
      role: 'user',
      content: trimmedMessage,
      timestamp: new Date(),
    };

    setChatMessages((current) => [...current, userMessage]);
    setChatInput('');
    setIsChatLoading(true);
    setSectionErrors((current) => ({
      ...current,
      chat: null,
    }));

    try {
      const text = await requestChat(trimmedMessage);
      const botMessage: ChatMessage = {
        id: generateId('bot'),
        role: 'bot',
        content: text || 'No hubo respuesta del asistente.',
        timestamp: new Date(),
      };

      setChatMessages((current) => [...current, botMessage]);
      if (!isChatOpen && !isDesktop) {
        setUnreadCount((current) => current + 1);
      }
    } catch (error) {
      setSectionErrors((current) => ({
        ...current,
        chat: error instanceof Error ? error.message : 'No se pudo conectar con FacturaBot IA.',
      }));
      setChatMessages((current) => [
        ...current,
        {
          id: generateId('bot-error'),
          role: 'bot',
          content: 'No pude responder en este momento. Revisa la conexion con el backend e intentalo de nuevo.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  }

  function handleChatSubmit(): void {
    void sendChatMessage(chatInput);
  }

  function handleChatInputKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendChatMessage(chatInput);
    }
  }

  function renderMessageContent(content: string): ReactNode {
    const parts = content.split(/(₡\s?\d[\d.,]*)/g);

    const markdownParts = parts.map((part, index) => {
      if (/^₡\s?\d[\d.,]*$/.test(part)) {
        return (
          <span
            key={`${part}-${index}`}
            className="rounded bg-emerald-950 px-1 py-0.5 font-mono tabular-nums text-emerald-300"
          >
            {part}
          </span>
        );
      }

      return (
        <span key={`${part}-${index}`} className="[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-semibold [&_strong]:text-slate-100 [&_hr]:border-slate-700 [&_hr]:my-2 [&_p]:leading-6 [&_p]:my-0 [&_code]:rounded [&_code]:bg-slate-700 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm [&_pre>code]:bg-slate-900 [&_pre]:rounded-lg [&_pre]:bg-slate-900 [&_pre]:p-3 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_a]:text-indigo-400 [&_a]:underline">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{part}</ReactMarkdown>
        </span>
      );
    });

    return <>{markdownParts}</>;
  }

  function renderKpiCard(
    title: string,
    value: ReactNode,
    subtitle: string,
    icon: ReactNode,
    iconTone: string,
    onClick?: () => void,
  ): ReactNode {
    if (kpiLoading) {
      return (
        <div className="w-full min-w-0 rounded-xl border border-slate-200/80 bg-white/95 p-5 shadow-sm shadow-slate-200/50 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-black/20">
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-24 rounded-md bg-slate-200 dark:bg-slate-800" />
            <div className="h-8 w-32 rounded-md bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 w-28 rounded-md bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={onClick}
        className="min-w-[160px] rounded-xl border border-slate-200/80 bg-white/95 p-5 text-left shadow-sm shadow-slate-200/50 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-500/50 hover:shadow-[0_0_0_1px_rgba(99,102,241,0.12),0_16px_40px_-20px_rgba(99,102,241,0.35)] dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-black/20"
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{title}</p>
            <div className="font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">{value}</div>
          </div>
          <div className={`rounded-xl border border-current/10 bg-current/10 p-2 ${iconTone}`}>{icon}</div>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
      </button>
    );
  }

  function renderTableHeader(label: string, column: SortKey): ReactNode {
    return (
      <button
        type="button"
        onClick={() => handleSort(column)}
        className="inline-flex items-center gap-1 transition hover:text-slate-200"
      >
        {label}
        {renderSortIcon(column)}
      </button>
    );
  }

  function renderChatPane(panelClassName: string, mobile: boolean): ReactNode {
    return (
      <div className={panelClassName}>
        <div className="flex h-12 items-center justify-between border-b border-slate-800 px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-100">FacturaBot IA</span>
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
            </div>
          </div>
          {!isDesktop && (
            <button
              type="button"
              onClick={() => setIsChatOpen(false)}
              aria-label="Cerrar chat"
              className="rounded-lg border border-slate-700 p-1.5 text-slate-400 transition hover:border-slate-600 hover:text-slate-100"
            >
              <AlertCircle className="hidden" />
              <ChevronDown className="h-4 w-4 md:hidden" />
              <CircleAlert className="hidden" />
              <span className="hidden md:inline">
                <ChevronRight className="h-4 w-4 rotate-180" />
              </span>
            </button>
          )}
        </div>

        {mobile && (
          <button
            type="button"
            onClick={() => setIsChatOpen(false)}
            aria-label="Cerrar chat"
            className="mx-auto mt-3 h-1.5 w-14 rounded-full bg-slate-700 md:hidden"
          />
        )}

        <div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
          <div className="space-y-4">
            {chatMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] ${message.role === 'user' ? '' : 'flex items-end gap-2'}`}>
                  {message.role === 'bot' && (
                    <div className="mb-5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                  )}
                  <div>
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                        message.role === 'user'
                          ? 'rounded-br-sm bg-indigo-600 text-white'
                          : 'rounded-bl-sm bg-slate-800 text-slate-100'
                      }`}
                    >
                      {renderMessageContent(message.content)}
                    </div>
                    <p className="mt-1 px-1 text-xs text-slate-500" suppressHydrationWarning>{formatTimestamp(message.timestamp)}</p>
                  </div>
                </div>
              </div>
            ))}

            {isChatLoading && (
              <div className="flex justify-start">
                <div className="flex items-end gap-2">
                  <div className="mb-5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                  <div className="rounded-2xl rounded-bl-sm bg-slate-800 px-4 py-3">
                    <div className="flex items-center gap-1.5" role="status" aria-label="FacturaBot esta escribiendo">
                      <span className="h-2 w-2 animate-bounce-dot rounded-full bg-slate-400 [animation-delay:0ms]" />
                      <span className="h-2 w-2 animate-bounce-dot rounded-full bg-slate-400 [animation-delay:150ms]" />
                      <span className="h-2 w-2 animate-bounce-dot rounded-full bg-slate-400 [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {sectionErrors.chat && (
          <div className="mx-4 mb-3 rounded-xl border border-rose-500/20 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
            {sectionErrors.chat}
          </div>
        )}

        <div className="border-t border-slate-800 px-4 py-3">
          <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
            {quickChips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => void sendChatMessage(chip)}
                className="whitespace-nowrap rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-700"
              >
                {chip}
              </button>
            ))}
          </div>
          <div className="relative">
            <input
              ref={chatInputRef}
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              onKeyDown={handleChatInputKeyDown}
              placeholder="Preguntale algo a FacturaBot..."
              className="h-11 w-full rounded-xl border border-slate-700 bg-slate-800 pl-4 pr-14 text-sm text-slate-100 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              type="button"
              onClick={handleChatSubmit}
              disabled={!chatInput.trim() || isChatLoading}
              aria-label="Enviar mensaje"
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <SendHorizonal className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-[#0F1117] dark:text-slate-100">
      <div className="border-b border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-[#0F1117]/90">
        <div className="mx-auto flex h-14 max-w-[1680px] items-center justify-between px-4 md:px-6 xl:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#161B27]">
              {RobotLogo()}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">FacturaBot</span>
              <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
                CR Edition
              </span>
            </div>
          </div>

          <div className="hidden xl:block">
            <span
              ref={businessNameRef}
              contentEditable
              suppressContentEditableWarning
              onBlur={handleBusinessNameSave}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleBusinessNameSave();
                  businessNameRef.current?.blur();
                }
              }}
              className="rounded-lg px-3 py-1 text-sm font-medium text-slate-500 outline-none ring-0 transition hover:bg-slate-100 focus:bg-slate-100 focus:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:focus:bg-slate-900 dark:focus:text-white"
            >
              {businessName}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div
              title={mongoConnected ? 'Base de datos: Conectada' : 'Base de datos: Error'}
              className="group hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 shadow-sm dark:border-slate-800 dark:bg-[#161B27] dark:text-slate-300 md:flex"
            >
              <span className="relative flex h-2.5 w-2.5">
                {mongoConnected && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${mongoConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
              </span>
              <Database className="h-3.5 w-3.5" />
            </div>
            <div
              title={telegramActive ? 'Bot Telegram: Activo' : 'Bot Telegram: Inactivo'}
              className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 shadow-sm dark:border-slate-800 dark:bg-[#161B27] dark:text-slate-300 md:flex"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${telegramActive ? 'bg-emerald-400' : 'bg-slate-500'}`} />
              <Bot className="h-3.5 w-3.5" />
            </div>
            <button
              type="button"
              aria-label="Notificaciones"
              className="relative rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:border-slate-300 dark:border-slate-800 dark:bg-[#161B27] dark:text-slate-300 dark:hover:border-slate-700"
            >
              <Bell className="h-4.5 w-4.5" />
              {alerts.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                  {alerts.length}
                </span>
              )}
            </button>
            <button
              type="button"
              aria-label="Cambiar tema"
              onClick={() => setIsDarkMode((current) => !current)}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:border-slate-300 dark:border-slate-800 dark:bg-[#161B27] dark:text-slate-300 dark:hover:border-slate-700"
            >
              {isDarkMode ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1680px] px-4 py-4 md:px-6 md:py-6 xl:px-8">
        <div className="mb-5 xl:hidden">
          <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm dark:border-slate-800 dark:bg-[#161B27] dark:text-slate-300">
            {businessName}
          </span>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-[1fr_2fr_360px] xl:items-start">
          <section className="order-2 space-y-5 md:order-1 xl:order-1">
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
                accept=".xml,.jpg,.jpeg,.png,.webp"
                onChange={handleFileInputChange}
                className="hidden"
              />
              {renderUploadContent()}
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

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
              <div className="flex flex-col gap-3 border-b border-slate-200/80 px-4 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Inventario</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Mostrando {visibleInventory.length} de {filteredInventory.length} productos
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="/api/export/inventory?format=pdf"
                    aria-label="Exportar inventario PDF"
                    className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700"
                  >
                    <FileDown className="h-4 w-4 text-indigo-500" />
                  </a>
                  <div className="relative w-full sm:w-64">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchTerm}
                      onChange={(event) => {
                        setSearchTerm(event.target.value);
                        setVisibleRows(10);
                      }}
                      placeholder="Buscar por SKU o nombre"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-slate-100 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="bg-slate-100/80 text-xs uppercase tracking-[0.14em] text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">{renderTableHeader('SKU', 'sku')}</th>
                      <th className="px-4 py-3">{renderTableHeader('Nombre', 'name')}</th>
                      <th className="px-4 py-3">{renderTableHeader('Stock', 'currentStock')}</th>
                      <th className="px-4 py-3">{renderTableHeader('P. Compra', 'purchasePrice')}</th>
                      <th className="px-4 py-3">{renderTableHeader('P. Venta', 'salePrice')}</th>
                      <th className="px-4 py-3">{renderTableHeader('Margen %', 'margin')}</th>
                      <th className="px-4 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleInventory.map((item) => {
                      const alertActive = isAlertedSku(item.sku);
                      const margin = getMarginPercent(item);

                      return (
                        <tr
                          key={item.sku}
                          className={`border-b border-slate-200/70 text-sm transition hover:bg-slate-100/80 dark:border-slate-800/50 dark:hover:bg-slate-800/30 ${
                            alertActive ? 'border-l-4 border-l-rose-500 bg-rose-950/20' : ''
                          }`}
                        >
                          <td className="px-4 py-3 font-mono tabular-nums text-indigo-500 dark:text-indigo-300">{item.sku}</td>
                          <td className="px-4 py-3 text-slate-800 dark:text-slate-100">{item.name}</td>
                          <td className="px-4 py-3">
                            <div className={`inline-flex items-center gap-1 font-mono tabular-nums ${alertActive ? 'font-semibold text-rose-400' : 'text-slate-700 dark:text-slate-200'}`}>
                              {alertActive && <TriangleAlert className="h-3.5 w-3.5" />}
                              {item.currentStock}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono tabular-nums text-slate-700 dark:text-slate-200">{formatCurrency(item.purchasePrice)}</td>
                          <td className="px-4 py-3 font-mono tabular-nums text-slate-700 dark:text-slate-200">{formatCurrency(item.salePrice)}</td>
                          <td className={`px-4 py-3 font-mono tabular-nums ${getMarginTone(margin)}`}>{margin.toFixed(1)}%</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                alertActive
                                  ? 'bg-rose-950 text-rose-300'
                                  : 'bg-emerald-950 text-emerald-300'
                              }`}
                            >
                              {alertActive ? '⚠ Stock bajo' : '✓ OK'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between px-4 py-4 text-xs text-slate-500 dark:text-slate-400">
                <span>
                  Mostrando {visibleInventory.length} de {filteredInventory.length} productos
                </span>
                {visibleRows < filteredInventory.length && (
                  <button
                    type="button"
                    onClick={() => setVisibleRows((current) => current + 10)}
                    className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 font-medium text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600"
                  >
                    Ver mas
                  </button>
                )}
              </div>
            </section>
          </section>

          <section className="order-1 space-y-5 md:order-2 xl:order-2">
            <div className="mb-1 flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">Dashboard maestro</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Operacion comercial en tiempo real para Costa Rica.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="group relative">
                  <button
                    type="button"
                    aria-label="Exportar"
                    className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <div className="absolute right-0 top-full z-50 mt-1 hidden w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900 group-focus-within:block group-hover:block">
                    <a
                      href="/api/export/transactions?format=xlsx"
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                      Transacciones XLSX
                    </a>
                    <a
                      href="/api/export/transactions?format=pdf"
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <FileDown className="h-4 w-4 text-rose-500" />
                      Transacciones PDF
                    </a>
                    <a
                      href="/api/export/inventory?format=pdf"
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <FileDown className="h-4 w-4 text-indigo-500" />
                      Inventario PDF
                    </a>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void loadDashboardData()}
                  aria-label="Refrescar metricas"
                  className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700"
                >
                  <RefreshCw className={`h-4 w-4 ${kpiLoading || alertsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {sectionErrors.kpis ? (
              <div className="rounded-xl border border-rose-500/20 bg-rose-950/40 p-4 text-sm text-rose-100">
                {sectionErrors.kpis}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-2">
                {renderKpiCard(
                  'Ventas del dia',
                  formatCurrency(kpiData.salesToday),
                  `↑ ${kpiData.deltaVsYesterday}% vs ayer`,
                  <TrendingUp className="h-5 w-5" />,
                  'text-emerald-400',
                )}
                {renderKpiCard(
                  'Balance de caja',
                  formatCurrency(kpiData.balance),
                  `Actualizado hace ${kpiData.lastUpdatedMinutes} min`,
                  <Wallet className="h-5 w-5" />,
                  'text-indigo-400',
                )}
                {renderKpiCard(
                  'Alertas stock',
                  kpiData.activeAlerts,
                  `${kpiData.activeAlerts} productos en riesgo`,
                  <BellRing className="h-5 w-5" />,
                  'text-rose-400',
                  () => alertsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                )}
                {renderKpiCard(
                  'Transacciones hoy',
                  kpiData.transactionsToday,
                  `${kpiData.purchasesToday} compras · ${kpiData.salesCountToday} ventas`,
                  <Receipt className="h-5 w-5" />,
                  'text-amber-400',
                )}
              </div>
            )}

            <section
              ref={alertsSectionRef}
              className="rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Alertas de inventario</h2>
                  <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-300">
                    {alerts.length}
                  </span>
                </div>
              </div>

              {alertsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={`alert-skeleton-${index}`} className="animate-pulse rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                      <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-800" />
                      <div className="mt-2 h-3 w-28 rounded bg-slate-200 dark:bg-slate-800" />
                    </div>
                  ))}
                </div>
              ) : sectionErrors.alerts ? (
                <div className="rounded-xl border border-rose-500/20 bg-rose-950/40 p-4 text-sm text-rose-100">
                  {sectionErrors.alerts}
                </div>
              ) : alerts.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-8 text-center dark:border-slate-800 dark:bg-slate-950/40">
                  <ShieldCheck className="h-10 w-10 text-emerald-400" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Todo el inventario esta saludable</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">No hay productos con riesgo inmediato de quiebre.</p>
                  </div>
                </div>
              ) : (
                <div className="max-h-48 space-y-3 overflow-y-auto pr-1">
                  {alerts.map((alert, index) => (
                    <div
                      key={`${alert.sku}-${index}`}
                      className={`animate-fade-in rounded-xl border border-rose-500/15 bg-rose-950/20 p-4 ${animationDelayClasses[index % animationDelayClasses.length]}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="relative mt-1 flex h-2.5 w-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-400" />
                          </span>
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-md bg-rose-950 px-2 py-0.5 font-mono text-xs text-rose-300">{alert.sku}</span>
                              <p className="text-sm font-medium text-slate-900 dark:text-white">{alert.productName}</p>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{alert.message}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-rose-300">
                          <span className="text-xs font-medium">{alert.daysOfStock} dias de stock</span>
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </section>

          <aside className="order-3 hidden xl:block">
            {renderChatPane(
              'sticky top-14 flex h-[calc(100vh-4.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900',
              false,
            )}
          </aside>
        </div>
      </div>

      <div className={`fixed inset-0 z-50 xl:hidden ${isChatOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <button
          type="button"
          aria-label="Cerrar chat"
          onClick={() => setIsChatOpen(false)}
          className={`absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-300 ${isChatOpen ? 'opacity-100' : 'opacity-0'}`}
        />
        {renderChatPane(
          `absolute bottom-0 left-0 right-0 flex h-[92dvh] flex-col overflow-hidden rounded-t-[28px] border border-slate-800 bg-slate-900 transition-transform duration-300 ease-out md:left-auto md:right-0 md:top-0 md:h-full md:w-[380px] md:rounded-none md:rounded-l-[28px] ${
            isChatOpen ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-x-full md:translate-y-0'
          }`,
          true,
        )}
      </div>

      <button
        type="button"
        aria-label="Abrir chat"
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl transition hover:bg-indigo-500 xl:hidden"
      >
        <Bot className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}

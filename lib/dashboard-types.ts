export type UploadState =
  | 'idle'
  | 'dragging'
  | 'uploading'
  | 'processing_ocr'
  | 'success'
  | 'error';

export interface KPIData {
  salesToday: number;
  balance: number;
  activeAlerts: number;
  transactionsToday: number;
  purchasesToday: number;
  salesCountToday: number;
  deltaVsYesterday: number;
  lastUpdatedMinutes: number;
}

export interface InventoryItem {
  sku: string;
  name: string;
  currentStock: number;
  purchasePrice: number;
  salePrice: number;
  taxRate: number;
  status: 'ok' | 'lowStock';
}

export interface AlertItem {
  sku: string;
  message: string;
  productName: string;
  daysOfStock: number;
  isActive: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

export interface UploadResult {
  typeLabel: string;
  summary: string;
}

export interface SectionErrors {
  kpis: string | null;
  alerts: string | null;
  chat: string | null;
}

export type SortKey =
  | 'sku'
  | 'name'
  | 'currentStock'
  | 'purchasePrice'
  | 'salePrice'
  | 'margin';

export type SortDirection = 'asc' | 'desc' | null;

export type LeftTab = 'upload' | 'pos' | 'prices' | 'add' | 'reports' | 'import';

export interface CartItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export const IVA_RATES = [
  { value: 0.13, label: 'IVA 13% (General)' },
  { value: 0.02, label: 'IVA 2% (Reducido)' },
  { value: 0, label: 'Exento (0%)' },
] as const;

export function getIvaLabel(rate: number): string {
  if (rate === 0) return 'Exento';
  return `IVA ${(rate * 100).toFixed(0)}%`;
}

export interface SaleReceipt {
  transactionId: string;
  documentId: string;
  date: string;
  items: (CartItem & { lineTotal: number; taxAmount: number })[];
  taxableSubtotal: number;
  exemptSubtotal: number;
  taxAmount: number;
  grandTotal: number;
  pdfBase64: string;
}

import type { ReactNode } from 'react';
import type { ChatMessage, InventoryItem } from './dashboard-types';

export const currencyFormatter = new Intl.NumberFormat('es-CR', {
  style: 'currency',
  currency: 'CRC',
  maximumFractionDigits: 0,
});

export const quickChips = [
  '📊 Resumen de hoy',
  '🚨 Ver alertas',
  '💰 Balance de caja',
  '📦 Stock crítico',
];

export const animationDelayClasses = [
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

export const initialBotMessage: ChatMessage = {
  id: 'welcome-message',
  role: 'bot',
  content:
    '¡Hola! Soy FacturaBot. Puedo mostrarte el resumen de ventas de hoy, las alertas de inventario y el balance de caja. ¿En qué te ayudo?',
  timestamp: new Date(),
};

export function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function formatCurrency(value: number): string {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

export function formatTimestamp(value: Date): string {
  return value.toLocaleTimeString('es-CR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getMarginPercent(item: InventoryItem): number {
  if (item.salePrice <= 0) return 0;
  return ((item.salePrice - item.purchasePrice) / item.salePrice) * 100;
}

export function getMarginTone(margin: number): string {
  if (margin > 20) return 'text-emerald-400';
  if (margin >= 10) return 'text-amber-400';
  return 'text-rose-400';
}

export function getUploadWidthClass(progress: number): string {
  if (progress >= 95) return 'w-full';
  if (progress >= 80) return 'w-5/6';
  if (progress >= 60) return 'w-2/3';
  if (progress >= 40) return 'w-1/2';
  if (progress >= 20) return 'w-1/3';
  return 'w-1/6';
}

export function parseFirstJson<T>(source: string): T | null {
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

export async function requestChat(message: string): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });

  const payload = (await response.json()) as { text?: string; error?: string };

  if (!response.ok) {
    throw new Error(payload.error || 'No fue posible obtener datos del asistente.');
  }

  return payload.text || '';
}

export function RobotLogo(): ReactNode {
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

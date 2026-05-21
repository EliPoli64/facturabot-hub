'use client';

import { type KeyboardEvent } from 'react';
import { Bell, Bot, Database, DollarSign, Moon, Sun } from 'lucide-react';
import { RobotLogo } from '@/lib/dashboard-utils';

interface DashboardHeaderProps {
  isDarkMode: boolean;
  onToggleDark: () => void;
  businessName: string;
  onBusinessNameSave: (name: string) => void;
  mongoConnected: boolean;
  telegramActive: boolean;
  alertsCount: number;
  businessNameRef: React.RefObject<HTMLSpanElement | null>;
  exchangeRate: { rate: number; updatedAt: string } | null;
}

export default function DashboardHeader({
  isDarkMode,
  onToggleDark,
  businessName,
  onBusinessNameSave,
  mongoConnected,
  telegramActive,
  alertsCount,
  businessNameRef,
  exchangeRate,
}: DashboardHeaderProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLSpanElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      onBusinessNameSave(businessNameRef.current?.textContent?.trim() || 'FacturaBot CR');
      businessNameRef.current?.blur();
    }
  }

  return (
    <div className="border-b border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-[#0F1117]/90">
      <div className="mx-auto flex h-14 max-w-[1680px] items-center justify-between px-4 md:px-6 xl:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#161B27]">
            <RobotLogo />
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
            onBlur={(e) => onBusinessNameSave(e.currentTarget.textContent?.trim() || 'FacturaBot CR')}
            onKeyDown={handleKeyDown}
            className="rounded-lg px-3 py-1 text-sm font-medium text-slate-500 outline-none ring-0 transition hover:bg-slate-100 focus:bg-slate-100 focus:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:focus:bg-slate-900 dark:focus:text-white"
          >
            {businessName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {exchangeRate && (
            <div
              title={`Actualizado: ${exchangeRate.updatedAt}`}
              className="hidden items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 md:flex"
            >
              <DollarSign className="h-3 w-3" />
              <span className="font-mono font-medium">USD {exchangeRate.rate.toFixed(2)}</span>
            </div>
          )}
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
            {alertsCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                {alertsCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

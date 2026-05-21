'use client';

import { ChevronRight, ShieldCheck } from 'lucide-react';
import type { AlertItem, SectionErrors } from '@/lib/dashboard-types';
import { animationDelayClasses } from '@/lib/dashboard-utils';

interface AlertsPanelProps {
  alerts: AlertItem[];
  alertsLoading: boolean;
  sectionErrors: SectionErrors;
}

export default function AlertsPanel({ alerts, alertsLoading, sectionErrors }: AlertsPanelProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
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
  );
}

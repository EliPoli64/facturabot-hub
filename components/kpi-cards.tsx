'use client';

import type { ReactNode } from 'react';
import { BellRing, Receipt, TrendingUp, Wallet } from 'lucide-react';
import type { KPIData, SectionErrors } from '@/lib/dashboard-types';
import { formatCurrency } from '@/lib/dashboard-utils';

interface KpiCardsProps {
  kpiData: KPIData;
  kpiLoading: boolean;
  sectionErrors: SectionErrors;
  onAlertsClick: () => void;
}

function KpiCardSkeleton(): ReactNode {
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

interface KpiCardProps {
  title: string;
  value: ReactNode;
  subtitle: string;
  icon: ReactNode;
  iconTone: string;
  onClick?: () => void;
}

function KpiCard({ title, value, subtitle, icon, iconTone, onClick }: KpiCardProps): ReactNode {
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

export default function KpiCards({ kpiData, kpiLoading, sectionErrors, onAlertsClick }: KpiCardsProps) {
  if (sectionErrors.kpis) {
    return (
      <div className="rounded-xl border border-rose-500/20 bg-rose-950/40 p-4 text-sm text-rose-100">
        {sectionErrors.kpis}
      </div>
    );
  }

  if (kpiLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-2">
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-2">
      <KpiCard
        title="Ventas del dia"
        value={formatCurrency(kpiData.salesToday)}
        subtitle={`↑ ${kpiData.deltaVsYesterday}% vs ayer`}
        icon={<TrendingUp className="h-5 w-5" />}
        iconTone="text-emerald-400"
      />
      <KpiCard
        title="Balance de caja"
        value={formatCurrency(kpiData.balance)}
        subtitle={`Actualizado hace ${kpiData.lastUpdatedMinutes} min`}
        icon={<Wallet className="h-5 w-5" />}
        iconTone="text-indigo-400"
      />
      <KpiCard
        title="Alertas stock"
        value={kpiData.activeAlerts}
        subtitle={`${kpiData.activeAlerts} productos en riesgo`}
        icon={<BellRing className="h-5 w-5" />}
        iconTone="text-rose-400"
        onClick={onAlertsClick}
      />
      <KpiCard
        title="Transacciones hoy"
        value={kpiData.transactionsToday}
        subtitle={`${kpiData.purchasesToday} compras · ${kpiData.salesCountToday} ventas`}
        icon={<Receipt className="h-5 w-5" />}
        iconTone="text-amber-400"
      />
    </div>
  );
}

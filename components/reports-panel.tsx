'use client';

import { useEffect, useState } from 'react';
import { BarChart3, TrendingDown, TrendingUp, Wallet, Receipt, Package } from 'lucide-react';
import { formatCurrency } from '@/lib/dashboard-utils';

interface TrendMonth {
  label: string;
  income: number;
  expenses: number;
  count: number;
}

interface TopProduct {
  sku: string | null;
  name: string;
  quantity: number;
  revenue: number;
}

interface TopImport {
  sku: string | null;
  name: string;
  quantity: number;
  cost: number;
}

interface TrendsData {
  months: TrendMonth[];
}

interface TopProductsData {
  topSales: TopProduct[];
  topPurchases: TopImport[];
}

interface PnlData {
  month: { income: number; expenses: number; net: number };
  year: { income: number; expenses: number; net: number };
}

interface BalanceData {
  assets: { inventory: number; cash: number; total: number };
  equity: number;
}

interface IvaData {
  month: { collected: number; paid: number; netPayable: number };
  year: { collected: number; paid: number; netPayable: number };
}

export default function ReportsPanel() {
  const [pnl, setPnl] = useState<PnlData | null>(null);
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [iva, setIva] = useState<IvaData | null>(null);
  const [trends, setTrends] = useState<TrendsData | null>(null);
  const [topProducts, setTopProducts] = useState<TopProductsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    async function fetchData() {
      try {
        const [pnlRes, balRes, ivaRes, trendsRes, topRes] = await Promise.all([
          fetch('/api/reports?type=pnl'),
          fetch('/api/reports?type=balance'),
          fetch('/api/reports?type=iva'),
          fetch('/api/reports?type=trends'),
          fetch('/api/reports?type=top-products'),
        ]);
        if (pnlRes.ok) setPnl(await pnlRes.json());
        if (balRes.ok) setBalance(await balRes.json());
        if (ivaRes.ok) setIva(await ivaRes.json());
        if (trendsRes.ok) setTrends(await trendsRes.json());
        if (topRes.ok) setTopProducts(await topRes.json());
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-900">
        <div className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-800">
          <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
        <div className="p-6 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const maxTrend = Math.max(
    ...(trends?.months.map((m) => Math.max(m.income, m.expenses)) || [1]),
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200/80 dark:border-slate-800">
        <BarChart3 className="h-4 w-4 text-indigo-400" />
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Reportes financieros</h2>
      </div>

      <div className="p-4 space-y-4">
        {/* Snapshot cards */}
        {pnl && (
          <div className="grid grid-cols-3 gap-2">
            <SnapshotCard
              label="Ingresos (mes)"
              value={pnl.month.income}
              icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-400" />}
            />
            <SnapshotCard
              label="Gastos (mes)"
              value={pnl.month.expenses}
              icon={<TrendingDown className="h-3.5 w-3.5 text-rose-400" />}
            />
            <SnapshotCard
              label="Utilidad Neta"
              value={pnl.month.net}
              icon={<Wallet className="h-3.5 w-3.5 text-indigo-400" />}
              positive={pnl.month.net >= 0}
            />
          </div>
        )}

        {/* Tendencias chart */}
        {trends && trends.months.length > 0 && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Ingresos vs Gastos (6 meses)
            </h3>
            <div className="flex items-end gap-2 h-28">
              {trends.months.map((m) => {
                const incH = maxTrend > 0 ? (m.income / maxTrend) * 100 : 0;
                const expH = maxTrend > 0 ? (m.expenses / maxTrend) * 100 : 0;
                return (
                  <div key={m.label} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="w-full flex flex-col-reverse items-center" style={{ height: '96px' }}>
                      <div
                        className="w-full bg-emerald-400/80 rounded-t"
                        style={{ height: `${Math.max(incH, 2)}%` }}
                        title={`Ingresos ${m.label}: ${formatCurrency(m.income)}`}
                      />
                      <div
                        className="w-full bg-rose-400/80 rounded-t"
                        style={{ height: `${Math.max(expH, 2)}%` }}
                        title={`Gastos ${m.label}: ${formatCurrency(m.expenses)}`}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{m.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-emerald-400/80" /> Ingresos
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-rose-400/80" /> Gastos
              </span>
            </div>
          </div>
        )}

        {/* Top productos */}
        {topProducts && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {topProducts.topSales.length > 0 && (
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <TrendingUp className="h-3 w-3 text-emerald-400" /> Top Ventas
                </h3>
                <div className="space-y-1.5">
                  {topProducts.topSales.map((p, i) => {
                    const maxRev = topProducts.topSales[0]?.revenue || 1;
                    const pct = (p.revenue / maxRev) * 100;
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-700 dark:text-slate-300 truncate max-w-[140px]">{p.name}</span>
                          <span className="font-mono text-slate-500">{formatCurrency(p.revenue)}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-0.5 overflow-hidden">
                          <div className="h-full bg-emerald-400/60 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {topProducts.topPurchases.length > 0 && (
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Package className="h-3 w-3 text-amber-400" /> Top Importados
                </h3>
                <div className="space-y-1.5">
                  {topProducts.topPurchases.map((p, i) => {
                    const maxCost = topProducts.topPurchases[0]?.cost || 1;
                    const pct = (p.cost / maxCost) * 100;
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-700 dark:text-slate-300 truncate max-w-[140px]">{p.name}</span>
                          <span className="font-mono text-slate-500">{formatCurrency(p.cost)}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-0.5 overflow-hidden">
                          <div className="h-full bg-amber-400/60 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Balance e IVA compacto */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {balance && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-1.5">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Balance</h3>
              <Row label="Inventario" value={balance.assets.inventory} />
              <Row label="Efectivo" value={balance.assets.cash} />
              <div className="border-t border-slate-200 dark:border-slate-700 pt-1.5">
                <Row label="Total Activos" value={balance.assets.total} bold />
              </div>
            </div>
          )}
          {iva && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-1.5">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">IVA del mes</h3>
              <Row label="Cobrado (Debito)" value={iva.month.collected} />
              <Row label="Pagado (Credito)" value={iva.month.paid} />
              <div className="border-t border-slate-200 dark:border-slate-700 pt-1.5">
                <Row label="Neto a pagar" value={iva.month.netPayable} bold positive={iva.month.netPayable >= 0} />
              </div>
            </div>
          )}
        </div>

        {/* Resumen del ano */}
        {pnl && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-1.5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Resumen del ano</h3>
            <Row label="Ingresos" value={pnl.year.income} />
            <Row label="Gastos" value={pnl.year.expenses} />
            <div className="border-t border-slate-200 dark:border-slate-700 pt-1.5">
              <Row label="Utilidad Neta" value={pnl.year.net} bold positive={pnl.year.net >= 0} />
            </div>
          </div>
        )}

        {!pnl && !trends && !topProducts && (
          <p className="text-sm text-slate-500 text-center py-4">No hay datos financieros disponibles.</p>
        )}
      </div>
    </div>
  );
}

function SnapshotCard({
  label,
  value,
  icon,
  positive,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  positive?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 space-y-1">
      <span className="flex items-center gap-1 text-[10px] text-slate-500 uppercase tracking-wider">
        {icon}{label}
      </span>
      <span className={`block font-mono text-xs font-semibold ${
        positive === undefined ? 'text-slate-900 dark:text-slate-100' :
        positive ? 'text-emerald-400' : 'text-rose-400'
      }`}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

function Row({ label, value, bold, positive, icon }: { label: string; value: number; bold?: boolean; positive?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
        {icon}{label}
      </span>
      <span className={`font-mono text-[11px] ${bold ? 'font-semibold' : ''} ${
        positive === undefined ? 'text-slate-900 dark:text-slate-100' :
        positive ? 'text-emerald-400' : 'text-rose-400'
      }`}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

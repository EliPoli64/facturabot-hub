'use client';

import { useEffect, useState } from 'react';
import { BarChart3, TrendingDown, TrendingUp, Wallet, Receipt } from 'lucide-react';
import { formatCurrency } from '@/lib/dashboard-utils';

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
  const [tab, setTab] = useState<'pnl' | 'balance' | 'iva'>('pnl');
  const [pnl, setPnl] = useState<PnlData | null>(null);
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [iva, setIva] = useState<IvaData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    async function fetchData() {
      try {
        const [pnlRes, balRes, ivaRes] = await Promise.all([
          fetch('/api/reports?type=pnl'),
          fetch('/api/reports?type=balance'),
          fetch('/api/reports?type=iva'),
        ]);
        if (pnlRes.ok) setPnl(await pnlRes.json());
        if (balRes.ok) setBalance(await balRes.json());
        if (ivaRes.ok) setIva(await ivaRes.json());
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
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200/80 dark:border-slate-800">
        <BarChart3 className="h-4 w-4 text-indigo-400" />
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Reportes financieros</h2>
      </div>

      <div className="flex gap-1 p-3 border-b border-slate-200/80 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setTab('pnl')}
          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            tab === 'pnl'
              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          P&G
        </button>
        <button
          type="button"
          onClick={() => setTab('balance')}
          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            tab === 'balance'
              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Balance
        </button>
        <button
          type="button"
          onClick={() => setTab('iva')}
          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            tab === 'iva'
              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          IVA
        </button>
      </div>

      <div className="p-4 space-y-3">
        {tab === 'pnl' && pnl && (
          <>
            <PeriodCard title="Este mes" income={pnl.month.income} expenses={pnl.month.expenses} net={pnl.month.net} />
            <PeriodCard title="Este ano" income={pnl.year.income} expenses={pnl.year.expenses} net={pnl.year.net} />
          </>
        )}
        {tab === 'balance' && balance && (
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Activos</h3>
              <Row label="Inventario" value={balance.assets.inventory} />
              <Row label="Efectivo (Caja)" value={balance.assets.cash} />
              <div className="border-t border-slate-200 dark:border-slate-700 pt-2">
                <Row label="Total Activos" value={balance.assets.total} bold />
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Patrimonio</h3>
              <Row label="Capital / Utilidades retenidas" value={balance.equity} bold />
            </div>
          </div>
        )}
        {tab === 'iva' && iva && (
          <>
            <IvaPeriodCard title="Este mes" collected={iva.month.collected} paid={iva.month.paid} netPayable={iva.month.netPayable} />
            <IvaPeriodCard title="Este ano" collected={iva.year.collected} paid={iva.year.paid} netPayable={iva.year.netPayable} />
          </>
        )}
        {tab === 'pnl' && !pnl && <p className="text-sm text-slate-500 text-center py-4">No hay datos financieros disponibles.</p>}
        {tab === 'balance' && !balance && <p className="text-sm text-slate-500 text-center py-4">No hay datos de balance disponibles.</p>}
        {tab === 'iva' && !iva && <p className="text-sm text-slate-500 text-center py-4">No hay datos de IVA disponibles.</p>}
      </div>
    </div>
  );
}

function PeriodCard({ title, income, expenses, net }: { title: string; income: number; expenses: number; net: number }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</h3>
      <Row label="Ingresos" value={income} icon={<TrendingUp className="h-3 w-3 text-emerald-400" />} />
      <Row label="Gastos" value={expenses} icon={<TrendingDown className="h-3 w-3 text-rose-400" />} />
      <div className="border-t border-slate-200 dark:border-slate-700 pt-2">
        <Row label="Utilidad Neta" value={net} bold positive={net >= 0} />
      </div>
    </div>
  );
}

function IvaPeriodCard({ title, collected, paid, netPayable }: { title: string; collected: number; paid: number; netPayable: number }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</h3>
      <Row label="IVA cobrado en ventas (Debito fiscal)" value={collected} icon={<Receipt className="h-3 w-3 text-emerald-400" />} />
      <Row label="IVA pagado en compras (Credito fiscal)" value={paid} icon={<Receipt className="h-3 w-3 text-amber-400" />} />
      <div className="border-t border-slate-200 dark:border-slate-700 pt-2">
        <Row label="IVA neto a pagar" value={netPayable} bold positive={netPayable >= 0} />
      </div>
    </div>
  );
}

function Row({ label, value, bold, positive, icon }: { label: string; value: number; bold?: boolean; positive?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        {icon}{label}
      </span>
      <span className={`font-mono text-xs ${bold ? 'font-semibold' : ''} ${
        positive === undefined ? 'text-slate-900 dark:text-slate-100' :
        positive ? 'text-emerald-400' : 'text-rose-400'
      }`}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/dashboard-utils';

interface DayData {
  _id: string;
  total: number;
  count: number;
}

export default function SalesChart() {
  const [data, setData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/stats/sales-chart');
        const json = await res.json();
        setData(Array.isArray(json) ? json : []);
      } catch {
        setData([]);
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
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
        <div className="p-4 space-y-2">
          {[70, 85, 65, 90, 75, 80, 72].map((w, i) => (
            <div key={i} className="h-6 bg-slate-100 dark:bg-slate-800 rounded" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200/80 dark:border-slate-800">
          <TrendingUp className="h-4 w-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ventas (7 dias)</h2>
        </div>
        <div className="p-6 text-center text-sm text-slate-500">Sin datos de ventas en los ultimos 7 dias.</div>
      </div>
    );
  }

  const maxTotal = Math.max(...data.map((d) => d.total), 1);
  const dayLabels: Record<string, string> = {
    Mon: 'Lun', Tue: 'Mar', Wed: 'Mie', Thu: 'Jue', Fri: 'Vie', Sat: 'Sab', Sun: 'Dom',
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200/80 dark:border-slate-800">
        <TrendingUp className="h-4 w-4 text-indigo-400" />
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ventas (7 dias)</h2>
      </div>
      <div className="p-4">
        <div className="flex items-end gap-2 h-32">
          {data.map((d) => {
            const pct = (d.total / maxTotal) * 100;
            const day = new Date(d._id).toLocaleDateString('es-CR', { weekday: 'short' });
            const label = dayLabels[day] || day;
            return (
              <div key={d._id} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <span className="text-[10px] font-medium text-slate-500">{formatCurrency(d.total)}</span>
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-indigo-600 to-indigo-400 transition-all duration-500"
                  style={{ height: `${Math.max(pct, 4)}%` }}
                />
                <span className="text-[10px] text-slate-500">{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

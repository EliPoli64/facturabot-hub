'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, FileDown, Search, TriangleAlert } from 'lucide-react';
import type { AlertItem, InventoryItem, SortDirection, SortKey } from '@/lib/dashboard-types';
import { formatCurrency, getMarginPercent, getMarginTone } from '@/lib/dashboard-utils';
import { getIvaLabel } from '@/lib/dashboard-types';

interface InventoryTableProps {
  inventoryItems: InventoryItem[];
  alerts: AlertItem[];
}

function SortIcon({ column, sortKey, sortDirection }: { column: SortKey; sortKey: SortKey; sortDirection: SortDirection }) {
  if (sortKey !== column || !sortDirection) {
    return <ChevronDown className="h-3.5 w-3.5 text-slate-600 dark:text-slate-500" />;
  }
  return sortDirection === 'asc' ? (
    <ChevronUp className="h-3.5 w-3.5 text-indigo-400" />
  ) : (
    <ChevronDown className="h-3.5 w-3.5 text-indigo-400" />
  );
}

function TableHeader({
  label,
  column,
  sortKey,
  sortDirection,
  onSort,
}: {
  label: string;
  column: SortKey;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className="inline-flex items-center gap-1 transition hover:text-slate-200"
    >
      {label}
      <SortIcon column={column} sortKey={sortKey} sortDirection={sortDirection} />
    </button>
  );
}

export default function InventoryTable({ inventoryItems, alerts }: InventoryTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleRows, setVisibleRows] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey>('currentStock');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  function handleSort(nextKey: SortKey): void {
    if (sortKey !== nextKey) {
      setSortKey(nextKey);
      setSortDirection('asc');
      return;
    }
    if (sortDirection === 'asc') { setSortDirection('desc'); return; }
    if (sortDirection === 'desc') { setSortDirection(null); return; }
    setSortDirection('asc');
  }

  const filtered = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    const filtered = normalizedTerm
      ? inventoryItems.filter(
          (item) =>
            item.name.toLowerCase().includes(normalizedTerm) ||
            item.sku.toLowerCase().includes(normalizedTerm),
        )
      : inventoryItems;

    const sorted = [...filtered];
    if (sortDirection) {
      sorted.sort((left, right) => {
        const leftVal = sortKey === 'margin' ? getMarginPercent(left) : left[sortKey as keyof InventoryItem];
        const rightVal = sortKey === 'margin' ? getMarginPercent(right) : right[sortKey as keyof InventoryItem];

        if (typeof leftVal === 'number' && typeof rightVal === 'number') {
          return sortDirection === 'asc' ? leftVal - rightVal : rightVal - leftVal;
        }

        const l = String(leftVal).toLowerCase();
        const r = String(rightVal).toLowerCase();
        if (l < r) return sortDirection === 'asc' ? -1 : 1;
        if (l > r) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return sorted;
  }, [inventoryItems, searchTerm, sortKey, sortDirection]);

  const visible = filtered.slice(0, visibleRows);

  function isAlertedSku(sku: string): boolean {
    return alerts.some((alert) => alert.sku === sku && alert.isActive);
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
      <div className="flex flex-col gap-3 border-b border-slate-200/80 px-4 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Inventario</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Mostrando {visible.length} de {filtered.length} productos
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
              onChange={(e) => {
                setSearchTerm(e.target.value);
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
              <th className="px-4 py-3"><TableHeader label="SKU" column="sku" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} /></th>
              <th className="px-4 py-3"><TableHeader label="Nombre" column="name" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} /></th>
              <th className="px-4 py-3"><TableHeader label="Stock" column="currentStock" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} /></th>
              <th className="px-4 py-3"><TableHeader label="P. Compra" column="purchasePrice" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} /></th>
              <th className="px-4 py-3"><TableHeader label="P. Venta" column="salePrice" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} /></th>
              <th className="px-4 py-3"><TableHeader label="Margen %" column="margin" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} /></th>
              <th className="px-4 py-3">IVA</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => {
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
                  <td className="px-4 py-3 font-mono tabular-nums text-slate-700 dark:text-slate-300">{getIvaLabel(item.taxRate)}</td>
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
        <span>Mostrando {visible.length} de {filtered.length} productos</span>
        {visibleRows < filtered.length && (
          <button
            type="button"
            onClick={() => setVisibleRows((c) => c + 10)}
            className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 font-medium text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600"
          >
            Ver mas
          </button>
        )}
      </div>
    </section>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Percent, Search, Save, X, DollarSign } from 'lucide-react';
import type { InventoryItem } from '@/lib/dashboard-types';
import { getIvaLabel, IVA_RATES } from '@/lib/dashboard-types';
import { formatCurrency } from '@/lib/dashboard-utils';

interface PriceManagerProps {
  inventoryItems: InventoryItem[];
  onUpdated: () => void;
}

const MARKUP_KEY = 'facturabotDefaultMarkup';

export default function PriceManager({ inventoryItems, onUpdated }: PriceManagerProps) {
  const [search, setSearch] = useState('');
  const [priceEdits, setPriceEdits] = useState<Record<string, number>>({});
  const [taxEdits, setTaxEdits] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [markupPercent, setMarkupPercent] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseInt(window.localStorage.getItem(MARKUP_KEY) || '10', 10);
    }
    return 10;
  });
  const [showMarkup, setShowMarkup] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(MARKUP_KEY, String(markupPercent));
  }, [markupPercent]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return inventoryItems;
    return inventoryItems.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.sku.toLowerCase().includes(q),
    );
  }, [inventoryItems, search]);

  function setPrice(sku: string, value: string): void {
    const num = Number(value);
    if (isNaN(num) || num < 0) return;
    setPriceEdits((prev) => ({ ...prev, [sku]: num }));
  }

  function setTax(sku: string, rate: number): void {
    setTaxEdits((prev) => ({ ...prev, [sku]: rate }));
  }

  function clearEdit(sku: string): void {
    setPriceEdits((prev) => {
      const next = { ...prev };
      delete next[sku];
      return next;
    });
    setTaxEdits((prev) => {
      const next = { ...prev };
      delete next[sku];
      return next;
    });
  }

  function hasChanges(sku: string): boolean {
    return sku in priceEdits || sku in taxEdits;
  }

  async function handleSave(): Promise<void> {
    const allSkus = new Set([...Object.keys(priceEdits), ...Object.keys(taxEdits)]);
    const updates = Array.from(allSkus).map((sku) => ({
      sku,
      ...(sku in priceEdits ? { salePrice: priceEdits[sku] } : {}),
      ...(sku in taxEdits ? { taxRate: taxEdits[sku] } : {}),
    }));
    if (updates.length === 0) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch('/api/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar precios.');

      setPriceEdits({});
      setTaxEdits({});
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar precios.');
    } finally {
      setSaving(false);
    }
  }

  const dirtyCount = new Set([...Object.keys(priceEdits), ...Object.keys(taxEdits)]).size;

  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Gestion de precios</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowMarkup(!showMarkup)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
              showMarkup
                ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400'
                : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600'
            }`}
          >
            <Percent className="h-3 w-3" />
            {markupPercent}%
          </button>
          {dirtyCount > 0 && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
              {dirtyCount} cambios
            </span>
          )}
        </div>
      </div>

      <div className="p-4">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-100 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        {showMarkup && (
          <div className="mb-3 flex items-center gap-3 rounded-lg border border-indigo-500/10 bg-indigo-500/5 px-3 py-2">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Margen por defecto:
            </label>
            <div className="relative flex-1 max-w-24">
              <input
                type="number"
                value={markupPercent}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v)) setMarkupPercent(Math.max(0, v));
                }}
                min="0"
                max="1000"
                className="h-8 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 pr-7 text-right font-mono text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
            </div>
            <p className="text-xs text-slate-400 whitespace-nowrap">
              P. venta = compra × {(1 + markupPercent / 100).toFixed(2)}
            </p>
          </div>
        )}

        <div className="max-h-80 overflow-y-auto space-y-1">
          {filtered.map((item) => {
            const changed = hasChanges(item.sku);
            const currentPrice = item.sku in priceEdits ? priceEdits[item.sku] : (item.salePrice ?? 0);
            const currentTax = item.sku in taxEdits ? taxEdits[item.sku] : item.taxRate;

            return (
              <div
                key={item.sku}
                className={`rounded-lg border px-3 py-2 ${
                  changed
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{item.name}</p>
                    <p className="font-mono text-xs text-slate-500">
                      {item.sku} · Stock: {item.currentStock} · Costo: {formatCurrency(item.purchasePrice)}
                    </p>
                  </div>
                  {changed && (
                    <button
                      type="button"
                      onClick={() => clearEdit(item.sku)}
                      className="text-slate-400 transition hover:text-rose-400"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">₡</span>
                    <input
                      type="number"
                      value={currentPrice}
                      onChange={(e) => setPrice(item.sku, e.target.value)}
                      className={`h-8 w-full rounded-lg border pl-6 pr-2 text-right font-mono text-sm outline-none transition ${
                        item.sku in priceEdits
                          ? 'border-amber-500 bg-amber-500/10 text-amber-300 focus:ring-2 focus:ring-amber-500/20'
                          : 'border-slate-200 bg-slate-100 text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
                      }`}
                    />
                  </div>
                  <div className="flex gap-1">
                    {IVA_RATES.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setTax(item.sku, r.value)}
                        className={`rounded-md border px-2 py-1 text-xs font-medium transition ${
                          currentTax === r.value
                            ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300'
                            : 'border-slate-200 text-slate-400 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
                        }`}
                      >
                        {r.label.replace('IVA ', '')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">No se encontraron productos.</p>
        )}

        {error && (
          <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
            Precios actualizados correctamente.
          </div>
        )}

        {dirtyCount > 0 && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Guardando...' : `Guardar ${dirtyCount} cambio${dirtyCount !== 1 ? 's' : ''}`}
          </button>
        )}
      </div>
    </div>
  );
}

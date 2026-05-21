'use client';

import { useEffect, useRef, useState } from 'react';
import { PackagePlus, Settings2 } from 'lucide-react';
import { IVA_RATES } from '@/lib/dashboard-types';

const MARKUP_KEY = 'facturabotDefaultMarkup';

interface AddProductPanelProps {
  onCreated: () => void;
}

export default function AddProductPanel({ onCreated }: AddProductPanelProps) {
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [currentStock, setCurrentStock] = useState('0');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [taxRate, setTaxRate] = useState(0.13);
  const [markupPercent, setMarkupPercent] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseInt(window.localStorage.getItem(MARKUP_KEY) || '10', 10);
    }
    return 10;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showMarkup, setShowMarkup] = useState(false);

  const skuRef = useRef<HTMLInputElement>(null);
  const autoCalcRef = useRef(true);

  useEffect(() => {
    window.localStorage.setItem(MARKUP_KEY, String(markupPercent));
  }, [markupPercent]);

  useEffect(() => {
    if (!autoCalcRef.current) return;
    const purchase = parseFloat(purchasePrice);
    if (!isNaN(purchase) && purchase > 0) {
      setSalePrice(String(Math.round(purchase * (1 + markupPercent / 100) * 100) / 100));
    }
  }, [purchasePrice, markupPercent]);

  function handleSalePriceChange(value: string): void {
    autoCalcRef.current = false;
    setSalePrice(value);
  }

  function reset(): void {
    setSku('');
    setName('');
    setCurrentStock('0');
    setPurchasePrice('');
    setSalePrice('');
    setTaxRate(0.13);
    setError(null);
    setSuccess(false);
    autoCalcRef.current = true;
    skuRef.current?.focus();
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const purchase = Number(purchasePrice);
    if (!sku.trim()) { setError('El SKU es requerido.'); return; }
    if (!name.trim()) { setError('El nombre es requerido.'); return; }
    if (isNaN(purchase) || purchase < 0) { setError('El precio de compra no es valido.'); return; }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: sku.trim().toUpperCase(),
          name: name.trim(),
          currentStock: Math.max(0, parseInt(currentStock) || 0),
          purchasePrice: purchase,
          salePrice: salePrice ? Math.max(0, Number(salePrice)) : 0,
          taxRate,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear producto.');

      setSuccess(true);
      onCreated();
      setTimeout(reset, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear producto.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200/80 px-4 py-3 dark:border-slate-800">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <PackagePlus className="h-4 w-4" />
          Agregar producto
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">SKU</label>
            <input
              ref={skuRef}
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="Ej: PRO-001"
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-900 uppercase outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Stock inicial</label>
            <input
              type="number"
              value={currentStock}
              onChange={(e) => setCurrentStock(e.target.value)}
              min="0"
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Nombre del producto</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Arroz integral 1kg"
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Precio de compra <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">₡</span>
                <input
                  type="number"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  min="0"
                  placeholder="0"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-100 pl-7 pr-3 text-right font-mono text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Precio de venta</label>
                <button
                  type="button"
                  onClick={() => setShowMarkup(!showMarkup)}
                  className="mb-1 text-slate-400 hover:text-indigo-400 transition"
                  title="Configurar margen por defecto"
                >
                  <Settings2 className="h-3 w-3" />
                </button>
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">₡</span>
                <input
                  type="number"
                  value={salePrice}
                  onChange={(e) => handleSalePriceChange(e.target.value)}
                  min="0"
                  placeholder="0"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-100 pl-7 pr-3 text-right font-mono text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {showMarkup && (
            <div className="flex items-center gap-3 rounded-lg border border-indigo-500/10 bg-indigo-500/5 px-3 py-2">
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
              <p className="text-xs text-slate-400">P. venta = compra × {(1 + markupPercent / 100).toFixed(2)}</p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              IVA (Impuesto al Valor Agregado)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {IVA_RATES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setTaxRate(r.value)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                    taxRate === r.value
                      ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300'
                      : 'border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

        <div className="rounded-lg border border-indigo-500/10 bg-indigo-500/5 px-3 py-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium text-indigo-400">Nota:</span> El costo landed se igualara al precio de compra. Puedes ajustarlo desde la seccion <span className="font-medium text-indigo-400">Precios</span>.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
            Producto creado correctamente.
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PackagePlus className="h-4 w-4" />
          {saving ? 'Creando...' : 'Agregar producto'}
        </button>
      </form>
    </div>
  );
}

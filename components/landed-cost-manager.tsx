'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Globe,
  Calculator,
  Check,
  AlertCircle,
  ArrowRight,
  Plus,
  Trash2,
  Scale,
  Coins,
  FileText,
  Loader2,
  Sparkles,
  Search,
  Percent
} from 'lucide-react';
import { formatCurrency } from '@/lib/dashboard-utils';
import type { InventoryItem } from '@/lib/dashboard-types';

interface LandedCostManagerProps {
  inventoryItems: InventoryItem[];
  onApplied: () => void;
}

interface SimulatedItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  unitPriceUsd: number;
}

export default function LandedCostManager({ inventoryItems, onApplied }: LandedCostManagerProps) {
  // Tabs: 'real' | 'simulator'
  const [activeMode, setActiveMode] = useState<'real' | 'simulator'>('real');

  // Datos cargados desde API (Para Modo Real)
  const [foreignInvoices, setForeignInvoices] = useState<any[]>([]);
  const [localExpenses, setLocalExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Estados Modo Real
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [manualExpenses, setManualExpenses] = useState<{ description: string; amountCrc: number }[]>([]);
  const [distributionMethod, setDistributionMethod] = useState<'VALUE' | 'QUANTITY'>('VALUE');

  // Control de gastos manuales
  const [newManualDesc, setNewManualDesc] = useState('');
  const [newManualAmount, setNewManualAmount] = useState('');

  // Borrador calculado en tiempo real (Modo Real)
  const [previewCalculations, setPreviewCalculations] = useState<any[]>([]);
  const [liquidationId, setLiquidationId] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [applying, setApplying] = useState(false);

  // ==========================================
  // ESTADOS MODO SIMULADOR HIPOTÉTICO
  // ==========================================
  const [simulatedItems, setSimulatedItems] = useState<SimulatedItem[]>([
    { id: '1', sku: 'IPH-16', name: 'iPhone 16 Pro Max 256GB', quantity: 10, unitPriceUsd: 1100 },
    { id: '2', sku: 'CASE-GLS', name: 'Funda de Vidrio Templado', quantity: 100, unitPriceUsd: 1.5 },
  ]);
  const [simExchangeRate, setSimExchangeRate] = useState<number>(515);
  const [simFreightUsd, setSimFreightUsd] = useState<string>('350');
  const [simCustomsCrc, setSimCustomsCrc] = useState<string>('120000');
  const [simHandlingCrc, setSimHandlingCrc] = useState<string>('45000');
  const [simMethod, setSimMethod] = useState<'VALUE' | 'QUANTITY'>('VALUE');
  const [targetMarkup, setTargetMarkup] = useState<number>(30);

  // Buscador para agregar producto del inventario al simulador
  const [simProductSearch, setSimProductSearch] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Estado para detectar cambios en el slider y activar animación
  const [priceAnimationKey, setPriceAnimationKey] = useState(0);

  // Cargar facturas y gastos iniciales (Modo Real)
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch('/api/landed-cost');
        if (!res.ok) throw new Error('Error al cargar datos de importaciones.');
        const data = await res.json();
        setForeignInvoices(data.foreignInvoices || []);
        setLocalExpenses(data.localExpenses || []);
      } catch (err: any) {
        setError(err.message || 'Error al conectar con la API.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // ==========================================
  // MODO REAL: CÁLCULOS Y ACCIONES
  // ==========================================
  const selectedInvoice = useMemo(() => {
    return foreignInvoices.find((inv) => inv._id === selectedInvoiceId) || null;
  }, [foreignInvoices, selectedInvoiceId]);

  const totalExpensesCrc = useMemo(() => {
    const localSum = localExpenses
      .filter((exp) => selectedExpenseIds.includes(exp._id))
      .reduce((sum, exp) => sum + (exp.grandTotalCrc || 0), 0);

    const manualSum = manualExpenses.reduce((sum, exp) => sum + Number(exp.amountCrc || 0), 0);

    return localSum + manualSum;
  }, [localExpenses, selectedExpenseIds, manualExpenses]);

  // Ejecutar el cálculo en tiempo real
  useEffect(() => {
    if (!selectedInvoiceId || activeMode !== 'real') {
      setPreviewCalculations([]);
      setLiquidationId(null);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setCalculating(true);
      setError(null);
      try {
        const associated = [
          ...localExpenses
            .filter((exp) => selectedExpenseIds.includes(exp._id))
            .map((exp) => ({
              transactionId: exp._id,
              expenseType: 'freight',
              amountCrc: exp.grandTotalCrc,
            })),
          ...manualExpenses.map((m) => ({
            expenseType: 'freight',
            amountCrc: m.amountCrc,
            description: m.description,
          })),
        ];

        const res = await fetch('/api/landed-cost', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            foreignInvoiceId: selectedInvoiceId,
            associatedExpenses: associated,
            distributionMethod,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al calcular costos.');

        setPreviewCalculations(data.calculations || []);
        setLiquidationId(data.liquidationId);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setCalculating(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [selectedInvoiceId, selectedExpenseIds, manualExpenses, distributionMethod, localExpenses, activeMode]);

  function addManualExpense() {
    const amount = Number(newManualAmount);
    if (!newManualDesc.trim() || isNaN(amount) || amount <= 0) return;
    setManualExpenses((prev) => [...prev, { description: newManualDesc.trim(), amountCrc: amount }]);
    setNewManualDesc('');
    setNewManualAmount('');
  }

  function removeManualExpense(index: number) {
    setManualExpenses((prev) => prev.filter((_, i) => i !== index));
  }

  function toggleExpenseSelection(id: string) {
    setSelectedExpenseIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function handleApplyLiquidation() {
    if (!liquidationId) return;

    setApplying(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/landed-cost', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liquidationId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al aplicar liquidación.');

      setSuccessMsg(data.message || 'Liquidación aplicada correctamente.');
      setSelectedInvoiceId('');
      setSelectedExpenseIds([]);
      setManualExpenses([]);
      setPreviewCalculations([]);
      setLiquidationId(null);
      onApplied();

      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Error al aplicar costos de importación.');
    } finally {
      setApplying(false);
    }
  }

  // ==========================================
  // SIMULADOR: CÁLCULOS Y ACCIONES
  // ==========================================
  // Filtrar productos para el buscador
  const filteredProductsForSim = useMemo(() => {
    const q = simProductSearch.trim().toLowerCase();
    if (!q) return [];
    return inventoryItems.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  }, [inventoryItems, simProductSearch]);

  // Agregar un producto real al simulador
  function addProductToSimulator(item: InventoryItem) {
    const newSimItem: SimulatedItem = {
      id: String(Date.now()),
      sku: item.sku,
      name: item.name,
      quantity: 10,
      unitPriceUsd: Math.round((item.purchasePrice / simExchangeRate) * 100) / 100 || 1.0,
    };
    setSimulatedItems((prev) => [...prev, newSimItem]);
    setSimProductSearch('');
    setShowSearchDropdown(false);
  }

  // Agregar un producto vacío/personalizado al simulador
  function addCustomProductToSimulator() {
    const newSimItem: SimulatedItem = {
      id: String(Date.now()),
      sku: 'CUSTOM-' + Math.floor(100 + Math.random() * 900),
      name: simProductSearch.trim() || 'Nuevo artículo importado',
      quantity: 1,
      unitPriceUsd: 10.0,
    };
    setSimulatedItems((prev) => [...prev, newSimItem]);
    setSimProductSearch('');
    setShowSearchDropdown(false);
  }

  // Modificar propiedades de un ítem simulado
  function updateSimulatedItem(id: string, field: keyof SimulatedItem, value: any) {
    setSimulatedItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  }

  // Eliminar un producto simulado
  function removeSimulatedItem(id: string) {
    setSimulatedItems((prev) => prev.filter((item) => item.id !== id));
  }

  // Cálculo en memoria del prorrateo simulado
  const simulationResults = useMemo(() => {
    const freightCrc = (Number(simFreightUsd) || 0) * simExchangeRate;
    const customsCrc = Number(simCustomsCrc) || 0;
    const handlingCrc = Number(simHandlingCrc) || 0;
    const totalSimExpensesCrc = freightCrc + customsCrc + handlingCrc;

    // Totales base FOB
    let totalFobValueCrc = 0;
    let totalQty = 0;

    simulatedItems.forEach((item) => {
      const lineCostCrc = item.quantity * item.unitPriceUsd * simExchangeRate;
      totalFobValueCrc += lineCostCrc;
      totalQty += item.quantity;
    });

    if (totalFobValueCrc === 0 || totalQty === 0) {
      return { calculations: [], totalSimExpensesCrc, totalFobValueCrc };
    }

    const calculations = simulatedItems.map((item) => {
      const baseCostCrc = item.unitPriceUsd * simExchangeRate;
      const totalLineCrc = item.quantity * baseCostCrc;

      let allocatedExpenseCrc = 0;
      if (simMethod === 'VALUE') {
        const weight = totalLineCrc / totalFobValueCrc;
        allocatedExpenseCrc = totalSimExpensesCrc * weight;
      } else {
        const weight = item.quantity / totalQty;
        allocatedExpenseCrc = totalSimExpensesCrc * weight;
      }

      const unitExpenseCrc = allocatedExpenseCrc / item.quantity;
      const unitLandedCostCrc = baseCostCrc + unitExpenseCrc;
      const suggestedSalePriceCrc = unitLandedCostCrc * (1 + targetMarkup / 100);

      return {
        ...item,
        baseCostCrc,
        allocatedExpenseCrc,
        unitExpenseCrc,
        unitLandedCostCrc,
        suggestedSalePriceCrc,
      };
    });

    return {
      calculations,
      totalSimExpensesCrc,
      totalFobValueCrc,
    };
  }, [simulatedItems, simExchangeRate, simFreightUsd, simCustomsCrc, simHandlingCrc, simMethod, targetMarkup]);

  return (
    <div className="space-y-4">
      {/* Selector de Modo (Tabs) */}
      <div className="flex gap-2 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-800">
        <button
          type="button"
          onClick={() => {
            setActiveMode('real');
            setError(null);
            setSuccessMsg(null);
          }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition ${activeMode === 'real'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
        >
          <Globe className="h-4 w-4 text-indigo-500" />
          Liquidación Real
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveMode('simulator');
            setError(null);
            setSuccessMsg(null);
          }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition ${activeMode === 'simulator'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
        >
          <Sparkles className="h-4 w-4 text-amber-500" />
          Simulador
        </button>
      </div>

      {/* Mensajes de feedback */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/20 bg-rose-950/40 p-4 text-sm text-rose-200">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-rose-400" />
          <p>{error}</p>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-950/40 p-4 text-sm text-emerald-200">
          <Check className="h-5 w-5 flex-shrink-0 text-emerald-400" />
          <p>{successMsg}</p>
        </div>
      )}

      {/* ==========================================
          VISTA: MODO LIQUIDACIÓN REAL
          ========================================== */}
      {activeMode === 'real' ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2 items-stretch">
            <div className="flex h-full min-w-0 flex-col rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <Globe className="h-4 w-4 text-indigo-500" />
                Factura internacional
              </h3>
              <select
                value={selectedInvoiceId}
                onChange={(e) => {
                  setSelectedInvoiceId(e.target.value);
                  setPreviewCalculations([]);
                }}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">Seleccione un invoice internacional (FOB)...</option>
                {foreignInvoices.map((inv) => (
                  <option key={inv._id} value={inv._id} disabled={inv.isLiquidated}>
                    {inv.merchantName} ({inv.documentId}) — {inv.currency} {inv.grandTotalForeign.toFixed(2)}
                    {inv.isLiquidated ? ' [LIQUIDADO]' : ''}
                  </option>
                ))}
              </select>
              {selectedInvoice && (
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                  <div><strong>Proveedor:</strong> {selectedInvoice.merchantName}</div>
                  <div><strong>Doc:</strong> {selectedInvoice.documentId}</div>
                  <div><strong>Total FOB:</strong> {selectedInvoice.currency} {selectedInvoice.grandTotalForeign.toFixed(2)}</div>
                  <div><strong>T.C:</strong> ₡{selectedInvoice.exchangeRate}</div>
                  <div className="col-span-2"><strong>Artículos:</strong> {selectedInvoice.items?.length || 0}</div>
                </div>
              )}
            </div>

            <div className="flex h-full min-w-0 flex-col rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <Scale className="h-4 w-4 text-indigo-500" />
                Fletes y aduanas
              </h3>
              {localExpenses.length === 0 ? (
                <p className="py-2 text-xs italic text-slate-500">No hay facturas nacionales disponibles.</p>
              ) : (
                <div className="max-h-32 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900 space-y-1.5">
                  {localExpenses.map((exp) => (
                    <label
                      key={exp._id}
                      className="flex items-center gap-2.5 rounded px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedExpenseIds.includes(exp._id)}
                        onChange={() => toggleExpenseSelection(exp._id)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="flex-1 truncate">
                        <strong>{exp.merchantName}</strong> ({exp.documentId})
                      </span>
                      <span className="font-mono text-slate-500 dark:text-slate-400">
                        {formatCurrency(exp.grandTotalCrc)}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <div className="mt-3 space-y-2">
                <label className="block text-xs font-medium text-slate-400">Gastos manuales adicionales (CRC)</label>
                <div className="flex gap-2">
                  <input
                    value={newManualDesc}
                    onChange={(e) => setNewManualDesc(e.target.value)}
                    placeholder="Ej: DAI / Courier"
                    className="h-8 w-20 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-950 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <input
                    type="number"
                    value={newManualAmount}
                    onChange={(e) => setNewManualAmount(e.target.value)}
                    placeholder="₡ Monto"
                    className="h-8 w-24 rounded-lg border border-slate-200 bg-white px-3 text-right font-mono text-xs text-slate-950 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={addManualExpense}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {manualExpenses.length > 0 && (
                  <div className="rounded-lg border border-indigo-500/10 bg-indigo-500/5 p-2 space-y-1.5">
                    {manualExpenses.map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs px-2 py-1 bg-white dark:bg-slate-900 rounded border border-indigo-500/10">
                        <span className="text-slate-700 dark:text-slate-300 truncate">{m.description}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-indigo-400 font-semibold">{formatCurrency(m.amountCrc)}</span>
                          <button
                            type="button"
                            onClick={() => removeManualExpense(idx)}
                            className="text-slate-400 hover:text-rose-400 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex h-full min-w-0 flex-col rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Coins className="h-4 w-4 text-indigo-500" />
              Metodo de prorrateo
            </h3>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-white p-1 mb-3 dark:border-slate-800 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setDistributionMethod('VALUE')}
                className={`flex flex-col items-center justify-center rounded-md py-2 px-1 text-center transition ${distributionMethod === 'VALUE'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                <span className="text-xs font-semibold">Por Valor (FOB)</span>
                <span className="text-[10px] opacity-75">Costo proporcional</span>
              </button>
              <button
                type="button"
                onClick={() => setDistributionMethod('QUANTITY')}
                className={`flex flex-col items-center justify-center rounded-md py-2 px-1 text-center transition ${distributionMethod === 'QUANTITY'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                <span className="text-xs font-semibold">Por Cantidad</span>
                <span className="text-[10px] opacity-75">Tarifa plana</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Total fletes y aduanas:</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(totalExpensesCrc)}</span>
                </div>
                {selectedInvoice && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Base FOB (CRC):</span>
                    <span className="font-mono text-slate-900 dark:text-slate-100">
                      {formatCurrency(selectedInvoice.items?.reduce((sum: number, i: any) => sum + i.quantity * i.unitPriceForeign * selectedInvoice.exchangeRate, 0) || 0)}
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                {selectedInvoice && (
                  <div className="flex justify-between text-xs border-t border-dashed border-slate-200 pt-2 font-medium dark:border-slate-700">
                    <span className="text-slate-700 dark:text-slate-300">Costo en bodega:</span>
                    <span className="font-mono text-emerald-400 font-semibold">
                      {formatCurrency((selectedInvoice.items?.reduce((sum: number, i: any) => sum + i.quantity * i.unitPriceForeign * selectedInvoice.exchangeRate, 0) || 0) + totalExpensesCrc)}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  disabled={!liquidationId || applying || calculating}
                  onClick={handleApplyLiquidation}
                  className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {applying ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Aplicando...</>
                  ) : (
                    <><Calculator className="h-4 w-4" />Aplicar liquidacion</>
                  )}
                </button>
              </div>
            </div>
          </div>

          {selectedInvoice && (
            <div className="flex h-full min-w-0 flex-col rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <FileText className="h-4 w-4 text-indigo-500" />
                  Prorrateo por producto
                </h3>
                {calculating && (
                  <span className="flex items-center gap-1 text-xs text-indigo-400">
                    <Loader2 className="h-3 w-3 animate-spin" />Recalculando...
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-medium">
                      <th className="px-2 py-2">Producto</th>
                      <th className="px-2 py-2 text-center">Cant.</th>
                      <th className="px-2 py-2 text-right">FOB (USD)</th>
                      <th className="px-2 py-2 text-right">Costo (CRC)</th>
                      <th className="px-2 py-2 text-right">Gasto</th>
                      <th className="px-2 py-2 text-right font-semibold text-indigo-400">Landed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {previewCalculations.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-2 py-2">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 block">{item.name}</span>
                          <span className="font-mono text-[10px] text-slate-500">{item.sku}</span>
                        </td>
                        <td className="px-2 py-2 text-center font-mono text-slate-600 dark:text-slate-400">{item.quantity}</td>
                        <td className="px-2 py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                          ${(selectedInvoice.items.find((oi: any) => oi.sku === item.sku || oi.description === item.name)?.unitPriceForeign || 0).toFixed(2)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-slate-600 dark:text-slate-400">{formatCurrency(item.baseCostCrc)}</td>
                        <td className="px-2 py-2 text-right font-mono text-indigo-400/80">+{formatCurrency(item.unitExpenseCrc)}</td>
                        <td className="px-2 py-2 text-right font-mono font-semibold text-indigo-400">{formatCurrency(item.unitLandedCostCrc)}</td>
                      </tr>
                    ))}
                    {previewCalculations.length === 0 && (
                      <tr><td colSpan={6} className="py-8 text-center text-slate-500 italic">Cargando items...</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2 items-stretch">
            <div className="flex h-full min-w-0 flex-col rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Productos en simulacion
              </h3>
              <div className="relative mb-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={simProductSearch}
                  onChange={(e) => { setSimProductSearch(e.target.value); setShowSearchDropdown(true); }}
                  onFocus={() => setShowSearchDropdown(true)}
                  placeholder="Buscar producto..."
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-16 text-sm text-slate-950 outline-none transition focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                {simProductSearch.trim().length > 0 && (
                  <button type="button" onClick={addCustomProductToSimulator}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-indigo-600 px-2 py-1.5 text-[10px] font-semibold text-white hover:bg-indigo-500 transition">Crear</button>
                )}
                {showSearchDropdown && filteredProductsForSim.length > 0 && (
                  <div className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-800 dark:bg-slate-950">
                    {filteredProductsForSim.map((p) => (
                      <button key={p.sku} type="button" onClick={() => addProductToSimulator(p)}
                        className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800">
                        <span className="text-slate-800 dark:text-slate-200 truncate font-medium">{p.name}</span>
                        <span className="font-mono text-[10px] text-slate-500">{p.sku} · ₡{p.purchasePrice}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {simulatedItems.length === 0 ? (
                <div className="py-8 text-center text-xs italic text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">No hay productos en la simulacion.</div>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {simulatedItems.map((item) => (
                    <div key={item.id} className="grid grid-cols-[1fr_50px_80px_32px] items-center gap-2 rounded-lg border border-slate-200/60 bg-white p-2 dark:border-slate-800/80 dark:bg-slate-900">
                      <div className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-200">{item.name}</span>
                        <span className="font-mono text-[10px] text-slate-500">{item.sku}</span>
                      </div>
                      <input type="number" min="1" value={item.quantity}
                        onChange={(e) => updateSimulatedItem(item.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                        className="h-7 w-full rounded-md border border-slate-200 bg-slate-50 text-center font-mono text-xs text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                      <div className="relative">
                        <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">$</span>
                        <input type="number" min="0" step="0.01" value={item.unitPriceUsd}
                          onChange={(e) => updateSimulatedItem(item.id, 'unitPriceUsd', Math.max(0, parseFloat(e.target.value) || 0))}
                          className="h-7 w-full rounded-md border border-slate-200 bg-slate-50 pl-4 pr-1 text-right font-mono text-xs text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </div>
                      <button type="button" onClick={() => removeSimulatedItem(item.id)}
                        className="flex h-7 items-center justify-center text-slate-400 hover:text-rose-400 transition">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex h-full min-w-0 flex-col rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <Scale className="h-4 w-4 text-amber-500" />
                Costos estimados
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-slate-400">T.C (USD a CRC)</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">₡</span>
                    <input type="number" value={simExchangeRate}
                      onChange={(e) => setSimExchangeRate(Math.max(1, parseFloat(e.target.value) || 1))}
                      className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-5 pr-2 font-mono text-xs text-slate-950 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-slate-400">Flete (USD)</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
                    <input type="number" value={simFreightUsd}
                      onChange={(e) => setSimFreightUsd(e.target.value)}
                      className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-5 pr-2 font-mono text-xs text-slate-950 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-slate-400">Aduana (CRC)</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">₡</span>
                    <input type="number" value={simCustomsCrc}
                      onChange={(e) => setSimCustomsCrc(e.target.value)}
                      className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-5 pr-2 font-mono text-xs text-slate-950 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-slate-400">Manejo (CRC)</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">₡</span>
                    <input type="number" value={simHandlingCrc}
                      onChange={(e) => setSimHandlingCrc(e.target.value)}
                      className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-5 pr-2 font-mono text-xs text-slate-950 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex h-full min-w-0 flex-col rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Coins className="h-4 w-4 text-amber-500" />
              Resumen simulado
            </h3>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-white p-1 mb-3 dark:border-slate-800 dark:bg-slate-900">
              <button type="button" onClick={() => setSimMethod('VALUE')}
                className={`flex flex-col items-center justify-center rounded-md py-1.5 text-center text-xs transition ${simMethod === 'VALUE' ? 'bg-amber-500 text-slate-950 shadow font-bold' : 'text-slate-400 hover:text-slate-200'}`}>
                <span>Por Valor</span>
              </button>
              <button type="button" onClick={() => setSimMethod('QUANTITY')}
                className={`flex flex-col items-center justify-center rounded-md py-1.5 text-center text-xs transition ${simMethod === 'QUANTITY' ? 'bg-amber-500 text-slate-950 shadow font-bold' : 'text-slate-400 hover:text-slate-200'}`}>
                <span>Por Cantidad</span>
              </button>
            </div>
            <div className="mb-3 space-y-1">
              <label className="flex items-center justify-between text-[10px] font-medium text-slate-400">
                <span>Margen de venta deseado</span>
                <span className="text-amber-400 font-semibold">{targetMarkup}%</span>
              </label>
              <input type="range" min="5" max="150" step="5" value={targetMarkup}
                onChange={(e) => { setTargetMarkup(parseInt(e.target.value) || 10); setPriceAnimationKey((p) => p + 1); }}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Total fletes:</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(simulationResults.totalSimExpensesCrc)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Mercancia FOB:</span>
                  <span className="font-mono text-slate-900 dark:text-slate-100">{formatCurrency(simulationResults.totalFobValueCrc)}</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs border-t border-dashed border-slate-200 pt-2 font-medium dark:border-slate-700">
                  <span className="text-slate-700 dark:text-slate-300">Costo total:</span>
                  <span className="font-mono text-amber-400 font-bold">{formatCurrency(simulationResults.totalFobValueCrc + simulationResults.totalSimExpensesCrc)}</span>
                </div>
              </div>
              <div>
                <div className="rounded-lg bg-amber-500/10 p-2 text-[10px] text-amber-300 border border-amber-500/20">
                  <p><strong>Simulacion:</strong> Solo proyecciones.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex h-full min-w-0 flex-col rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <FileText className="h-4 w-4 text-amber-500" />
              Proyeccion de importacion
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-medium">
                    <th className="px-2 py-2">Producto</th>
                    <th className="px-2 py-2 text-center">Cant.</th>
                    <th className="px-2 py-2 text-right">FOB (USD)</th>
                    <th className="px-2 py-2 text-right">FOB (CRC)</th>
                    <th className="px-2 py-2 text-right">Gasto</th>
                    <th className="px-2 py-2 text-right font-semibold text-amber-400">Landed</th>
                    <th className="px-2 py-2 text-right font-semibold text-emerald-400">P. Venta Sug.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {simulationResults.calculations.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-2 py-2">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 block">{item.name}</span>
                        <span className="font-mono text-[10px] text-slate-500">{item.sku}</span>
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-slate-600 dark:text-slate-400">{item.quantity}</td>
                      <td className="px-2 py-2 text-right font-mono text-slate-600 dark:text-slate-400">${item.unitPriceUsd.toFixed(2)}</td>
                      <td className="px-2 py-2 text-right font-mono text-slate-600 dark:text-slate-400">{formatCurrency(item.baseCostCrc)}</td>
                      <td className="px-2 py-2 text-right font-mono text-amber-500/80">+{formatCurrency(item.unitExpenseCrc)}</td>
                      <td className="px-2 py-2 text-right font-mono font-semibold text-amber-400">{formatCurrency(item.unitLandedCostCrc)}</td>
                      <td className="px-2 py-2 text-right font-mono font-bold text-emerald-400">
                        <span key={`price-${item.id}-${priceAnimationKey}`}>{formatCurrency(item.suggestedSalePriceCrc)}</span>
                      </td>
                    </tr>
                  ))}
                  {simulatedItems.length === 0 && (
                    <tr><td colSpan={7} className="py-8 text-center text-slate-500 italic">Agregue productos para ver la proyeccion.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

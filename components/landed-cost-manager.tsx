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
  Loader2
} from 'lucide-react';
import { formatCurrency } from '@/lib/dashboard-utils';

interface LandedCostManagerProps {
  onApplied: () => void;
}

export default function LandedCostManager({ onApplied }: LandedCostManagerProps) {
  // Datos cargados desde API
  const [foreignInvoices, setForeignInvoices] = useState<any[]>([]);
  const [localExpenses, setLocalExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Estados del formulario
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [manualExpenses, setManualExpenses] = useState<{ description: string; amountCrc: number }[]>([]);
  const [distributionMethod, setDistributionMethod] = useState<'VALUE' | 'QUANTITY'>('VALUE');

  // Control de gastos manuales
  const [newManualDesc, setNewManualDesc] = useState('');
  const [newManualAmount, setNewManualAmount] = useState('');

  // Borrador calculado en tiempo real
  const [previewCalculations, setPreviewCalculations] = useState<any[]>([]);
  const [liquidationId, setLiquidationId] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [applying, setApplying] = useState(false);

  // Cargar facturas y gastos iniciales
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

  // Buscar factura seleccionada en el estado local
  const selectedInvoice = useMemo(() => {
    return foreignInvoices.find((inv) => inv._id === selectedInvoiceId) || null;
  }, [foreignInvoices, selectedInvoiceId]);

  // Suma total de gastos seleccionados y manuales en CRC
  const totalExpensesCrc = useMemo(() => {
    const localSum = localExpenses
      .filter((exp) => selectedExpenseIds.includes(exp._id))
      .reduce((sum, exp) => sum + (exp.grandTotalCrc || 0), 0);

    const manualSum = manualExpenses.reduce((sum, exp) => sum + Number(exp.amountCrc || 0), 0);

    return localSum + manualSum;
  }, [localExpenses, selectedExpenseIds, manualExpenses]);

  // Ejecutar el cálculo (simulación o guardado de borrador)
  useEffect(() => {
    if (!selectedInvoiceId) {
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
              expenseType: 'freight', // Asumido por defecto, editable contablemente
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
    }, 400); // Debounce de 400ms para evitar llamadas excesivas al escribir gastos manuales

    return () => clearTimeout(delayDebounce);
  }, [selectedInvoiceId, selectedExpenseIds, manualExpenses, distributionMethod, localExpenses]);

  // Manejar adición de gasto manual
  function addManualExpense() {
    const amount = Number(newManualAmount);
    if (!newManualDesc.trim() || isNaN(amount) || amount <= 0) return;
    setManualExpenses((prev) => [...prev, { description: newManualDesc.trim(), amountCrc: amount }]);
    setNewManualDesc('');
    setNewManualAmount('');
  }

  // Manejar eliminación de gasto manual
  function removeManualExpense(index: number) {
    setManualExpenses((prev) => prev.filter((_, i) => i !== index));
  }

  // Alternar selección de gasto local
  function toggleExpenseSelection(id: string) {
    setSelectedExpenseIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  // Aplicar la liquidación de importación
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
      // Reiniciar formulario
      setSelectedInvoiceId('');
      setSelectedExpenseIds([]);
      setManualExpenses([]);
      setPreviewCalculations([]);
      setLiquidationId(null);
      // Notificar al dashboard principal para recargar
      onApplied();
      
      // Limpiar mensaje de éxito tras 5 segundos
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Error al aplicar costos de importación.');
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <span className="ml-2 text-sm text-slate-500">Cargando importaciones y fletes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mensajes de feedback */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/20 bg-rose-950/40 p-4 text-sm text-rose-200">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-rose-400" />
          <p>{error}</p>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-950/40 p-4 text-sm text-emerald-200 animate-fadeIn">
          <Check className="h-5 w-5 flex-shrink-0 text-emerald-400" />
          <p>{successMsg}</p>
        </div>
      )}

      {/* Contenedor Principal */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Columna Izquierda: Configuración del prorrateo */}
        <div className="space-y-5">
          {/* Tarjeta 1: Selección de Factura del Proveedor */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Globe className="h-4.5 w-4.5 text-indigo-500" />
              1. Seleccionar factura internacional
            </h3>
            <select
              value={selectedInvoiceId}
              onChange={(e) => {
                setSelectedInvoiceId(e.target.value);
                setPreviewCalculations([]);
              }}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
              <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                <div className="grid grid-cols-2 gap-y-1.5">
                  <div><strong>Proveedor:</strong> {selectedInvoice.merchantName}</div>
                  <div><strong>Documento:</strong> {selectedInvoice.documentId}</div>
                  <div><strong>Total FOB:</strong> {selectedInvoice.currency} {selectedInvoice.grandTotalForeign.toFixed(2)}</div>
                  <div><strong>Tipo Cambio:</strong> ₡{selectedInvoice.exchangeRate}</div>
                  <div className="col-span-2"><strong>Artículos:</strong> {selectedInvoice.items?.length || 0} productos importados</div>
                </div>
              </div>
            )}
          </div>

          {/* Tarjeta 2: Gastos Locales Asociados (Checklist y Manuales) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Scale className="h-4.5 w-4.5 text-indigo-500" />
              2. Asociar costos de fletes y aduanas
            </h3>

            {/* Checklist de compras del sistema */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400">Facturas registradas de flete o agencia aduanal (CRC)</label>
              {localExpenses.length === 0 ? (
                <p className="py-2 text-xs italic text-slate-500">No hay facturas nacionales de compra disponibles.</p>
              ) : (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950 space-y-1.5">
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
            </div>

            {/* Gastos Manuales (Adicionales) */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/60 space-y-3">
              <label className="block text-xs font-medium text-slate-400">Agregar gastos adicionales no facturados o manuales (CRC)</label>
              <div className="flex gap-2">
                <input
                  value={newManualDesc}
                  onChange={(e) => setNewManualDesc(e.target.value)}
                  placeholder="Ej: Impuestos aduana DAI / Courier"
                  className="h-9 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-950 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <input
                  type="number"
                  value={newManualAmount}
                  onChange={(e) => setNewManualAmount(e.target.value)}
                  placeholder="₡ Monto"
                  className="h-9 w-28 rounded-lg border border-slate-200 bg-slate-50 px-3 text-right font-mono text-xs text-slate-950 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={addManualExpense}
                  className="flex h-9 items-center justify-center rounded-lg bg-indigo-600 px-3 text-white hover:bg-indigo-500 transition"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* Lista de gastos manuales agregados */}
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

        {/* Columna Derecha: Tarjeta de Liquidación y Método */}
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Coins className="h-4.5 w-4.5 text-indigo-500" />
              Resumen de liquidación
            </h3>

            {/* Método de Distribución */}
            <div className="mb-4 space-y-2">
              <label className="text-xs font-medium text-slate-400">Método de prorrateo</label>
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950">
                <button
                  type="button"
                  onClick={() => setDistributionMethod('VALUE')}
                  className={`flex flex-col items-center justify-center rounded-md py-2 px-1 text-center transition ${
                    distributionMethod === 'VALUE'
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
                  className={`flex flex-col items-center justify-center rounded-md py-2 px-1 text-center transition ${
                    distributionMethod === 'QUANTITY'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="text-xs font-semibold">Por Cantidad</span>
                  <span className="text-[10px] opacity-75">Tarifa plana por unidad</span>
                </button>
              </div>
            </div>

            {/* Cuentas Financieras */}
            <div className="my-4 border-t border-slate-100 pt-3 dark:border-slate-800/60 space-y-2.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Total Fletes y Aduanas (CRC):</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(totalExpensesCrc)}
                </span>
              </div>
              {selectedInvoice && (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Base Mercancía FOB (CRC):</span>
                    <span className="font-mono text-slate-900 dark:text-slate-100">
                      {formatCurrency(
                        selectedInvoice.items?.reduce(
                          (sum: number, i: any) => sum + i.quantity * i.unitPriceForeign * selectedInvoice.exchangeRate,
                          0
                        ) || 0
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs border-t border-dashed border-slate-200 dark:border-slate-800 pt-2 font-medium">
                    <span className="text-slate-500">Total Costo de Carga (Bodega):</span>
                    <span className="font-mono text-emerald-400 font-semibold">
                      {formatCurrency(
                        (selectedInvoice.items?.reduce(
                          (sum: number, i: any) => sum + i.quantity * i.unitPriceForeign * selectedInvoice.exchangeRate,
                          0
                        ) || 0) + totalExpensesCrc
                      )}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Acción de aplicar */}
            <button
              type="button"
              disabled={!liquidationId || applying || calculating}
              onClick={handleApplyLiquidation}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {applying ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  Aplicando inventario...
                </>
              ) : (
                <>
                  <Calculator className="h-4.5 w-4.5" />
                  Aplicar Liquidación
                </>
              )}
            </button>
            {!selectedInvoiceId && (
              <p className="mt-2 text-center text-[10px] text-slate-500">
                Seleccione una factura internacional para iniciar
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Sección Inferior: Previsualización detallada del prorrateo */}
      {selectedInvoice && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <FileText className="h-4.5 w-4.5 text-indigo-500" />
              Previsualización detallada del prorrateo por producto
            </h3>
            {calculating && (
              <span className="flex items-center gap-1 text-xs text-indigo-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Recalculando...
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-medium bg-slate-50 dark:bg-slate-950/40">
                  <th className="px-3 py-2.5">Producto (SKU)</th>
                  <th className="px-3 py-2.5 text-center">Cant.</th>
                  <th className="px-3 py-2.5 text-right">Precio FOB (USD)</th>
                  <th className="px-3 py-2.5 text-right">Costo FOB (CRC)</th>
                  <th className="px-3 py-2.5 text-right">Gasto Prorrateado (CRC)</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-indigo-400">Costo Landed Unit. (CRC)</th>
                  <th className="px-3 py-2.5 text-center">Incremento (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {previewCalculations.map((item, idx) => {
                  const pct = item.baseCostCrc > 0 
                    ? ((item.unitLandedCostCrc - item.baseCostCrc) / item.baseCostCrc) * 100 
                    : 0;

                  // Encontrar precio FOB en USD original
                  const originalItem = selectedInvoice.items.find((oi: any) => 
                    oi.sku === item.sku || oi.description === item.name
                  );
                  const fObUsd = originalItem ? originalItem.unitPriceForeign : 0;

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-3 py-3">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 block">{item.name}</span>
                        <span className="font-mono text-[10px] text-slate-500">{item.sku}</span>
                      </td>
                      <td className="px-3 py-3 text-center font-mono font-medium text-slate-600 dark:text-slate-400">
                        {item.quantity}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-slate-600 dark:text-slate-400">
                        ${fObUsd.toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-slate-600 dark:text-slate-400">
                        {formatCurrency(item.baseCostCrc)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-indigo-400/80">
                        +{formatCurrency(item.unitExpenseCrc)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-semibold text-indigo-400">
                        {formatCurrency(item.unitLandedCostCrc)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-400">
                          +{pct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {previewCalculations.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 italic">
                      Cargando ítems de la factura...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

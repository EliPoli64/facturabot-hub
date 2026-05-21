'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, Download, FileDown, FileSpreadsheet, PackagePlus, RefreshCw, Upload, ShoppingCart, Tag } from 'lucide-react';
import type { AlertItem, InventoryItem, KPIData, LeftTab, SectionErrors } from '@/lib/dashboard-types';
import DashboardHeader from '@/components/dashboard-header';
import UploadZone from '@/components/upload-zone';
import KpiCards from '@/components/kpi-cards';
import InventoryTable from '@/components/inventory-table';
import AlertsPanel from '@/components/alerts-panel';
import ChatPanel from '@/components/chat-panel';
import PriceManager from '@/components/price-manager';
import AddProductPanel from '@/components/add-product-panel';
import SalesChart from '@/components/sales-chart';
import ReportsPanel from '@/components/reports-panel';

export default function DashboardPage() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('facturabotTheme');
      return stored ? stored === 'dark' : true;
    }
    return true;
  });
  const [businessName, setBusinessName] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('facturabotBusinessName') || 'FacturaBot CR';
    }
    return 'FacturaBot CR';
  });
  const [leftTab, setLeftTab] = useState<LeftTab>('upload');
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [mongoConnected, setMongoConnected] = useState(false);
  const [telegramActive, setTelegramActive] = useState(false);
  const [kpiData, setKpiData] = useState<KPIData>({
    salesToday: 0,
    balance: 0,
    activeAlerts: 0,
    transactionsToday: 0,
    purchasesToday: 0,
    salesCountToday: 0,
    deltaVsYesterday: 12,
    lastUpdatedMinutes: 0,
  });
  const [exchangeRate, setExchangeRate] = useState<{ rate: number; updatedAt: string } | null>(null);
  const [sectionErrors, setSectionErrors] = useState<SectionErrors>({
    kpis: null,
    alerts: null,
    chat: null,
  });

  const alertsSectionRef = useRef<HTMLElement | null>(null);
  const businessNameRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    window.localStorage.setItem('facturabotTheme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const loadDashboardData = useCallback(async (): Promise<void> => {
    setKpiLoading(true);
    setAlertsLoading(true);
    setSectionErrors((c) => ({ ...c, kpis: null, alerts: null }));

    const [statsResult, alertsResult, inventoryResult, rateResult] = await Promise.allSettled([
      fetch('/api/stats'),
      fetch('/api/alerts'),
      fetch('/api/inventory'),
      fetch('/api/rates'),
    ]);

    if (rateResult.status === 'fulfilled') {
      const rateData = await rateResult.value.json();
      setExchangeRate(rateData);
    }

    let fetchedInventory: InventoryItem[] = [];
    if (inventoryResult.status === 'fulfilled') {
      fetchedInventory = await inventoryResult.value.json();
      setInventoryItems(fetchedInventory);
    }

    if (statsResult.status === 'fulfilled') {
      const stats = await statsResult.value.json();
      setMongoConnected(true);
      setKpiData((c) => ({
        ...c,
        salesToday: stats.salesToday ?? 0,
        balance: stats.balance ?? 0,
        salesCountToday: stats.salesCountToday ?? 0,
        purchasesToday: stats.purchasesToday ?? 0,
        transactionsToday: stats.transactionsToday ?? 0,
        deltaVsYesterday: stats.deltaVsYesterday ?? 0,
        lastUpdatedMinutes: stats.lastUpdatedMinutes ?? 1,
      }));
    } else {
      setMongoConnected(false);
      setSectionErrors((c) => ({ ...c, kpis: 'No fue posible cargar las metricas desde el motor de datos.' }));
    }

    if (alertsResult.status === 'fulfilled') {
      const rawAlerts = await alertsResult.value.json();
      const mappedAlerts: AlertItem[] = rawAlerts.map((item: { sku?: string; message?: string }) => {
        const product = fetchedInventory.find((i) => i.sku === item.sku);
        const estimatedDays = product ? Math.max(1, Math.ceil(product.currentStock / 2)) : 3;
        return {
          sku: item.sku || 'SKU',
          message: item.message || 'Producto en riesgo de quiebre',
          productName: product?.name || item.sku || 'Producto sin nombre',
          daysOfStock: estimatedDays,
          isActive: true,
        };
      });
      setTelegramActive(true);
      setAlerts(mappedAlerts);
      setKpiData((c) => ({ ...c, activeAlerts: mappedAlerts.length }));
    } else {
      setTelegramActive(false);
      setSectionErrors((c) => ({ ...c, alerts: 'No se pudieron obtener las alertas activas del sistema.' }));
      setAlerts([]);
      setKpiData((c) => ({ ...c, activeAlerts: 0 }));
    }

    setKpiLoading(false);
    setAlertsLoading(false);
  }, []);

  useEffect(() => { void loadDashboardData(); }, [loadDashboardData]); // eslint-disable-line react-hooks/set-state-in-effect

  function handleBusinessNameSave(name: string): void {
    setBusinessName(name);
    window.localStorage.setItem('facturabotBusinessName', name);
  }

  const tabs: { key: LeftTab; label: string; icon: React.ReactNode }[] = [
    { key: 'upload', label: 'Subir', icon: <Upload className="h-3.5 w-3.5" /> },
    { key: 'prices', label: 'Precios', icon: <Tag className="h-3.5 w-3.5" /> },
    { key: 'add', label: 'Agregar', icon: <PackagePlus className="h-3.5 w-3.5" /> },
    { key: 'reports', label: 'Reportes', icon: <BarChart3 className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-[#0F1117] dark:text-slate-100">
      <DashboardHeader
        isDarkMode={isDarkMode}
        onToggleDark={() => setIsDarkMode((c) => !c)}
        businessName={businessName}
        onBusinessNameSave={handleBusinessNameSave}
        mongoConnected={mongoConnected}
        telegramActive={telegramActive}
        alertsCount={alerts.length}
        businessNameRef={businessNameRef}
        exchangeRate={exchangeRate}
      />

      <div className="mx-auto max-w-[1680px] px-4 py-4 md:px-6 md:py-6 xl:px-8">
        <div className="mb-5 xl:hidden">
          <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm dark:border-slate-800 dark:bg-[#161B27] dark:text-slate-300">
            {businessName}
          </span>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-[1fr_2fr_360px] xl:items-start">
          <section className="order-2 space-y-5 md:order-1 xl:order-1">
            <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-800">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setLeftTab(t.key)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
                    leftTab === t.key
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            {leftTab === 'upload' && <UploadZone onUploadComplete={loadDashboardData} />}
            {leftTab === 'prices' && <PriceManager inventoryItems={inventoryItems} onUpdated={loadDashboardData} />}
            {leftTab === 'add' && <AddProductPanel onCreated={loadDashboardData} />}
            {leftTab === 'reports' && <ReportsPanel />}

            <InventoryTable inventoryItems={inventoryItems} alerts={alerts} />
          </section>

          <section className="order-1 space-y-5 md:order-2 xl:order-2">
            <div className="mb-1 flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">Dashboard maestro</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Operacion comercial en tiempo real para Costa Rica.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="group relative">
                  <button
                    type="button"
                    aria-label="Exportar"
                    className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <div className="absolute right-0 top-full z-50 mt-1 hidden w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900 group-focus-within:block group-hover:block">
                    <a
                      href="/api/export/transactions?format=xlsx"
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                      Transacciones XLSX
                    </a>
                    <a
                      href="/api/export/transactions?format=pdf"
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <FileDown className="h-4 w-4 text-rose-500" />
                      Transacciones PDF
                    </a>
                    <a
                      href="/api/export/inventory?format=pdf"
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <FileDown className="h-4 w-4 text-indigo-500" />
                      Inventario PDF
                    </a>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void loadDashboardData()}
                  aria-label="Refrescar metricas"
                  className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700"
                >
                  <RefreshCw className={`h-4 w-4 ${kpiLoading || alertsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <KpiCards
              kpiData={kpiData}
              kpiLoading={kpiLoading}
              sectionErrors={sectionErrors}
              onAlertsClick={() => alertsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            />

            <section ref={alertsSectionRef}>
              <AlertsPanel alerts={alerts} alertsLoading={alertsLoading} sectionErrors={sectionErrors} />
            </section>

            <SalesChart />
          </section>

          <ChatPanel />
        </div>
      </div>
    </div>
  );
}

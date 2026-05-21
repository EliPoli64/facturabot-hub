'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  DollarSign,
  Loader2,
  MessageSquare,
  MoreVertical,
  Package,
  Send,
  ShoppingBag,
  TrendingUp,
  Upload,
  Users,
  X,
  Sparkles,
  ShieldCheck,
  Zap,
  BellRing,
  Search,
  Activity
} from 'lucide-react';

export default function Dashboard() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<
    { role: 'user' | 'bot'; text: string; timestamp?: Date }[]
  >([]);
  const [inputText, setInputText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [inventory, setInventory] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [stats, setStats] = useState({
    balance: 0,
    salesToday: 0,
    totalItems: 0,
    lowStockCount: 0,
    profit: 0,
    customers: 0
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setTimeout(() => {
      const mockInventory = [
        {
          sku: 'SKU001',
          name: 'Auriculares Nova',
          currentStock: 18,
          salePrice: 32000,
          category: 'Tecnología',
          status: 'Disponible'
        },
        {
          sku: 'SKU002',
          name: 'Smart Watch X',
          currentStock: 2,
          salePrice: 68000,
          category: 'Wearables',
          status: 'Stock Bajo'
        },
        {
          sku: 'SKU003',
          name: 'Teclado Mecánico',
          currentStock: 11,
          salePrice: 42000,
          category: 'Gaming',
          status: 'Disponible'
        },
        {
          sku: 'SKU004',
          name: 'Monitor UltraWide',
          currentStock: 4,
          salePrice: 155000,
          category: 'Monitores',
          status: 'Stock Bajo'
        }
      ];

      setInventory(mockInventory);

      setAlerts([
        {
          sku: 'SKU002',
          message: 'Smart Watch X necesita reposición inmediata',
          severity: 'high',
          timestamp: 'Hace 15 minutos'
        },
        {
          sku: 'SKU004',
          message: 'Monitor UltraWide alcanzó el límite mínimo',
          severity: 'medium',
          timestamp: 'Hace 1 hora'
        }
      ]);

      setStats({
        balance: 1250000,
        salesToday: 385000,
        totalItems: 4,
        lowStockCount: 2,
        profit: 112000,
        customers: 29
      });
    }, 700);
  }, []);

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setIsUploading(true);

    setTimeout(() => {
      alert(`Factura procesada correctamente: ${file.name}`);
      setIsUploading(false);
    }, 1800);
  };

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const userMessage = {
      role: 'user' as const,
      text: inputText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);

    const lowerInput = inputText.toLowerCase();

    setInputText('');
    setIsTyping(true);

    setTimeout(() => {
      let response =
        'Estoy listo para ayudarte con ventas, inventario, métricas y rendimiento de tu negocio.';

      if (
        lowerInput.includes('venta') ||
        lowerInput.includes('hoy')
      ) {
        response = `Hoy llevas ₡${stats.salesToday.toLocaleString()} en ventas. El rendimiento subió un 12.4% respecto a ayer.`;
      }

      if (
        lowerInput.includes('stock') ||
        lowerInput.includes('inventario')
      ) {
        response = `Actualmente tienes ${inventory.filter(i => i.currentStock <= 4).length} productos con stock crítico.`;
      }

      if (
        lowerInput.includes('ganancia') ||
        lowerInput.includes('beneficio')
      ) {
        response = `Tu ganancia actual es de ₡${stats.profit.toLocaleString()} con excelente margen operativo.`;
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'bot',
          text: response,
          timestamp: new Date()
        }
      ]);

      setIsTyping(false);
    }, 1000);
  };

  const filteredInventory = inventory.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statCard = ({
    title,
    value,
    icon: Icon,
    trend,
    gradient
  }: any) => (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/70 backdrop-blur-xl p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
      <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-gradient-to-br opacity-10 blur-2xl ${gradient}" />

      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>

          <h3 className="mt-2 text-3xl font-black text-slate-900">
            {value}
          </h3>

          <div className="mt-3 flex items-center gap-1">
            {trend > 0 ? (
              <ArrowUpRight className="text-emerald-500" size={16} />
            ) : (
              <ArrowDownRight className="text-red-500" size={16} />
            )}

            <span
              className={`text-xs font-semibold ${
                trend > 0
                  ? 'text-emerald-600'
                  : 'text-red-500'
              }`}
            >
              {Math.abs(trend)}%
            </span>

            <span className="text-xs text-slate-400">
              vs semana pasada
            </span>
          </div>
        </div>

        <div
          className={`rounded-2xl bg-gradient-to-r ${gradient} p-4 shadow-lg`}
        >
          <Icon size={24} className="text-white" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050816] text-white">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-[-10%] top-0 h-[500px] w-[500px] rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute right-[-10%] top-[20%] h-[500px] w-[500px] rounded-full bg-cyan-500/20 blur-3xl" />
      </div>

      <div className="relative z-10 p-4 md:p-8">
        <header className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-4 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-r from-fuchsia-500 to-cyan-500 shadow-2xl">
                <Zap size={28} className="text-white" />
              </div>

              <div>
                <h1 className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-5xl font-black text-transparent">
                  FacturaBot
                </h1>

                <p className="mt-1 text-sm text-slate-400">
                  Centro inteligente de operaciones comerciales
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-300">
                <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                Sistema activo
              </div>

              <div className="flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-300">
                <ShieldCheck size={16} />
                IA protegida
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xl">
              <Search size={18} className="text-slate-400" />

              <input
                type="text"
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-transparent text-sm outline-none placeholder:text-slate-500"
              />
            </div>

            <button className="relative rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl transition hover:bg-white/20">
              <BellRing size={20} />
              <div className="absolute right-3 top-3 h-2 w-2 rounded-full bg-red-500" />
            </button>
          </div>
        </header>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {statCard({
            title: 'Balance Total',
            value: `₡${stats.balance.toLocaleString()}`,
            icon: DollarSign,
            trend: 8.2,
            gradient: 'from-emerald-500 to-green-600'
          })}

          {statCard({
            title: 'Ventas del Día',
            value: `₡${stats.salesToday.toLocaleString()}`,
            icon: ShoppingBag,
            trend: 12.8,
            gradient: 'from-cyan-500 to-blue-600'
          })}

          {statCard({
            title: 'Ganancia',
            value: `₡${stats.profit.toLocaleString()}`,
            icon: TrendingUp,
            trend: 5.9,
            gradient: 'from-fuchsia-500 to-pink-600'
          })}

          {statCard({
            title: 'Clientes Activos',
            value: stats.customers,
            icon: Users,
            trend: -1.3,
            gradient: 'from-orange-500 to-red-600'
          })}
        </div>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
          <div className="space-y-8 xl:col-span-2">
            <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
              <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <Package className="text-cyan-400" size={24} />

                    <h2 className="text-2xl font-bold">
                      Inventario Inteligente
                    </h2>
                  </div>

                  <p className="mt-2 text-sm text-slate-400">
                    Control total del flujo de productos
                  </p>
                </div>

                <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-5 py-3 text-sm font-semibold shadow-lg transition hover:scale-105">
                  {isUploading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Upload size={18} />
                  )}

                  {isUploading
                    ? 'Procesando factura...'
                    : 'Subir Factura'}

                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>

              <div className="overflow-hidden rounded-3xl border border-white/10">
                <table className="w-full overflow-hidden">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-400">
                        Producto
                      </th>

                      <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-400">
                        Categoría
                      </th>

                      <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-400">
                        Stock
                      </th>

                      <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-400">
                        Precio
                      </th>

                      <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-400">
                        Estado
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredInventory.map(item => (
                      <tr
                        key={item.sku}
                        className="border-t border-white/5 transition hover:bg-white/5"
                      >
                        <td className="px-6 py-5">
                          <div>
                            <p className="font-semibold text-white">
                              {item.name}
                            </p>

                            <p className="text-xs text-slate-500">
                              {item.sku}
                            </p>
                          </div>
                        </td>

                        <td className="px-6 py-5 text-sm text-slate-300">
                          {item.category}
                        </td>

                        <td className="px-6 py-5">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              item.currentStock <= 4
                                ? 'bg-red-500/20 text-red-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {item.currentStock} unidades
                          </span>
                        </td>

                        <td className="px-6 py-5 font-semibold text-white">
                          ₡{item.salePrice.toLocaleString()}
                        </td>

                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-2 w-2 rounded-full ${
                                item.currentStock <= 4
                                  ? 'bg-red-500 animate-pulse'
                                  : 'bg-emerald-400'
                              }`}
                            />

                            <span className="text-sm text-slate-300">
                              {item.status}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
              <div className="mb-6 flex items-center gap-3">
                <Activity className="text-fuchsia-400" size={24} />

                <h2 className="text-2xl font-bold">
                  Actividad Reciente
                </h2>
              </div>

              <div className="space-y-4">
                {[
                  {
                    title: 'Factura procesada',
                    detail: 'INV-2026-001.xml',
                    time: 'Hace 2 minutos'
                  },
                  {
                    title: 'Venta completada',
                    detail: 'Smart Watch X',
                    time: 'Hace 18 minutos'
                  },
                  {
                    title: 'Stock actualizado',
                    detail: 'Auriculares Nova',
                    time: 'Hace 1 hora'
                  }
                ].map((activity, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 p-4 transition hover:bg-white/10"
                  >
                    <div>
                      <p className="font-semibold text-white">
                        {activity.title}
                      </p>

                      <p className="text-sm text-slate-400">
                        {activity.detail}
                      </p>
                    </div>

                    <span className="text-xs text-slate-500">
                      {activity.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle
                    className="text-amber-400"
                    size={24}
                  />

                  <h2 className="text-2xl font-bold">Alertas</h2>
                </div>

                <div className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold text-red-300">
                  {alerts.length} nuevas
                </div>
              </div>

              <div className="space-y-4">
                {alerts.map((alert, index) => (
                  <div
                    key={index}
                    className={`rounded-2xl border p-4 ${
                      alert.severity === 'high'
                        ? 'border-red-500/20 bg-red-500/10'
                        : 'border-cyan-500/20 bg-cyan-500/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">
                          {alert.message}
                        </p>

                        <p className="mt-2 text-xs text-slate-400">
                          {alert.timestamp}
                        </p>
                      </div>

                      <MoreVertical
                        size={18}
                        className="text-slate-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] bg-gradient-to-br from-fuchsia-600 to-cyan-600 p-6 shadow-2xl">
              <div className="mb-4 flex items-center gap-3">
                <Sparkles size={24} />

                <h3 className="text-2xl font-black">
                  Asistente IA
                </h3>
              </div>

              <p className="mb-6 text-sm text-white/80">
                Analiza ventas, flujo de caja, métricas y predicciones en tiempo real.
              </p>

              <button
                onClick={() => setIsChatOpen(true)}
                className="w-full rounded-2xl bg-white/20 px-5 py-4 font-semibold backdrop-blur-md transition hover:bg-white/30"
              >
                Abrir Asistente
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`fixed bottom-6 right-6 z-50 flex h-[650px] w-[380px] flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#0b1020]/95 shadow-2xl backdrop-blur-2xl transition-all duration-300 ${
          isChatOpen
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-10 opacity-0'
        }`}
      >
        <div className="flex items-center justify-between bg-gradient-to-r from-fuchsia-600 to-cyan-600 p-5">
          <div>
            <h3 className="text-xl font-black text-white">
              FacturaBot IA
            </h3>

            <p className="text-xs text-white/70">
              Inteligencia empresarial en vivo
            </p>
          </div>

          <button
            onClick={() => setIsChatOpen(false)}
            className="rounded-xl bg-white/10 p-2 transition hover:bg-white/20"
          >
            <X size={18} className="text-white" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-5 rounded-3xl bg-gradient-to-r from-fuchsia-500 to-cyan-500 p-5 shadow-2xl">
                <MessageSquare size={30} />
              </div>

              <h4 className="text-xl font-bold text-white">
                Bienvenido
              </h4>

              <p className="mt-2 max-w-xs text-sm text-slate-400">
                Pregunta sobre ventas, ganancias, inventario o métricas.
              </p>
            </div>
          )}

          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${
                msg.role === 'user'
                  ? 'justify-end'
                  : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm shadow-lg ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white'
                    : 'border border-white/10 bg-white/5 text-slate-200'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                Escribiendo...
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        <div className="border-t border-white/10 p-5">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e =>
                e.key === 'Enter' && handleSendMessage()
              }
              placeholder="Escribe tu pregunta..."
              className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
            />

            <button
              onClick={handleSendMessage}
              className="rounded-2xl bg-gradient-to-r from-fuchsia-500 to-cyan-500 p-3 shadow-lg transition hover:scale-105"
            >
              <Send size={18} className="text-white" />
            </button>
          </div>
        </div>
      </div>

      {!isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 z-50 rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 p-5 shadow-2xl transition hover:scale-110"
        >
          <MessageSquare size={24} className="text-white" />
        </button>
      )}
    </div>
  );
}
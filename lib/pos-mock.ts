export interface PosSystem {
  id: string;
  name: string;
  terminalCount: number;
  status: 'connected' | 'disconnected' | 'error';
  lastSync: Date | null;
  cashiers: string[];
}

export const MOCK_POS_SYSTEMS: PosSystem[] = [
  {
    id: 'el-cazador',
    name: 'El Cazador',
    terminalCount: 2,
    status: 'connected',
    lastSync: new Date(),
    cashiers: ['Ana Martinez', 'Carlos Quesada', 'Maria Chacon'],
  },
  {
    id: 'posnet',
    name: 'POSnet',
    terminalCount: 1,
    status: 'connected',
    lastSync: new Date(Date.now() - 3600000),
    cashiers: ['Roberto Fernandez', 'Sofia Mendez'],
  },
  {
    id: 'datasystem',
    name: 'DataSystem',
    terminalCount: 1,
    status: 'error',
    lastSync: new Date(Date.now() - 86400000),
    cashiers: ['Laura Vargas'],
  },
];

const PRODUCT_CATALOG = [
  { sku: 'ARROZ-001', name: 'Arroz Integral 1kg', price: 1250, taxRate: 0.02 },
  { sku: 'FRIJ-001', name: 'Frijoles Negros 500g', price: 980, taxRate: 0.02 },
  { sku: 'ACEI-001', name: 'Aceite Vegetal 900ml', price: 1850, taxRate: 0.13 },
  { sku: 'LECH-001', name: 'Leche Entera 1L', price: 890, taxRate: 0.02 },
  { sku: 'HUEV-001', name: 'Huevos Carton 12u', price: 1650, taxRate: 0.02 },
  { sku: 'PAN-001', name: 'Pan Integral 500g', price: 1200, taxRate: 0.02 },
  { sku: 'CAFE-001', name: 'Cafe 1820 200g', price: 2100, taxRate: 0.13 },
  { sku: 'AZUC-001', name: 'Azucar Blanco 1kg', price: 950, taxRate: 0.02 },
  { sku: 'SAL-001', name: 'Sal de Mesa 500g', price: 450, taxRate: 0.02 },
  { sku: 'GASE-001', name: 'Gaseosa 2L', price: 1350, taxRate: 0.13 },
  { sku: 'JABO-001', name: 'Jabon de Lavar 500g', price: 1100, taxRate: 0.13 },
  { sku: 'SHAM-001', name: 'Shampoo 400ml', price: 2900, taxRate: 0.13 },
  { sku: 'DENT-001', name: 'Pasta Dental 120ml', price: 1750, taxRate: 0.13 },
  { sku: 'DET-001', name: 'Detergente 1kg', price: 2200, taxRate: 0.13 },
  { sku: 'LIMP-001', name: 'Limpiador Multiusos 1L', price: 1450, taxRate: 0.13 },
  { sku: 'SERVI-001', name: 'Servilletas 200u', price: 780, taxRate: 0.13 },
  { sku: 'PAPEL-001', name: 'Papel Higienico 4u', price: 1350, taxRate: 0.13 },
  { sku: 'GALL-001', name: 'Galletas Integrales 200g', price: 890, taxRate: 0.13 },
  { sku: 'CERE-001', name: 'Cereal de Maiz 300g', price: 1650, taxRate: 0.13 },
  { sku: 'AGUA-001', name: 'Agua Purificada 1.5L', price: 650, taxRate: 0.02 },
  { sku: 'TEC-001', name: 'Cable USB-C', price: 3500, taxRate: 0.13 },
  { sku: 'TEC-002', name: 'Cargador 20W', price: 6500, taxRate: 0.13 },
  { sku: 'TEC-003', name: 'Audifonos Bluetooth', price: 8900, taxRate: 0.13 },
  { sku: 'LACT-001', name: 'Yogurt Natural 1L', price: 1450, taxRate: 0.02 },
  { sku: 'LACT-002', name: 'Queso Fresco 500g', price: 2100, taxRate: 0.02 },
  { sku: 'EMB-001', name: 'Atun en Lata 170g', price: 1250, taxRate: 0.13 },
  { sku: 'EMB-002', name: 'Sardinas 150g', price: 980, taxRate: 0.13 },
  { sku: 'BEB-001', name: 'Jugo Natural 500ml', price: 1100, taxRate: 0.13 },
  { sku: 'BEB-002', name: 'Cerveza 355ml', price: 850, taxRate: 0.13 },
  { sku: 'COND-001', name: 'Salsa de Tomate 300g', price: 750, taxRate: 0.13 },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickItems(): { sku: string; name: string; quantity: number; unitPrice: number; taxRate: number }[] {
  const count = randInt(2, 8);
  const shuffled = [...PRODUCT_CATALOG].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((p) => ({
    sku: p.sku,
    name: p.name,
    quantity: randInt(1, 5),
    unitPrice: p.price,
    taxRate: p.taxRate,
  }));
}

function hourlyWeight(hour: number): number {
  const w: Record<number, number> = {
    6: 1, 7: 3, 8: 6, 9: 8, 10: 10,
    11: 9, 12: 7, 13: 5, 14: 7, 15: 9,
    16: 10, 17: 8, 18: 6, 19: 4, 20: 2,
  };
  return w[hour] ?? 0;
}

export interface GeneratedTransaction {
  type: 'SALE';
  source: 'MANUAL';
  documentType: 'pos_ticket';
  origin: 'national';
  documentId: string;
  merchantName: string;
  merchantTaxId: string;
  currency: string;
  exchangeRate: number;
  items: {
    sku: string;
    description: string;
    quantity: number;
    unitPriceForeign: number;
    discount: number;
    taxRate: number;
    taxAmountForeign: number;
    totalLineForeign: number;
  }[];
  subTotalForeign: number;
  taxAmountForeign: number;
  grandTotalForeign: number;
  grandTotalCrc: number;
  createdAt: Date;
  updatedAt: Date;
}

export function generateDailyTransactions(date: Date): GeneratedTransaction[] {
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0) return [];

  const isSaturday = dayOfWeek === 6;
  const baseCount = isSaturday ? randInt(15, 30) : randInt(25, 50);

  const hours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].filter(
    (h) => h <= (isSaturday ? 18 : 20),
  );

  const totalWeight = hours.reduce((sum, h) => sum + hourlyWeight(h), 0);

  const transactions: GeneratedTransaction[] = [];

  for (let i = 0; i < baseCount; i++) {
    const rand = Math.random() * totalWeight;
    let cumulative = 0;
    let selectedHour = hours[0];
    for (const h of hours) {
      cumulative += hourlyWeight(h);
      if (rand <= cumulative) {
        selectedHour = h;
        break;
      }
    }

    const minute = randInt(0, 59);
    const txDate = new Date(date);
    txDate.setHours(selectedHour, minute, randInt(0, 59), 0);

    const system = pick(MOCK_POS_SYSTEMS);
    const cashier = pick(system.cashiers);
    const items = pickItems();

    const transactionItems = items.map((i) => ({
      sku: i.sku,
      description: i.name,
      quantity: i.quantity,
      unitPriceForeign: i.unitPrice,
      discount: 0,
      taxRate: i.taxRate,
      taxAmountForeign: Math.round(i.quantity * i.unitPrice * i.taxRate),
      totalLineForeign: i.quantity * i.unitPrice,
    }));

    const subTotal = items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);
    const taxAmount = items
      .filter((i) => i.taxRate > 0)
      .reduce((a, i) => a + Math.round(i.quantity * i.unitPrice * i.taxRate), 0);
    const grandTotal = subTotal + taxAmount;

    const prefix = system.id === 'el-cazador' ? 'EC' : system.id === 'posnet' ? 'PN' : 'DS';
    const documentId = `${prefix}-${txDate.getTime()}-${String(i).padStart(3, '0')}`;

    transactions.push({
      type: 'SALE',
      source: 'MANUAL',
      documentType: 'pos_ticket',
      origin: 'national',
      documentId,
      merchantName: `${system.name} - ${cashier}`,
      merchantTaxId: '000000000',
      currency: 'CRC',
      exchangeRate: 1,
      items: transactionItems,
      subTotalForeign: subTotal,
      taxAmountForeign: taxAmount,
      grandTotalForeign: grandTotal,
      grandTotalCrc: grandTotal,
      createdAt: txDate,
      updatedAt: txDate,
    });
  }

  return transactions;
}

export async function generateMockBatch(days: number = 90): Promise<GeneratedTransaction[]> {
  const now = new Date();
  const all: GeneratedTransaction[] = [];

  for (let d = 0; d < days; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    all.push(...generateDailyTransactions(date));
  }

  return all;
}

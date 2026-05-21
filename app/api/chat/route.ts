import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType, Tool } from '@google/generative-ai';
import dbConnect from '@/lib/db';
import { Inventory, Transaction, Alert } from '@/models/Schemas';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Tool implementations
async function getTodaySalesSummary() {
  await dbConnect();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  
  const sales = await Transaction.find({
    type: 'SALE',
    createdAt: { $gte: start }
  });

  const total = sales.reduce(
   (acc, curr) => acc + curr.grandTotalCrc,
   0
 );
  return { count: sales.length, totalAmount: total };
}

async function getActiveStockAlerts() {
  await dbConnect();
  const alerts = await Alert.find({ isActive: true });
  return alerts.map(a => ({ sku: a.sku, message: a.message }));
}

async function getCashFlowBalance() {
  await dbConnect();
  const transactions = await Transaction.find({});
  
  const balance = transactions.reduce((acc, curr) => {
    const amount = curr.grandTotalCrc;
    return curr.type === 'SALE' ? acc + amount : acc - amount;
  }, 0);

  return { balance };
}

async function getItemPriceHistory(query: string) {
  await dbConnect();

  const invItems = await Inventory.find({
    $or: [
      { sku: { $regex: query, $options: 'i' } },
      { name: { $regex: query, $options: 'i' } },
    ],
  });

  if (invItems.length === 0) {
    const txItems = await Transaction.find(
      { 'items.description': { $regex: query, $options: 'i' } },
      { 'items.$': 1, type: 1, createdAt: 1, merchantName: 1, currency: 1, exchangeRate: 1 },
    ).sort({ createdAt: -1 }).limit(20);

    if (txItems.length === 0) {
      return { found: false, message: `No se encontraron transacciones para "${query}".` };
    }

    const prices = txItems.map(tx => {
      const item = tx.items[0];
      return {
        date: (tx as any).createdAt,
        type: tx.type,
        merchant: tx.merchantName,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPriceForeign,
        currency: tx.currency,
        totalLine: item.totalLineForeign,
      };
    });

    return { found: true, matchedBy: 'description', items: prices };
  }

  const skus = invItems.map(i => i.sku);
  const name = invItems[0].name;

  const transactions = await Transaction.find(
    { 'items.sku': { $in: skus } },
  ).sort({ createdAt: -1 }).limit(30);

  const prices = transactions.flatMap(tx =>
    tx.items
      .filter(item => skus.includes(item.sku || ''))
      .map(item => ({
        date: (tx as any).createdAt,
        type: tx.type,
        merchant: tx.merchantName,
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPriceForeign,
        currency: tx.currency,
        exchangeRate: tx.exchangeRate,
        totalLine: item.totalLineForeign,
      }))
  );

  return {
    found: true,
    matchedBy: 'sku',
    itemName: name,
    skus,
    currentStock: invItems[0].currentStock,
    currentSalePrice: invItems[0].salePrice,
    currentPurchasePrice: invItems[0].purchasePrice,
    history: prices,
  };
}

const tools: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "getTodaySalesSummary",
        description: "Returns the number of sales and total revenue for today.",
      },
      {
        name: "getActiveStockAlerts",
        description: "Returns all active low stock alerts.",
      },
      {
        name: "getCashFlowBalance",
        description: "Calculates the total cash flow balance (Sales - Purchases).",
      },
      {
        name: "getItemPriceHistory",
        description: "Busca el historial de precios de compra/venta de un producto por su SKU o nombre.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            query: {
              type: SchemaType.STRING,
              description: "SKU o nombre del producto a buscar.",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "getStockVelocity",
        description: "Calcula la velocidad de ventas diaria promedio de cada producto en los ultimos 30 dias.",
      },
      {
        name: "getForecast",
        description: "Pronostica fechas de quiebre de stock basado en la velocidad de ventas de los ultimos 30 dias. Identifica productos criticos (menos de 15 dias) y en advertencia (15-30 dias).",
      },
    ],
  },
];

const SYSTEM_INSTRUCTION = `Eres FacturaBot, el asistente de inteligencia de negocios para retail en Costa Rica.
Hablas español y responded de forma clara y concisa basada en datos reales.
Puedes consultar ventas del día, alertas de inventario, saldo de caja e historial de precios de productos usando las herramientas disponibles.
Tambien puedes analizar la velocidad de ventas y pronosticar fechas de quiebre de stock para ayudar al comerciante a reordenar a tiempo.
Para consultar precios históricos usa getItemPriceHistory con el SKU o nombre del producto.
Si no tienes una herramienta para responder, indícalo amablemente.`;

async function getStockVelocity() {
  await dbConnect();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sales = await Transaction.aggregate([
    { $match: { type: 'SALE', createdAt: { $gte: thirtyDaysAgo } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.sku',
        totalQty: { $sum: '$items.quantity' },
        description: { $first: '$items.description' },
      },
    },
  ]);

  if (sales.length === 0) {
    return { found: false, message: 'No hay ventas en los ultimos 30 dias para calcular velocidad.' };
  }

  const inventory = await Inventory.find({});
  const stockMap = new Map(inventory.map((i) => [i.sku, i.currentStock]));

  const items = sales.map((s) => {
    const dailyAvg = s.totalQty / 30;
    const stock = stockMap.get(s._id) || 0;
    const daysRemaining = dailyAvg > 0 ? Math.round(stock / dailyAvg) : 999;
    return {
      sku: s._id || 'SIN-SKU',
      description: s.description,
      totalSold30d: s.totalQty,
      dailyAvg: Math.round(dailyAvg * 100) / 100,
      currentStock: stock,
      daysRemaining,
    };
  });

  return { found: true, items };
}

async function getForecast() {
  await dbConnect();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sales = await Transaction.aggregate([
    { $match: { type: 'SALE', createdAt: { $gte: thirtyDaysAgo } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.sku',
        totalQty: { $sum: '$items.quantity' },
        description: { $first: '$items.description' },
      },
    },
  ]);

  const inventory = await Inventory.find({});
  const stockMap = new Map(inventory.map((i) => [i.sku, { stock: i.currentStock, name: i.name, purchasePrice: i.purchasePrice, salePrice: i.salePrice }]));

  const forecasts = sales.map((s) => {
    const dailyAvg = s.totalQty / 30;
    const inv = stockMap.get(s._id);
    const stock = inv?.stock || 0;
    const daysRemaining = dailyAvg > 0 ? Math.round(stock / dailyAvg) : 999;
    const stockoutDate = daysRemaining < 999 ? new Date(Date.now() + daysRemaining * 86400000).toISOString().split('T')[0] : null;
    const valueAtRisk = inv ? stock * inv.purchasePrice : 0;

    return {
      sku: s._id || 'SIN-SKU',
      description: s.description || inv?.name || 'Producto',
      currentStock: stock,
      dailyAvgSales: Math.round(dailyAvg * 100) / 100,
      estimatedDaysUntilStockout: daysRemaining,
      predictedStockoutDate: stockoutDate,
      inventoryValueAtRisk: Math.round(valueAtRisk),
      suggestedReorder: dailyAvg > 0 && daysRemaining < 15
        ? `Reordenar ${Math.ceil(dailyAvg * 30)} unidades para cubrir 30 dias`
        : null,
    };
  });

  const critical = forecasts.filter((f) => f.estimatedDaysUntilStockout < 15 && f.estimatedDaysUntilStockout > 0).sort((a, b) => a.estimatedDaysUntilStockout - b.estimatedDaysUntilStockout);
  const warning = forecasts.filter((f) => f.estimatedDaysUntilStockout >= 15 && f.estimatedDaysUntilStockout < 30);

  return {
    found: forecasts.length > 0,
    summary: {
      totalProductsTracked: forecasts.length,
      criticalCount: critical.length,
      warningCount: warning.length,
      healthyCount: forecasts.length - critical.length - warning.length,
    },
    critical,
    warning,
    all: forecasts.slice(0, 20),
  };
}

const functionHandlers: Record<string, (args?: Record<string, unknown>) => Promise<unknown>> = {
  getTodaySalesSummary: () => getTodaySalesSummary(),
  getActiveStockAlerts: () => getActiveStockAlerts(),
  getCashFlowBalance: () => getCashFlowBalance(),
  getItemPriceHistory: (args) => getItemPriceHistory(args?.query as string),
  getStockVelocity: () => getStockVelocity(),
  getForecast: () => getForecast(),
};

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_INSTRUCTION,
      tools,
    });

    const chat = model.startChat();
    let response = await chat.sendMessage(message);
    let responseText = response.response.text() || '';

    const MAX_TURNS = 5;
    let turn = 0;

    while (response.response.functionCalls() && turn < MAX_TURNS) {
      const calls = response.response.functionCalls()!;
      const results: Record<string, unknown> = {};

      for (const call of calls) {
        const handler = functionHandlers[call.name];
        if (handler) {
          results[call.name] = await handler(call.args as Record<string, unknown> | undefined);
        }
      }

      const resultParts = calls.map((call) => ({
        functionResponse: {
          name: call.name,
          response: {
            name: call.name,
            content: typeof results[call.name] === 'object' && !Array.isArray(results[call.name])
              ? results[call.name] as Record<string, unknown>
              : { data: results[call.name] },
          },
        },
      }));

      response = await chat.sendMessage(resultParts);
      const newText = response.response.text();
      if (newText) responseText = newText;
      turn++;
    }

    const finalText = response.response.text();
    return NextResponse.json({ text: finalText || responseText || 'No se pudo generar una respuesta.' });
  } catch (error: any) {
    console.error('Chat Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

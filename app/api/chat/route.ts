import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, Tool } from '@google/generative-ai';
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
      }
    ],
  },
];

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();
    // For now, we'll return a static response.
    // If you want to use a different model, you can change this implementation.
    return NextResponse.json({ text: "This feature is currently disabled." });

  } catch (error: any) {
    console.error('Chat Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

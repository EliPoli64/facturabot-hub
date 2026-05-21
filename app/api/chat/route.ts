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

  const total = sales.reduce((acc, curr) => acc + curr.subTotal + curr.taxAmount, 0);
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
    const amount = curr.subTotal + curr.taxAmount;
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
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      tools,
    });

    const chat = model.startChat();
    const result = await chat.sendMessage(message);
    const response = result.response;
    const call = response.functionCalls()?.[0];

    if (call) {
      let toolResult;
      if (call.name === "getTodaySalesSummary") toolResult = await getTodaySalesSummary();
      if (call.name === "getActiveStockAlerts") toolResult = await getActiveStockAlerts();
      if (call.name === "getCashFlowBalance") toolResult = await getCashFlowBalance();

      const finalResult = await chat.sendMessage([
        {
          functionResponse: {
            name: call.name,
            response: { content: toolResult },
          },
        },
      ]);
      
      return NextResponse.json({ text: finalResult.response.text() });
    }

    return NextResponse.json({ text: response.text() });

  } catch (error: any) {
    console.error('Chat Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

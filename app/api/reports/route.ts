import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { Transaction, Inventory } from '@/models/Schemas';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'pnl';

    if (type === 'pnl') {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      const [monthlyIncome, yearlyIncome, monthlyExpenses, yearlyExpenses] = await Promise.all([
        Transaction.aggregate([
          { $match: { type: 'SALE', createdAt: { $gte: startOfMonth } } },
          { $group: { _id: null, total: { $sum: '$grandTotalCrc' }, count: { $sum: 1 } } },
        ]),
        Transaction.aggregate([
          { $match: { type: 'SALE', createdAt: { $gte: startOfYear } } },
          { $group: { _id: null, total: { $sum: '$grandTotalCrc' }, count: { $sum: 1 } } },
        ]),
        Transaction.aggregate([
          { $match: { type: 'PURCHASE', createdAt: { $gte: startOfMonth } } },
          { $group: { _id: null, total: { $sum: '$grandTotalCrc' }, count: { $sum: 1 } } },
        ]),
        Transaction.aggregate([
          { $match: { type: 'PURCHASE', createdAt: { $gte: startOfYear } } },
          { $group: { _id: null, total: { $sum: '$grandTotalCrc' }, count: { $sum: 1 } } },
        ]),
      ]);

      const incomeMonthly = monthlyIncome[0]?.total || 0;
      const incomeYearly = yearlyIncome[0]?.total || 0;
      const expensesMonthly = monthlyExpenses[0]?.total || 0;
      const expensesYearly = yearlyExpenses[0]?.total || 0;

      return NextResponse.json({
        type: 'pnl',
        month: {
          income: incomeMonthly,
          expenses: expensesMonthly,
          net: incomeMonthly - expensesMonthly,
        },
        year: {
          income: incomeYearly,
          expenses: expensesYearly,
          net: incomeYearly - expensesYearly,
        },
      });
    }

    if (type === 'balance') {
      const [inventoryAgg, totalIncome, totalExpenses] = await Promise.all([
        Inventory.aggregate([
          { $group: { _id: null, totalValue: { $sum: { $multiply: ['$currentStock', '$purchasePrice'] } } } },
        ]),
        Transaction.aggregate([
          { $match: { type: 'SALE' } },
          { $group: { _id: null, total: { $sum: '$grandTotalCrc' } } },
        ]),
        Transaction.aggregate([
          { $match: { type: 'PURCHASE' } },
          { $group: { _id: null, total: { $sum: '$grandTotalCrc' } } },
        ]),
      ]);

      const inventoryValue = inventoryAgg[0]?.totalValue || 0;
      const allIncome = totalIncome[0]?.total || 0;
      const allExpenses = totalExpenses[0]?.total || 0;
      const cash = allIncome - allExpenses;

      return NextResponse.json({
        type: 'balance',
        assets: {
          inventory: inventoryValue,
          cash,
          total: inventoryValue + cash,
        },
        equity: allIncome - allExpenses,
      });
    }

    if (type === 'iva') {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      const [monthlyIva, yearlyIva] = await Promise.all([
        Transaction.aggregate([
          { $match: { createdAt: { $gte: startOfMonth } } },
          { $group: {
            _id: '$type',
            taxAmount: { $sum: '$taxAmountForeign' },
            count: { $sum: 1 },
          }},
        ]),
        Transaction.aggregate([
          { $match: { createdAt: { $gte: startOfYear } } },
          { $group: {
            _id: '$type',
            taxAmount: { $sum: '$taxAmountForeign' },
            count: { $sum: 1 },
          }},
        ]),
      ]);

      const monthlyIvaCollected = monthlyIva.find((r) => r._id === 'SALE')?.taxAmount || 0;
      const monthlyIvaPaid = monthlyIva.find((r) => r._id === 'PURCHASE')?.taxAmount || 0;
      const yearlyIvaCollected = yearlyIva.find((r) => r._id === 'SALE')?.taxAmount || 0;
      const yearlyIvaPaid = yearlyIva.find((r) => r._id === 'PURCHASE')?.taxAmount || 0;

      return NextResponse.json({
        type: 'iva',
        month: {
          collected: monthlyIvaCollected,
          paid: monthlyIvaPaid,
          netPayable: monthlyIvaCollected - monthlyIvaPaid,
        },
        year: {
          collected: yearlyIvaCollected,
          paid: yearlyIvaPaid,
          netPayable: yearlyIvaCollected - yearlyIvaPaid,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid report type. Use pnl, balance, or iva.' }, { status: 400 });
  } catch (error) {
    console.error('Report error:', error);
    return NextResponse.json({ error: 'Error generating report' }, { status: 500 });
  }
}

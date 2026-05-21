import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { Transaction, Inventory } from '@/models/Schemas';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'pnl';

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    if (type === 'pnl') {
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

    if (type === 'trends') {
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

      const [monthlyIncomeAgg, monthlyExpensesAgg, monthlyCounts] = await Promise.all([
        Transaction.aggregate([
          { $match: { type: 'SALE', createdAt: { $gte: sixMonthsAgo } } },
          { $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            total: { $sum: '$grandTotalCrc' },
            count: { $sum: 1 },
          }},
          { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]),
        Transaction.aggregate([
          { $match: { type: 'PURCHASE', createdAt: { $gte: sixMonthsAgo } } },
          { $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            total: { $sum: '$grandTotalCrc' },
          }},
          { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]),
        Transaction.aggregate([
          { $match: { createdAt: { $gte: sixMonthsAgo } } },
          { $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            count: { $sum: 1 },
          }},
          { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]),
      ]);

      const months: { label: string; income: number; expenses: number; count: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
        const inc = monthlyIncomeAgg.find(
          (r: any) => r._id.year === d.getFullYear() && r._id.month === d.getMonth() + 1,
        );
        const exp = monthlyExpensesAgg.find(
          (r: any) => r._id.year === d.getFullYear() && r._id.month === d.getMonth() + 1,
        );
        const cnt = monthlyCounts.find(
          (r: any) => r._id.year === d.getFullYear() && r._id.month === d.getMonth() + 1,
        );
        months.push({
          label: d.toLocaleDateString('es-CR', { month: 'short' }),
          income: inc?.total || 0,
          expenses: exp?.total || 0,
          count: cnt?.count || 0,
        });
      }

      return NextResponse.json({ type: 'trends', months });
    }

    if (type === 'top-products') {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      const [topSales, topPurchases] = await Promise.all([
        Transaction.aggregate([
          { $match: { type: 'SALE', createdAt: { $gte: yearStart } } },
          { $unwind: '$items' },
          { $group: {
            _id: { sku: '$items.sku', name: '$items.description' },
            totalQuantity: { $sum: '$items.quantity' },
            totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.unitPriceForeign'] } },
          }},
          { $sort: { totalRevenue: -1 } },
          { $limit: 5 },
        ]),
        Transaction.aggregate([
          { $match: { type: 'PURCHASE', origin: 'international' } },
          { $unwind: '$items' },
          { $group: {
            _id: { sku: '$items.sku', name: '$items.description' },
            totalQuantity: { $sum: '$items.quantity' },
            totalCost: { $sum: { $multiply: ['$items.quantity', '$items.unitPriceForeign'] } },
          }},
          { $sort: { totalCost: -1 } },
          { $limit: 5 },
        ]),
      ]);

      return NextResponse.json({
        type: 'top-products',
        topSales: topSales.map((r: any) => ({
          sku: r._id.sku,
          name: r._id.name,
          quantity: r.totalQuantity,
          revenue: r.totalRevenue,
        })),
        topPurchases: topPurchases.map((r: any) => ({
          sku: r._id.sku,
          name: r._id.name,
          quantity: r.totalQuantity,
          cost: r.totalCost,
        })),
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

    return NextResponse.json({ error: 'Invalid report type. Use pnl, trends, top-products, balance, or iva.' }, { status: 400 });
  } catch (error) {
    console.error('Report error:', error);
    return NextResponse.json({ error: 'Error generating report' }, { status: 500 });
  }
}

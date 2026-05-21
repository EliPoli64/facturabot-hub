import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { Transaction } from '@/models/Schemas';

export async function GET() {
  try {
    await dbConnect();

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const [todayTransactions, yesterdayTransactions, allTransactions] = await Promise.all([
      Transaction.find({ createdAt: { $gte: startOfToday } }),
      Transaction.find({
        createdAt: { $gte: startOfYesterday, $lt: startOfToday },
      }),
      Transaction.find({}),
    ]);

    const todaySales = todayTransactions.filter((t) => t.type === 'SALE');
    const todayPurchases = todayTransactions.filter((t) => t.type === 'PURCHASE');
    const yesterdaySales = yesterdayTransactions.filter((t) => t.type === 'SALE');

    const salesToday = todaySales.reduce((acc, t) => acc + t.grandTotalCrc, 0);
    const salesYesterday = yesterdaySales.reduce((acc, t) => acc + t.grandTotalCrc, 0);
    const purchasesToday = todayPurchases.reduce((acc, t) => acc + t.grandTotalCrc, 0);

    const balance = allTransactions.reduce((acc, t) => {
      return t.type === 'SALE' ? acc + t.grandTotalCrc : acc - t.grandTotalCrc;
    }, 0);

    const deltaVsYesterday =
      salesYesterday > 0 ? Math.round(((salesToday - salesYesterday) / salesYesterday) * 100) : 0;

    return NextResponse.json({
      salesToday,
      balance,
      activeAlerts: 0,
      transactionsToday: todayTransactions.length,
      purchasesToday: todayPurchases.length,
      salesCountToday: todaySales.length,
      deltaVsYesterday,
      lastUpdatedMinutes: 1,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

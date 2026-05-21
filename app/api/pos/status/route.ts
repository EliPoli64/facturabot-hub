import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { Transaction } from '@/models/Schemas';
import { MOCK_POS_SYSTEMS } from '@/lib/pos-mock';

export async function GET() {
  try {
    await dbConnect();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalSales, todaySales, systemBreakdown] = await Promise.all([
      Transaction.countDocuments({
        source: 'MANUAL',
        documentType: 'pos_ticket',
        type: 'SALE',
      }),
      Transaction.aggregate([
        {
          $match: {
            source: 'MANUAL',
            documentType: 'pos_ticket',
            type: 'SALE',
            createdAt: { $gte: today },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            total: { $sum: '$grandTotalCrc' },
          },
        },
      ]),
      Transaction.aggregate([
        {
          $match: {
            source: 'MANUAL',
            documentType: 'pos_ticket',
            type: 'SALE',
          },
        },
        {
          $group: {
            _id: '$merchantName',
            count: { $sum: 1 },
            total: { $sum: '$grandTotalCrc' },
            lastSale: { $max: '$createdAt' },
          },
        },
        { $sort: { total: -1 } },
      ]),
    ]);

    const systems = MOCK_POS_SYSTEMS.map((sys) => {
      const sysBreakdown = systemBreakdown.filter(
        (b: any) => b._id && b._id.startsWith(sys.name),
      );
      const terminalSales = sysBreakdown.reduce((acc: number, b: any) => acc + b.count, 0);
      const terminalTotal = sysBreakdown.reduce((acc: number, b: any) => acc + b.total, 0);
      const lastSale = sysBreakdown.reduce(
        (latest: Date | null, b: any) => {
          const d = new Date(b.lastSale);
          return !latest || d > latest ? d : latest;
        },
        null,
      );

      return {
        ...sys,
        lastSync: lastSale || sys.lastSync,
        transactionsCount: terminalSales,
        totalAmount: terminalTotal,
      };
    });

    return NextResponse.json({
      systems,
      summary: {
        totalTransactions: totalSales,
        todayTransactions: todaySales[0]?.count || 0,
        todayTotal: todaySales[0]?.total || 0,
      },
    });
  } catch (error) {
    console.error('POS status error:', error);
    return NextResponse.json({ error: 'Error al obtener estado POS' }, { status: 500 });
  }
}

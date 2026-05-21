import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { Transaction } from '@/models/Schemas';

export async function GET() {
  try {
    await dbConnect();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const data = await Transaction.aggregate([
      { $match: { type: 'SALE', createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: '$grandTotalCrc' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Error fetching sales chart data' }, { status: 500 });
  }
}

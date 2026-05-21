import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { Transaction } from '@/models/Schemas';
import { generateMockBatch } from '@/lib/pos-mock';

export async function POST(req: NextRequest) {
  try {
    const { days = 30, clear = false } = await req.json().catch(() => ({}));

    await dbConnect();

    if (clear) {
      await Transaction.deleteMany({
        source: 'MANUAL',
        documentType: 'pos_ticket',
        type: 'SALE',
      });
    }

    const transactions = await generateMockBatch(days);

    let inserted = 0;
    for (const tx of transactions) {
      try {
        await Transaction.create(tx);
        inserted++;
      } catch {
        // skip duplicates
      }
    }

    return NextResponse.json({
      success: true,
      days,
      generated: transactions.length,
      inserted,
      message: `Se insertaron ${inserted} transacciones POS de prueba (${days} dias simulados).`,
    });
  } catch (error) {
    console.error('POS sync error:', error);
    return NextResponse.json({ error: 'Error al sincronizar datos POS' }, { status: 500 });
  }
}

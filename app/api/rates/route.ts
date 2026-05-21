import { NextResponse } from 'next/server';
import { getExchangeRate } from '@/lib/exchange-rate';

export async function GET() {
  try {
    const rate = await getExchangeRate();
    return NextResponse.json({ rate, currency: 'CRC', updatedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ rate: 515.0, currency: 'CRC', updatedAt: new Date().toISOString() });
  }
}

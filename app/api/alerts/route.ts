import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { Alert } from '@/models/Schemas';

export async function GET() {
  try {
    await dbConnect();
    const alerts = await Alert.find({ isActive: true }).sort({ createdAt: -1 });
    return NextResponse.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

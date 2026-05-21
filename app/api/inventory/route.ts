import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { Inventory } from '@/models/Schemas';

export async function GET() {
  try {
    await dbConnect();
    const inventory = await Inventory.find({});
    return NextResponse.json(inventory);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

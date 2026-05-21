import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { Inventory } from '@/models/Schemas';

export async function GET() {
  try {
    await dbConnect();
    const inventory = await Inventory.find({}).lean();
    const withDefaults = inventory.map((item) => ({
      ...item,
      taxRate: (item as any).taxRate ?? 0.13,
    }));
    return NextResponse.json(withDefaults);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();

    const body = (await request.json()) as {
      sku: string;
      name: string;
      currentStock?: number;
      purchasePrice: number;
      salePrice?: number;
      taxRate?: number;
    };

    if (!body.sku || !body.name) {
      return NextResponse.json({ error: 'SKU y nombre son requeridos.' }, { status: 400 });
    }

    const existing = await Inventory.findOne({ sku: body.sku });
    if (existing) {
      return NextResponse.json({ error: `El SKU "${body.sku}" ya existe.` }, { status: 409 });
    }

    const product = await Inventory.create({
      sku: body.sku,
      name: body.name,
      currentStock: body.currentStock ?? 0,
      purchasePrice: body.purchasePrice,
      landedCost: body.purchasePrice,
      salePrice: body.salePrice ?? Math.round(body.purchasePrice * 1.1 * 100) / 100,
      taxRate: body.taxRate ?? 0.13,
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Error al crear producto.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await dbConnect();

    const body = (await request.json()) as {
      updates: { sku: string; salePrice?: number; taxRate?: number }[];
    };

    if (!body.updates || body.updates.length === 0) {
      return NextResponse.json({ error: 'No hay actualizaciones.' }, { status: 400 });
    }

    const results = await Promise.all(
      body.updates.map((u) => {
        const setFields: Record<string, number> = {};
        if (u.salePrice !== undefined) setFields.salePrice = u.salePrice;
        if (u.taxRate !== undefined) setFields.taxRate = u.taxRate;
        return Inventory.findOneAndUpdate(
          { sku: u.sku },
          { $set: setFields },
          { returnDocument: 'after' },
        ).lean();
      }),
    );

    const updated = results.filter((r) => r !== null).map((r) => ({
      ...r,
      taxRate: (r as any).taxRate ?? 0.13,
    }));
    return NextResponse.json({ updated: updated.length, items: updated });
  } catch (error) {
    console.error('Error updating inventory:', error);
    return NextResponse.json({ error: 'Error al actualizar precios.' }, { status: 500 });
  }
}

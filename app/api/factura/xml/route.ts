import { NextRequest, NextResponse } from 'next/server';
import { Parser } from 'xml2js';
import dbConnect from '@/lib/db';
import { Inventory, Transaction } from '@/models/Schemas';

const parser = new Parser({ explicitArray: false });

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const xmlData = await req.text();
    const result = await parser.parseStringPromise(xmlData);

    // Costa Rican Hacienda XML structure parsing (simplified)
    const root = result.FacturaElectronica || result.TiqueteElectronico || result.NotaCreditoElectronica;
    
    if (!root) {
      return NextResponse.json({ error: 'Invalid XML format' }, { status: 400 });
    }

    const merchantName = root.Emisor.Nombre;
    const receiverName = root.Receptor?.Nombre;
    
    // Determine type: If we are the receptor, it's a PURCHASE. If we are the emisor, it's a SALE.
    // For this demo, we assume if Receptor exists and it's not us, it's a SALE, otherwise PURCHASE.
    // In a real app, we'd check against our own Tax ID (Cedula Juridica).
    const type = receiverName ? 'SALE' : 'PURCHASE';

    const items = Array.isArray(root.DetalleServicio.LineaDetalle) 
      ? root.DetalleServicio.LineaDetalle 
      : [root.DetalleServicio.LineaDetalle];

    let subTotal = 0;
    let taxAmount = 0;

    for (const item of items) {
      const detail = item.Detalle;
      const quantity = parseFloat(item.Cantidad);
      const unitPrice = parseFloat(item.PrecioUnitario);
      const amount = parseFloat(item.MontoTotal);
      const itemTax = item.Impuesto ? parseFloat(item.Impuesto.Monto) : 0;

      subTotal += amount;
      taxAmount += itemTax;

      // Update inventory atomically
      // We use the detail as a proxy for name/sku if SKU isn't explicitly in the simplified XML
      await Inventory.findOneAndUpdate(
        { name: detail },
        { 
          $inc: { currentStock: type === 'PURCHASE' ? quantity : -quantity },
          $set: { 
            [type === 'PURCHASE' ? 'purchasePrice' : 'salePrice']: unitPrice,
            sku: detail.substring(0, 10).toUpperCase().replace(/\s/g, '') // Generate a mock SKU
          }
        },
        { upsert: true, new: true }
      );
    }

    const transaction = await Transaction.create({
      type,
      source: 'XML',
      merchantName: type === 'PURCHASE' ? merchantName : receiverName,
      subTotal,
      taxAmount,
    });

    return NextResponse.json({ 
      message: 'XML processed successfully', 
      transactionId: transaction._id,
      type 
    });

  } catch (error: any) {
    console.error('XML Processing Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

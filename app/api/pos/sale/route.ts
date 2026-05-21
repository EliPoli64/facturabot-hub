import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { Inventory, Transaction, syncTransactionItemsToInventory } from '@/models/Schemas';
import { generateReceiptPdf } from '@/lib/receipt';

interface SaleRequestItem {
  sku: string;
  quantity: number;
  unitPrice: number;
}

export async function POST(request: Request) {
  try {
    await dbConnect();

    const body = (await request.json()) as {
      items: SaleRequestItem[];
      businessName?: string;
    };

    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: 'No hay productos en la venta.' }, { status: 400 });
    }

    const inventoryItems = await Inventory.find({
      sku: { $in: body.items.map((i) => i.sku) },
    });
    const inventoryMap = new Map(inventoryItems.map((i) => [i.sku, i]));

    for (const item of body.items) {
      const inv = inventoryMap.get(item.sku);
      if (!inv) {
        return NextResponse.json({ error: `Producto ${item.sku} no encontrado.` }, { status: 404 });
      }
      if (inv.currentStock < item.quantity) {
        return NextResponse.json(
          { error: `Stock insuficiente para ${item.sku}. Disponible: ${inv.currentStock}, solicitado: ${item.quantity}.` },
          { status: 400 },
        );
      }
    }

    const transactionItems = body.items.map((item) => {
      const inv = inventoryMap.get(item.sku)!;
      const lineTotal = item.quantity * item.unitPrice;
      const rate = inv.taxRate ?? 0.13;
      return {
        sku: item.sku,
        description: inv.name,
        quantity: item.quantity,
        unitPriceForeign: item.unitPrice,
        discount: 0,
        taxRate: rate,
        taxAmountForeign: Math.round(lineTotal * rate),
        totalLineForeign: lineTotal,
      };
    });

    const taxableItems = transactionItems.filter((i) => i.taxRate > 0);
    const exemptItems = transactionItems.filter((i) => i.taxRate === 0);

    const taxableSubtotal = taxableItems.reduce((acc, i) => acc + i.totalLineForeign, 0);
    const exemptSubtotal = exemptItems.reduce((acc, i) => acc + i.totalLineForeign, 0);
    const taxAmount = taxableItems.reduce((acc, i) => acc + i.taxAmountForeign, 0);
    const grandTotal = taxableSubtotal + exemptSubtotal + taxAmount;

    const documentId = `POS-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const transaction = await Transaction.create({
      type: 'SALE',
      source: 'MANUAL',
      documentType: 'pos_ticket',
      origin: 'national',
      documentId,
      merchantName: body.businessName || 'POS Sale',
      merchantTaxId: '000000000',
      currency: 'CRC',
      exchangeRate: 1,
      items: transactionItems,
      subTotalForeign: taxableSubtotal + exemptSubtotal,
      taxAmountForeign: taxAmount,
      grandTotalForeign: grandTotal,
      grandTotalCrc: grandTotal,
    });

    await syncTransactionItemsToInventory(transactionItems, 'SALE', 1);

    const responseItems = body.items.map((i) => {
      const inv = inventoryMap.get(i.sku)!;
      const lineTotal = i.quantity * i.unitPrice;
      const rate = inv.taxRate ?? 0.13;
      return {
        sku: i.sku,
        name: inv.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        taxRate: rate,
        lineTotal,
        taxAmount: Math.round(lineTotal * rate),
      };
    });

    const pdfBase64 = await generateReceiptPdf(
      body.businessName || 'FacturaBot CR',
      documentId,
      new Date(),
      responseItems,
      taxableSubtotal,
      exemptSubtotal,
      taxAmount,
      grandTotal,
    );

    return NextResponse.json({
      transactionId: transaction._id,
      documentId,
      date: new Date().toISOString(),
      items: responseItems,
      taxableSubtotal,
      exemptSubtotal,
      taxAmount,
      grandTotal,
      pdfBase64,
    });
  } catch (error) {
    console.error('Error processing POS sale:', error);
    return NextResponse.json({ error: 'Error al procesar la venta.' }, { status: 500 });
  }
}

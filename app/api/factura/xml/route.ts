import { NextRequest, NextResponse } from 'next/server';
import { Parser } from 'xml2js';
import dbConnect from '@/lib/db';
import { Transaction, syncTransactionItemsToInventory } from '@/models/Schemas';

const parser = new Parser({
  explicitArray: false,
  trim: true,
  normalize: true,
});

function stripBOM(buf: Buffer): Buffer {
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    return buf.subarray(3);
  }
  return buf;
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const contentType = req.headers.get('content-type') || '';
    let raw: Buffer;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      }
      raw = Buffer.from(await file.arrayBuffer());
    } else {
      raw = Buffer.from(await req.arrayBuffer());
    }

    const result = await parser.parseStringPromise(stripBOM(raw));

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


    }

    const transaction = await Transaction.create({
      type,
      source: 'XML',

      documentType: 'hacienda_xml',

      origin: 'national',

      documentId:
        root.Clave ||
        `XML-${Date.now()}`,

      merchantName:
        merchantName ||

        'Unknown Merchant',

      merchantTaxId:
        root.Emisor?.Identificacion?.Numero ||

        '000000000',

      currency:
        root.CodigoTipoMoneda?.CodigoMoneda ||

        'CRC',

      exchangeRate:
        parseFloat(
          root.CodigoTipoMoneda?.TipoCambio || '1'
        ),

      items: items.map((item: any) => ({
        sku:
          item.Codigo?.Codigo ||

          undefined,

        description:
          item.Detalle ||

          'Producto',

        quantity:
          parseFloat(item.Cantidad || '1'),

        unitPriceForeign:
          parseFloat(item.PrecioUnitario || '0'),

        discount:
          parseFloat(item.MontoDescuento || '0'),

        taxAmountForeign:
          item.Impuesto
            ? parseFloat(item.Impuesto.Monto || '0')
            : 0,

        totalLineForeign:
          parseFloat(item.MontoTotalLinea || '0'),
      })),

      subTotalForeign: subTotal,

      taxAmountForeign: taxAmount,

      grandTotalForeign:
        subTotal + taxAmount,

      grandTotalCrc:
        (subTotal + taxAmount) *
        parseFloat(
          root.CodigoTipoMoneda?.TipoCambio || '1'
        ),

      fiscalAnalysis: {
        purchaseType:
          'product_purchase',

        isDeductibleHacienda:
          true,

        haciendaJustification:
          'Factura electrónica nacional registrada desde XML Hacienda.',

        suggestedAccountCode:
          '1-1-03-01',

        suggestedAccountName:
          'Inventario de Mercancías',
      },
    });

    await syncTransactionItemsToInventory(transaction.items, transaction.type, transaction.exchangeRate);

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

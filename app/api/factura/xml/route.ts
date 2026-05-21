import { NextRequest, NextResponse } from 'next/server';
import { Parser } from 'xml2js';
import dbConnect from '@/lib/db';
import { getExchangeRate } from '@/lib/exchange-rate';
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

    if (result.receipt) {
      const receipt = result.receipt;
      const exchangeRate = await getExchangeRate();

      const rawItems = receipt.items?.item;
      const itemsArr = Array.isArray(rawItems) ? rawItems : (rawItems ? [rawItems] : []);

      const mappedItems = itemsArr.map((item: any) => {
        const qty = parseFloat(item.quantity) || 1;
        const unitPrice = parseFloat(item.unitPrice) || 0;
        const total = parseFloat(item.total) || (qty * unitPrice);
        return {
          sku: undefined,
          description: item.description || 'Producto',
          quantity: qty,
          unitPriceForeign: unitPrice,
          discount: 0,
          taxRate: 0,
          taxAmountForeign: 0,
          totalLineForeign: total,
        };
      });

      const summary = receipt.summary || {};
      const subTotal = parseFloat(summary.subtotal) || mappedItems.reduce((a: number, i: any) => a + i.totalLineForeign, 0);
      const taxAmount = parseFloat(summary.tax) || 0;
      const grandTotal = parseFloat(summary.grandTotal) || (subTotal + taxAmount);

      const receiptInfo = receipt.receiptInfo || {};

      const transaction = await Transaction.create({
        type: 'PURCHASE',
        source: 'XML',
        documentType: 'pos_ticket',
        origin: 'international',
        documentId: receiptInfo.receiptNumber || `RCPT-${Date.now()}`,
        merchantName: receipt.supplier?.name || 'Unknown Supplier',
        merchantTaxId: receipt.supplier?.taxId || '000000000',
        currency: receiptInfo.currency || 'USD',
        exchangeRate,
        items: mappedItems,
        subTotalForeign: subTotal,
        taxAmountForeign: taxAmount,
        grandTotalForeign: grandTotal,
        grandTotalCrc: Math.round(grandTotal * exchangeRate),
      });

      await syncTransactionItemsToInventory(mappedItems, 'PURCHASE', exchangeRate);

      return NextResponse.json({
        message: 'Receipt processed successfully',
        transactionId: transaction._id,
        type: 'PURCHASE',
      });
    }

    if (result.recibo) {
      const r = result.recibo;

      const rawItems = r.articulos?.articulo;
      const itemsArr = Array.isArray(rawItems) ? rawItems : (rawItems ? [rawItems] : []);

      const mappedItems = itemsArr.map((item: any) => ({
        sku: undefined,
        description: item.descripcion || 'Producto',
        quantity: parseFloat(item.cantidad) || 1,
        unitPriceForeign: parseFloat(item.precioUnitario) || 0,
        discount: 0,
        taxRate: 0,
        taxAmountForeign: 0,
        totalLineForeign: parseFloat(item.total) || 0,
      }));

      const summary = r.resumen || {};
      const subTotal = parseFloat(summary.subtotal) || mappedItems.reduce((a: number, i: any) => a + i.totalLineForeign, 0);
      const taxAmount = parseFloat(summary.impuesto) || 0;
      const grandTotal = parseFloat(summary.totalFinal) || (subTotal + taxAmount);

      const receiptInfo = r.informacionRecibo || {};
      const empresa = r.empresa || {};
      const proveedor = r.proveedor || {};

      const transaction = await Transaction.create({
        type: 'PURCHASE',
        source: 'XML',
        documentType: 'pos_ticket',
        origin: 'national',
        documentId: receiptInfo.numero || `RCPT-${Date.now()}`,
        merchantName: proveedor.nombre || empresa.nombre || 'Unknown Supplier',
        merchantTaxId: proveedor.cedula || empresa.cedulaJuridica || '000000000',
        currency: receiptInfo.moneda || 'CRC',
        exchangeRate: 1,
        items: mappedItems,
        subTotalForeign: subTotal,
        taxAmountForeign: taxAmount,
        grandTotalForeign: grandTotal,
        grandTotalCrc: grandTotal,
      });

      await syncTransactionItemsToInventory(mappedItems, 'PURCHASE', 1);

      return NextResponse.json({
        message: 'Recibo procesado exitosamente',
        transactionId: transaction._id,
        type: 'PURCHASE',
      });
    }

    if (result.recu) {
      const r = result.recu;
      const exchangeRate = await getExchangeRate();

      const rawItems = r.produits?.produit;
      const itemsArr = Array.isArray(rawItems) ? rawItems : (rawItems ? [rawItems] : []);

      const mappedItems = itemsArr.map((item: any) => ({
        sku: undefined,
        description: item.description || 'Produit',
        quantity: parseFloat(item.quantite) || 1,
        unitPriceForeign: parseFloat(item.prixUnitaire) || 0,
        discount: 0,
        taxRate: 0,
        taxAmountForeign: 0,
        totalLineForeign: parseFloat(item.montant) || 0,
      }));

      const totaux = r.totaux || {};
      const subTotal = parseFloat(totaux.horsTaxes) || mappedItems.reduce((a: number, i: any) => a + i.totalLineForeign, 0);
      const taxAmount = parseFloat(totaux.taxe) || 0;
      const grandTotal = parseFloat(totaux.total) || (subTotal + taxAmount);

      const details = r.details || {};
      const entreprise = r.entreprise || {};
      const fournisseur = r.fournisseur || {};

      const transaction = await Transaction.create({
        type: 'PURCHASE',
        source: 'XML',
        documentType: 'pos_ticket',
        origin: 'international',
        documentId: details.numeroRecu || `RCPT-${Date.now()}`,
        merchantName: fournisseur.nom || entreprise.nom || 'Unknown Supplier',
        merchantTaxId: entreprise.numeroFiscal || '000000000',
        currency: details.devise || 'EUR',
        exchangeRate,
        items: mappedItems,
        subTotalForeign: subTotal,
        taxAmountForeign: taxAmount,
        grandTotalForeign: grandTotal,
        grandTotalCrc: Math.round(grandTotal * exchangeRate),
      });

      await syncTransactionItemsToInventory(mappedItems, 'PURCHASE', exchangeRate);

      return NextResponse.json({
        message: 'Reçu traité avec succès',
        transactionId: transaction._id,
        type: 'PURCHASE',
      });
    }

    const root = result.FacturaElectronica || result.TiqueteElectronico || result.NotaCreditoElectronica;

    if (!root) {
      return NextResponse.json({ error: 'Invalid XML format' }, { status: 400 });
    }

    const merchantName = root.Emisor.Nombre;
    const receiverName = root.Receptor?.Nombre;
    const type = receiverName ? 'SALE' : 'PURCHASE';

    const items = Array.isArray(root.DetalleServicio.LineaDetalle)
      ? root.DetalleServicio.LineaDetalle
      : [root.DetalleServicio.LineaDetalle];

    let subTotal = 0;
    let taxAmount = 0;

    for (const item of items) {
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
      documentId: root.Clave || `XML-${Date.now()}`,
      merchantName: merchantName || 'Unknown Merchant',
      merchantTaxId: root.Emisor?.Identificacion?.Numero || '000000000',
      currency: root.CodigoTipoMoneda?.CodigoMoneda || 'CRC',
      exchangeRate: parseFloat(root.CodigoTipoMoneda?.TipoCambio || '1'),
      items: items.map((item: any) => {
        const totalLine = parseFloat(item.MontoTotalLinea || '0');
        const taxAmt = item.Impuesto ? parseFloat(item.Impuesto.Monto || '0') : 0;
        const subTotalLine = totalLine - taxAmt;
        const rate = subTotalLine > 0 ? Math.round((taxAmt / subTotalLine) * 100) / 100 : 0;
        return {
          sku: item.Codigo?.Codigo || undefined,
          description: item.Detalle || 'Producto',
          quantity: parseFloat(item.Cantidad || '1'),
          unitPriceForeign: parseFloat(item.PrecioUnitario || '0'),
          discount: parseFloat(item.MontoDescuento || '0'),
          taxRate: rate,
          taxAmountForeign: taxAmt,
          totalLineForeign: totalLine,
        };
      }),
      subTotalForeign: subTotal,
      taxAmountForeign: taxAmount,
      grandTotalForeign: subTotal + taxAmount,
      grandTotalCrc: (subTotal + taxAmount) * parseFloat(root.CodigoTipoMoneda?.TipoCambio || '1'),
      fiscalAnalysis: {
        purchaseType: 'product_purchase',
        isDeductibleHacienda: true,
        haciendaJustification: 'Factura electrónica nacional registrada desde XML Hacienda.',
        suggestedAccountCode: '1-1-03-01',
        suggestedAccountName: 'Inventario de Mercancías',
      },
    });

    await syncTransactionItemsToInventory(transaction.items, transaction.type, transaction.exchangeRate);

    return NextResponse.json({
      message: 'XML processed successfully',
      transactionId: transaction._id,
      type,
    });

  } catch (error: any) {
    console.error('XML Processing Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

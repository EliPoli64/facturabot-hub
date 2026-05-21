import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getExchangeRate } from '@/lib/exchange-rate';
import { Transaction, syncTransactionItemsToInventory } from '@/models/Schemas';
import { processDocument } from '@/lib/fiscal-engine/pipeline';
import { DocumentoProcesado } from '@/lib/types';

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

    const rawContent = raw.toString('utf-8');
    const exchangeRate = await getExchangeRate();

    const result: DocumentoProcesado = await processDocument({
      rawContent,
      originalName: 'document.xml',
      tipoCambio: exchangeRate,
    });

    const esNacional = result.emisor.pais === 'CR' ||
      result.meta.tipo_documento === 'factura_electronica_cr_v43' ||
      result.meta.tipo_documento === 'factura_electronica_cr_v44' ||
      result.meta.tipo_documento === 'tiquete_electronico_cr';

    const mappedItems = result.lineas_detalle.map((line) => ({
      sku: line.codigo_producto || undefined,
      description: line.descripcion || 'Producto',
      quantity: line.cantidad || 1,
      unitPriceForeign: line.precio_unitario || 0,
      discount: line.descuento_monto || 0,
      taxRate: line.impuesto_tarifa_porcentaje || 0,
      taxAmountForeign: line.impuesto_monto || 0,
      totalLineForeign: line.total_linea || 0,
    }));

    const transaction = await Transaction.create({
      type: 'PURCHASE',
      source: 'XML',
      documentType: 'hacienda_xml',
      origin: esNacional ? 'national' : 'international',
      documentId: result.identificacion.numero_documento || result.identificacion.clave_numerica_50 || `XML-${Date.now()}`,
      merchantName: result.emisor.nombre || 'Unknown Merchant',
      merchantTaxId: result.emisor.numero_identificacion || '000000000',
      currency: result.identificacion.moneda_original || 'CRC',
      exchangeRate: result.totales.tipo_cambio_a_crc || 1,
      items: mappedItems,
      subTotalForeign: result.totales.subtotal_sin_impuestos || 0,
      taxAmountForeign: result.totales.total_impuestos || 0,
      grandTotalForeign: result.totales.total_documento || 0,
      grandTotalCrc: result.totales.total_documento_crc || 0,
      fiscalAnalysis: {
        purchaseType: result.lineas_detalle[0]?.clasificacion_tipo_compra === 'mercaderia'
          ? 'product_purchase'
          : result.lineas_detalle[0]?.clasificacion_tipo_compra === 'servicio_profesional'
            ? 'service_contract'
            : 'operational_expense',
        isDeductibleHacienda: result.clasificacion_fiscal.total_deducible_hacienda > 0,
        haciendaJustification: result.clasificacion_fiscal.flags.join('; '),
        suggestedAccountCode: result.lineas_detalle[0]?.cuenta_contable_sugerida || '5-1900',
        suggestedAccountName: result.lineas_detalle[0]?.nombre_cuenta_sugerida || 'Otros gastos operativos',
      },
    });

    await syncTransactionItemsToInventory(mappedItems, 'PURCHASE', transaction.exchangeRate);

    return NextResponse.json({
      message: 'XML procesado exitosamente con motor fiscal',
      transactionId: transaction._id,
      type: 'PURCHASE',
      resultado: result,
    });
  } catch (error: any) {
    console.error('XML Processing Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

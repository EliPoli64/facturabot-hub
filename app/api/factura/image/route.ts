import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import dbConnect from '@/lib/db';
import { getExchangeRate } from '@/lib/exchange-rate';
import { Transaction, syncTransactionItemsToInventory } from '@/models/Schemas';
import { detectDocumentType } from '@/lib/fiscal-engine/document-detector';
import { processDocument } from '@/lib/fiscal-engine/pipeline';
import { DocumentoProcesado } from '@/lib/types';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const visionModel = process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash';

function normalizeMimeType(file: File): string {
  if (file.type) return file.type;
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith('.png')) return 'image/png';
  if (fileName.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const mimeType = normalizeMimeType(file);
    if (!mimeType.startsWith('image/')) {
      return NextResponse.json({ error: 'Invalid file type. Please upload an image.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');

    const currentExchangeRate = await getExchangeRate();

    const detection = detectDocumentType({ originalName: file.name });

    const systemInstruction = [
      'Eres FacturaBot Core, el motor de extracción fiscal de un ecosistema SaaS para PYMEs en Costa Rica.',
      'Procesas imágenes de documentos financieros y extraes la información en JSON estructurado.',
      'Extrae todos los campos visibles: emisor, número de documento, fecha, moneda, items, subtotales, impuestos, totales.',
      'Si el documento es internacional (inglés, USD, EUR, etc.), márcalo como origin: "international".',
      'Para servicios digitales (AWS, Stripe, Shopify, Google, Adobe, etc.), identifícalos como servicios del exterior.',
      'Extrae FOB, flete y seguro si son visibles en documentos de importación.',
      'No inventes valores que no estén visibles en el documento.',
    ].join('\n');

    const userPrompt = `Analiza esta imagen. Tipo de cambio actual: ${currentExchangeRate} CRC/USD. Extrae los datos en JSON.`;

    const responseSchema = {
      type: 'OBJECT',
      properties: {
        metadata: {
          type: 'OBJECT',
          properties: {
            documentType: { type: 'STRING', enum: ['hacienda_xml', 'national_pdf', 'foreign_invoice', 'pos_ticket', 'customs_policy', 'foreign_service', 'airway_bill'] },
            origin: { type: 'STRING', enum: ['national', 'international'] },
            documentId: { type: 'STRING' },
            issueDate: { type: 'STRING' },
            dueDate: { type: 'STRING' },
            currency: { type: 'STRING' },
            exchangeRate: { type: 'NUMBER' },
            paymentMethod: { type: 'STRING' },
            poNumber: { type: 'STRING' },
            language: { type: 'STRING' },
          },
          required: ['documentType', 'origin', 'currency'],
        },
        issuer: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING' },
            idNumber: { type: 'STRING' },
            taxIdType: { type: 'STRING' },
            address: { type: 'STRING' },
            phone: { type: 'STRING' },
            email: { type: 'STRING' },
            country: { type: 'STRING' },
          },
        },
        items: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              sku: { type: 'STRING' },
              description: { type: 'STRING' },
              quantity: { type: 'NUMBER' },
              unitPriceForeign: { type: 'NUMBER' },
              discount: { type: 'NUMBER' },
              subtotalForeign: { type: 'NUMBER' },
              taxAmountForeign: { type: 'NUMBER' },
              totalLineForeign: { type: 'NUMBER' },
            },
            required: ['description', 'quantity', 'unitPriceForeign', 'totalLineForeign'],
          },
        },
        totals: {
          type: 'OBJECT',
          properties: {
            subTotalForeign: { type: 'NUMBER' },
            taxAmountForeign: { type: 'NUMBER' },
            grandTotalForeign: { type: 'NUMBER' },
            totalDiscount: { type: 'NUMBER' },
          },
          required: ['subTotalForeign', 'taxAmountForeign', 'grandTotalForeign'],
        },
      },
      required: ['metadata', 'issuer', 'items', 'totals'],
    };

    const response = await genAI.models.generateContent({
      model: visionModel,
      contents: [
        { inlineData: { data: base64Image, mimeType } },
        { text: userPrompt },
      ],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.1,
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Gemini extrajo un cuerpo de texto vacío.');
    }

    const extracted = JSON.parse(responseText);
    if (!extracted.metadata) {
      throw new Error('Invalid AI extraction format');
    }

    const result: DocumentoProcesado = await processDocument({
      originalName: file.name,
      extractedText: responseText,
      mimeType,
      tipoCambio: currentExchangeRate,
      llmExtraction: extracted,
    });

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

    const rate = result.totales.tipo_cambio_a_crc || currentExchangeRate;
    const grandTotalCrc = result.totales.total_documento_crc ||
      Math.round((result.totales.total_documento || 0) * rate);

    const transaction = await Transaction.create({
      type: 'PURCHASE',
      source: 'OCR',
      documentType: 'foreign_invoice',
      origin: result.emisor.pais === 'CR' ? 'national' : 'international',
      documentId: result.identificacion.numero_documento || `OCR-${Date.now()}`,
      merchantName: result.emisor.nombre || 'Comercio no identificado',
      merchantTaxId: result.emisor.numero_identificacion || '0-000-000000',
      currency: result.identificacion.moneda_original || 'CRC',
      exchangeRate: rate,
      items: mappedItems,
      subTotalForeign: result.totales.subtotal_sin_impuestos || 0,
      taxAmountForeign: result.totales.total_impuestos || 0,
      grandTotalForeign: result.totales.total_documento || 0,
      grandTotalCrc,
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

    await syncTransactionItemsToInventory(mappedItems, 'PURCHASE', rate);

    return NextResponse.json({
      message: 'Imagen procesada exitosamente con motor fiscal',
      transactionId: transaction._id,
      data: transaction,
      resultado: result,
    });
  } catch (error: unknown) {
    console.error('Gemini Image Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

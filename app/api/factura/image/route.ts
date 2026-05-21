import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import dbConnect from '@/lib/db';
import { Transaction } from '@/models/Schemas';

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

// Cambiado a gemini-2.5-flash como modelo base para OCR rápido y estructurado
const visionModel = process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash";

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

    // Tipo de cambio simulado para Costa Rica (puedes conectar esto a un API del BCCR en el futuro)
    const currentExchangeRate = 515.0; 

    const systemInstruction = [
      'Eres FacturaBot Core, el motor de OCR, análisis fiscal y costeo de importaciones de un ecosistema SaaS fintech para retail en Costa Rica.',
      'Tu tarea principal es procesar texto de documentos (imágenes OCR, tickets, facturas electrónicas, invoices internacionales o pólizas aduanales) y estructurarlo en un objeto JSON estricto.',

      'Reglas Clave de Clasificación y Deducibilidad (Ley N° 7092 - Costa Rica):',
      '- **purchaseType:** Clasifica el documento como \'product_purchase\' (bienes tangibles para inventario), \'service_contract\' (servicios recurrentes/acuerdos), u \'operational_expense\' (gastos corrientes no contractuales).',
      '- **isDeductibleHacienda:** Evalúa rigurosamente si el gasto es útil, necesario y pertinente para producir la renta o conservar la fuente del negocio retail.',
      '  - **Aceptados (Deducibles):** Costo de mercancías, fletes y acarreos de productos, servicios públicos del local comercial, software de facturación y marketing/publicidad.',
      '  - **Rechazados (No Deducibles):** Compras de supermercado con alimentos de consumo personal, artículos del hogar, licores, ropa sin distintivos de uniforme. También, si identificas un \'Gasto personal del dueño\', márcalo como NO DEDUCIBLE.',
      '  - **Consideraciones específicas:**',
      '    - \'Mercadería nacional\' (product_purchase): Deducible (costo de ventas), XML Hacienda obligatorio.',
      '    - \'Mercadería importada\' (product_purchase): Deducible (parte del costo de producto), requiere póliza aduanal. Extrae FOB, flete, seguro para cálculo CIF.',
      '    - \'Servicio profesional\' (service_contract): Deducible con retención del 15% (verifica retención si aplica).',
      '    - \'Activo fijo\' (product_purchase/operational_expense): Deducible vía depreciación, no gasto directo.',
      '    - \'Flete nacional\' (operational_expense): Deducible, Gasto transporte (5-1400).',
      '    - \'Flete importación\' (product_purchase): NO es gasto, es COSTO del producto. Extrae este monto para el cálculo CIF.',
      '    - \'Arrendamiento\' (service_contract): Deducible, Gasto alquiler (5-1300).',
      '    - \'Publicidad\' (operational_expense): Deducible con límite (máx 1% ingresos brutos).',
      '    - \'Gastos de representación\' (operational_expense): Parcialmente deducible (máx 1%).',
      '- **suggestedAccountCode / suggestedAccountName:** Mapea a una de las siguientes cuentas clave:',
      '  - \'1-1-03-01\' | Inventario de Mercancías (product_purchase válidos)',
      '  - \'5-1-01-01\' | Gasto por Servicios Contratados (service_contract)',
      '  - \'5-1-02-05\' | Gasto por Alquileres (arrendamiento de locales comerciales)',
      '  - \'5-1-03-10\' | Gasto por Servicios Públicos (luz, agua, telecomunicaciones comerciales)',
      '  - \'5-1-04-01\' | Gasto por Fletes y Transportes (fletes nacionales)',
      '  - \'5-1-99-01\' | Gastos No Deducibles (cualquier documento con isDeductibleHacienda: false)',

      'Para documentos tipo \'foreign_invoice\' o \'customs_policy\' relacionados con importaciones, extrae los siguientes componentes para el cálculo del costo de importación: Valor FOB, Seguro, Flete internacional, % arancel (para DAI), IVA importación, Almacenaje, Honorarios agente aduanal y Otros cargos. Es CRÍTICO diferenciar entre GASTO y COSTO en las importaciones.',
      'Para cada línea de producto, si un código de producto o SKU es visible, extráelo en el campo "sku". Si no hay SKU, puedes omitir el campo sku para ese item.',
    ].join('\n');

    const userPrompt = `Analiza esta imagen. El tipo de cambio actual para el día de hoy es de ${currentExchangeRate} CRC por 1 USD. Extrae las líneas de productos detalladamente si son visibles.`;

    // Definición estricta del esquema esperado según nuestro Schemas.ts expandido
    const responseSchema = {
      type: "OBJECT",
      properties: {
        metadata: {
          type: "OBJECT",
          properties: {
            documentType: { type: "STRING", enum: ["hacienda_xml", "national_pdf", "foreign_invoice", "pos_ticket", "customs_policy"] },
            origin: { type: "STRING", enum: ["national", "international"] },
            documentId: { type: "STRING" },
            issueDate: { type: "STRING" },
            currency: { type: "STRING" },
            exchangeRate: { type: "NUMBER" }
          },
          required: ["documentType", "origin", "documentId", "issueDate", "currency", "exchangeRate"]
        },
        issuer: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            idNumber: { type: "STRING" }
          },
          required: ["name", "idNumber"]
        },
        fiscalAnalysis: {
          type: "OBJECT",
          properties: {
            purchaseType: { type: "STRING", enum: ["product_purchase", "service_contract", "operational_expense"] },
            isDeductibleHacienda: { type: "BOOLEAN" },
            haciendaJustification: { type: "STRING" },
            suggestedAccountCode: { type: "STRING" },
            suggestedAccountName: { type: "STRING" }
          },
          required: ["purchaseType", "isDeductibleHacienda", "haciendaJustification", "suggestedAccountCode", "suggestedAccountName"]
        },
        items: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              sku: { type: "STRING" },
              description: { type: "STRING" },
              quantity: { type: "NUMBER" },
              unitPriceForeign: { type: "NUMBER" },
              discount: { type: "NUMBER" },
              taxAmountForeign: { type: "NUMBER" },
              totalLineForeign: { type: "NUMBER" }
            },
            required: ["description", "quantity", "unitPriceForeign", "discount", "taxAmountForeign", "totalLineForeign"]
          }
        },
        totals: {
          type: "OBJECT",
          properties: {
            subTotalForeign: { type: "NUMBER" },
            taxAmountForeign: { type: "NUMBER" },
            grandTotalForeign: { type: "NUMBER" }
          },
          required: ["subTotalForeign", "taxAmountForeign", "grandTotalForeign"]
        }
      },
      required: ["metadata", "issuer", "fiscalAnalysis", "items", "totals"]
    };

    const response = await genAI.models.generateContent({
      model: visionModel,
      contents: [
        {
          inlineData: {
            data: base64Image,
            mimeType,
          },
        },
        {
          text: userPrompt,
        },
      ],
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
        // @ts-ignore - El SDK de Google Gen AI acepta el objeto de esquema directamente
        responseSchema: responseSchema,
        temperature: 0.1, // Baja temperatura para evitar variaciones numéricas
      }
    });

    const responseText = response.text;
    console.log("Gemini API Response:", responseText);
    if (!responseText) {
      throw new Error("Gemini extrajo un cuerpo de texto vacío.");
    }

    const extracted = JSON.parse(responseText);

    if (!extracted.metadata) {
      throw new Error('Invalid AI extraction format');
    }

    // Calcular el gran total en colones basado en la respuesta de la IA
    const rate = extracted.metadata.currency === 'CRC' ? 1.0 : extracted.metadata.exchangeRate || currentExchangeRate;
    const grandTotalCrc = Math.round(extracted.totals.grandTotalForeign * rate);

    // Persistir en MongoDB usando la nueva estructura robusta de FacturaBot
    const transaction = await Transaction.create({
      type: 'PURCHASE', // Por defecto asumimos compra vía carga de recibo OCR
      source: 'OCR',
      documentType: extracted.metadata.documentType || 'pos_ticket',
      origin: extracted.metadata.origin || 'national',
      documentId: extracted.metadata.documentId || `OCR-${Date.now()}`,
      merchantName: extracted.issuer.name || 'Comercio no identificado',
      merchantTaxId: extracted.issuer.idNumber || '0-000-000000',
      currency: extracted.metadata.currency || 'CRC',
      exchangeRate: rate,
      items: extracted.items || [],
      subTotalForeign: extracted.totals.subTotalForeign || 0,
      taxAmountForeign: extracted.totals.taxAmountForeign || 0,
      grandTotalForeign: extracted.totals.grandTotalForeign || 0,
      grandTotalCrc: grandTotalCrc,
      fiscalAnalysis: {
        purchaseType: extracted.fiscalAnalysis.purchaseType,
        isDeductibleHacienda: extracted.fiscalAnalysis.isDeductibleHacienda,
        haciendaJustification: extracted.fiscalAnalysis.haciendaJustification,
        suggestedAccountCode: extracted.fiscalAnalysis.suggestedAccountCode,
        suggestedAccountName: extracted.fiscalAnalysis.suggestedAccountName,
      }
    });

    return NextResponse.json({
      message: 'Image processed and structured successfully',
      transactionId: transaction._id,
      data: transaction,
    });

  } catch (error: unknown) {
    console.error('Gemini Image Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
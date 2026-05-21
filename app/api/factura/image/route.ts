import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import dbConnect from '@/lib/db';
import { Transaction } from '@/models/Schemas';

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const visionModel = process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash';

function normalizeMimeType(file: File): string {
  if (file.type) {
    return file.type;
  }

  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.png')) {
    return 'image/png';
  }

  if (fileName.endsWith('.webp')) {
    return 'image/webp';
  }

  return 'image/jpeg';
}

function extractJsonPayload(source: string): {
  merchantName?: string;
  subTotal?: number;
  taxAmount?: number;
  type?: 'PURCHASE' | 'SALE';
} {
  const cleaned = source.replace(/```json|```/gi, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  const payload = jsonMatch ? jsonMatch[0] : cleaned;

  return JSON.parse(payload) as {
    merchantName?: string;
    subTotal?: number;
    taxAmount?: number;
    type?: 'PURCHASE' | 'SALE';
  };
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

    const prompt = [
      'Analiza esta imagen de factura o recibo de Costa Rica.',
      'Extrae la informacion visual directamente desde la imagen.',
      'Devuelve SOLO un JSON minificado, sin markdown, con estas llaves camelCase exactas:',
      '{"merchantName":"string","subTotal":0,"taxAmount":0,"type":"PURCHASE|SALE"}',
      'Reglas:',
      '- subTotal y taxAmount deben ser numeros, no strings.',
      '- type solo puede ser PURCHASE o SALE.',
      '- Si falta algun valor, estima con el mejor criterio visual posible.',
      '- No agregues texto extra fuera del JSON.',
    ].join('\n');

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
          text: prompt,
        },
      ],
    });

    const extractedData = extractJsonPayload(response.text || '');

    const transaction = await Transaction.create({
      merchantName: extractedData.merchantName || 'Comercio no identificado',
      subTotal: Number(extractedData.subTotal || 0),
      taxAmount: Number(extractedData.taxAmount || 0),
      type: extractedData.type === 'PURCHASE' ? 'PURCHASE' : 'SALE',
      source: 'OCR',
    });

    return NextResponse.json({
      message: 'Image processed successfully',
      transactionId: transaction._id,
      data: {
        merchantName: transaction.merchantName,
        subTotal: transaction.subTotal,
        taxAmount: transaction.taxAmount,
        type: transaction.type,
      },
    });
  } catch (error: unknown) {
    console.error('Gemini Image Error:', error);
    const message =
      error instanceof Error ? error.message : 'Internal Server Error';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { DocumentType } from '@/lib/types';

export interface DetectionResult {
  tipo: DocumentType;
  confianza: 'alta' | 'media' | 'baja';
  evidencia: string[];
  advertencias: string[];
}

function xmlContains(raw: string, substr: string): boolean {
  return raw.includes(substr);
}

function detectFromContent(raw: string): DetectionResult | null {
  const advertencias: string[] = [];

  if (xmlContains(raw, '<FacturaElectronicaCompra')) {
    return {
      tipo: 'factura_compra_electronica_cr',
      confianza: 'alta',
      evidencia: ['Root element: FacturaElectronicaCompra'],
      advertencias,
    };
  }

  if (xmlContains(raw, '<TiqueteElectronico')) {
    return {
      tipo: 'tiquete_electronico_cr',
      confianza: 'alta',
      evidencia: ['Root element: TiqueteElectronico'],
      advertencias,
    };
  }

  if (xmlContains(raw, '<FacturaElectronica')) {
    if (xmlContains(raw, '"4.4"') || xmlContains(raw, 'version="4.4"')) {
      return {
        tipo: 'factura_electronica_cr_v44',
        confianza: 'alta',
        evidencia: ['Root element: FacturaElectronica, version 4.4'],
        advertencias,
      };
    }
    if (xmlContains(raw, '"4.3"') || xmlContains(raw, 'version="4.3"')) {
      return {
        tipo: 'factura_electronica_cr_v43',
        confianza: 'alta',
        evidencia: ['Root element: FacturaElectronica, version 4.3'],
        advertencias,
      };
    }
    return {
      tipo: 'factura_electronica_cr_v44',
      confianza: 'alta',
      evidencia: ['Root element: FacturaElectronica (version no especificada, asumida 4.4)'],
      advertencias: ['No se pudo determinar la version exacta del XML'],
    };
  }

  if (xmlContains(raw, 'xmlns:cfdi="http://www.sat.gob.mx') || xmlContains(raw, 'xmlns:cfdi="http://www.sat.gob.mx/cfd/4')) {
    return {
      tipo: 'cfdi_40_mexico',
      confianza: 'alta',
      evidencia: ['Namespace CFDI 4.0 SAT Mexico detectado'],
      advertencias,
    };
  }

  if (xmlContains(raw, '<NotaCreditoElectronica')) {
    advertencias.push('Nota de credito electronica CR detectada — se procesa como factura inversa');
    return {
      tipo: 'factura_electronica_cr_v44',
      confianza: 'alta',
      evidencia: ['Root element: NotaCreditoElectronica'],
      advertencias,
    };
  }

  const hasReceiptRoot = /\s*<receipt[\s>]/i.test(raw) || /\s*<Recibo[\s>]/i.test(raw) || /\s*<recu[\s>]/i.test(raw);
  const hasInvoiceRoot = /\s*<[Ii]nvoice[\s>]/.test(raw);
  const hasPurchaseOrder = /\s*<[Pp]urchase[Oo]rder[\s>]/.test(raw);

  if (hasReceiptRoot || hasInvoiceRoot || hasPurchaseOrder) {
    return {
      tipo: 'supplier_invoice',
      confianza: 'alta',
      evidencia: ['XML estructurado no fiscal con datos de factura de proveedor'],
      advertencias: ['Formato XML de proveedor no estandar — se extrae mediante parsing generico'],
    };
  }

  return null;
}

function detectFromFilename(filename: string): DetectionResult | null {
  const lower = filename.toLowerCase();
  const advertencias: string[] = [];

  if (lower.includes('poliza') || lower.includes('dua') || lower.includes('declaracion')) {
    return {
      tipo: 'poliza_aduanal',
      confianza: 'baja',
      evidencia: [`Nombre de archivo contiene keyword: ${lower}`],
      advertencias: ['Deteccion por nombre de archivo — requiere confirmacion visual'],
    };
  }

  if (lower.includes('bill of lading') || lower.includes('airway') || lower.includes('awb')) {
    return {
      tipo: 'airway_bill',
      confianza: 'baja',
      evidencia: [`Nombre de archivo contiene keyword: ${lower}`],
      advertencias: ['Deteccion por nombre de archivo — requiere confirmacion visual'],
    };
  }

  if (lower.includes('proforma') || lower.includes('pro-forma')) {
    return {
      tipo: 'proforma_invoice',
      confianza: 'baja',
      evidencia: [`Nombre de archivo contiene keyword: ${lower}`],
      advertencias: ['Documento proforma — no valido para aduanas ni contabilizacion directa'],
    };
  }

  if (lower.includes('commercial invoice') || lower.includes('invoice')) {
    return {
      tipo: 'commercial_invoice',
      confianza: 'baja',
      evidencia: [`Nombre de archivo contiene keyword: ${lower}`],
      advertencias: ['Deteccion por nombre de archivo — IA confirmara tipo exacto'],
    };
  }

  return null;
}

function detectPdfDocType(textContent: string): DetectionResult {
  const advertencias: string[] = [];

  const hasPoliza = /\b(póliza|poliza|DUA|declaracion unica aduanera|agente aduan)\b/i.test(textContent);
  const hasBillOfLading = /\b(Bill of Lading|Airway Bill|freight|B\/L|MAWB|HAWB|house waybill)\b/i.test(textContent);
  const hasCommercialInvoice = /\b(commercial invoice|commercial invoice no|invoice number|ship to|consignee)\b/i.test(textContent);
  const hasProforma = /\b(proforma|pro-forma|pro forma invoice|quotation|estimate)\b/i.test(textContent);
  const hasForeignService = /\b(Stripe|AWS|Amazon Web Services|Shopify|Google Cloud|Adobe|Spotify|Netflix|SaaS|subscription)\b/i.test(textContent);

  if (hasPoliza) {
    return {
      tipo: 'poliza_aduanal',
      confianza: 'media',
      evidencia: ['Texto contiene terminos aduanales'],
      advertencias,
    };
  }

  if (hasBillOfLading) {
    return {
      tipo: 'airway_bill',
      confianza: 'media',
      evidencia: ['Texto contiene terminos de flete internacional'],
      advertencias,
    };
  }

  if (hasProforma) {
    advertencias.push('Documento identificado como proforma — no tiene validez fiscal ni aduanera');
    return {
      tipo: 'proforma_invoice',
      confianza: 'media',
      evidencia: ['Texto contiene terminos de proforma'],
      advertencias,
    };
  }

  if (hasForeignService) {
    return {
      tipo: 'foreign_service_receipt',
      confianza: 'media',
      evidencia: ['Texto contiene referencia a servicio digital extranjero'],
      advertencias,
    };
  }

  if (hasCommercialInvoice) {
    return {
      tipo: 'commercial_invoice',
      confianza: 'media',
      evidencia: ['Texto contiene terminos de commercial invoice'],
      advertencias,
    };
  }

  advertencias.push('No se pudo determinar el tipo exacto del documento PDF');
  return {
    tipo: 'supplier_invoice',
    confianza: 'baja',
    evidencia: ['No match con patrones conocidos — clasificado como supplier invoice generica'],
    advertencias,
  };
}

export function detectDocumentType(input: {
  rawContent?: string;
  originalName?: string;
  extractedText?: string;
  mimeType?: string;
}): DetectionResult {
  const { rawContent, originalName, extractedText } = input;
  const advertencias: string[] = [];

  if (rawContent && rawContent.trim().startsWith('<')) {
    const xmlResult = detectFromContent(rawContent);
    if (xmlResult) return xmlResult;
    advertencias.push('El contenido parece XML pero no coincide con formatos conocidos');
  }

  if (originalName) {
    const filenameResult = detectFromFilename(originalName);
    if (filenameResult) return filenameResult;
  }

  if (extractedText) {
    return detectPdfDocType(extractedText);
  }

  return {
    tipo: 'unknown',
    confianza: 'baja',
    evidencia: ['Sin suficiente informacion para determinar el tipo de documento'],
    advertencias: ['No se pudo determinar automaticamente el tipo de documento'],
  };
}

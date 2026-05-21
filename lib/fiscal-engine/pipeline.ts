import {
  DocumentoProcesado,
  Meta,
  DocumentoIdentificacion,
  IdentificacionParte,
  LineaDetalleOutput,
  TotalesOutput,
  ImportacionOutput,
  AsientoContableSugerido,
  ClasificacionFiscalOutput,
  TipoCompra,
  Deducibilidad,
  ImpuestoTipo,
  DocumentType,
  ConfidenceLevel,
} from '@/lib/types';
import { detectDocumentType, DetectionResult } from '@/lib/fiscal-engine/document-detector';
import { extractFromCrXml, CrXmlExtracted, RawLine } from '@/lib/fiscal-engine/cr-xml-extractor';
import { extractFromCfdi, CfdiExtracted, CfdiRawLine } from '@/lib/fiscal-engine/cfdi-extractor';
import { classifyLine, ClassificationResult } from '@/lib/fiscal-engine/rules/costa-rica/deducibility';
import { findRetentions, RetentionParams } from '@/lib/fiscal-engine/rules/costa-rica/retentions';
import {
  calculateImportCost,
  ImportCostingInput,
  isCompleteImport,
  getMissingImportFields,
} from '@/lib/fiscal-engine/import-costing';
import { generateJournalEntry, JournalEntryInput } from '@/lib/fiscal-engine/journal-entries';
import { FlagCode } from '@/lib/fiscal-engine/flags';

function parseFloatSafe(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  const n = typeof val === 'number' ? val : parseFloat(val);
  return isNaN(n) ? null : n;
}

function parseIntSafe(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  const n = typeof val === 'number' ? Math.round(val) : parseInt(val, 10);
  return isNaN(n) ? null : n;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface LineForClassification {
  descripcion: string | null;
  precio_unitario: number | null;
  cantidad: number | null;
  impuestoTipo: ImpuestoTipo | null;
  impuestoMonto: number | null;
  impuestoTarifa: number | null;
  subtotal_linea: number | null;
  total_linea: number | null;
  codigo_cabys: string | null;
  codigo_hs: string | null;
  codigo_producto: string | null;
  numero_linea: number | null;
  unidad_medida: string | null;
  descuento_monto: number | null;
  descuento_porcentaje: number | null;
}

function buildLineOutput(line: LineForClassification, documentEsInternacional: boolean, flags: string[]): LineaDetalleOutput {
  const cls: ClassificationResult = classifyLine(
    line.descripcion,
    line.precio_unitario,
    line.cantidad,
    documentEsInternacional,
  );

  flags.push(...cls.flags);

  return {
    numero_linea: line.numero_linea,
    codigo_producto: line.codigo_producto,
    codigo_cabys: line.codigo_cabys,
    codigo_hs: line.codigo_hs,
    descripcion: line.descripcion,
    cantidad: line.cantidad,
    unidad_medida: line.unidad_medida,
    precio_unitario: line.precio_unitario,
    descuento_monto: line.descuento_monto,
    descuento_porcentaje: line.descuento_porcentaje,
    subtotal_linea: line.subtotal_linea,
    impuesto_tipo: line.impuestoTipo,
    impuesto_tarifa_porcentaje: line.impuestoTarifa,
    impuesto_monto: line.impuestoMonto,
    total_linea: line.total_linea,
    clasificacion_tipo_compra: cls.tipo_compra,
    cuenta_contable_sugerida: cls.accountCode,
    nombre_cuenta_sugerida: cls.accountCode, // filled in by caller
    deducible_hacienda: cls.deducibilidad,
    razon_deducibilidad: cls.razon,
    aplica_retencion: false,
    porcentaje_retencion: null,
  };
}

function processCrXml(extracted: CrXmlExtracted, tipoCambio: number | null): DocumentoProcesado {
  const flags: string[] = [];
  const esInternacional = (extracted.emisor.pais !== 'CR' && extracted.emisor.pais !== null);

  if (extracted.tipo === 'tiquete_electronico_cr') {
    flags.push('GASTO_NO_DEDUCIBLE_DETECTADO');
  }

  if (extracted.identificacion.moneda_original && extracted.identificacion.moneda_original !== 'CRC' && tipoCambio === null) {
    flags.push('TIPO_CAMBIO_REQUERIDO');
  }

  const lineasSinCabys = extracted.lineas.filter(l => !l.codigoCabys);
  if (lineasSinCabys.length > 0 && (extracted.tipo === 'factura_electronica_cr_v44')) {
    flags.push('CABYS_FALTANTE');
  }

  if (extracted.receptor.codigo_actividad_ciiu === null && (extracted.tipo === 'factura_electronica_cr_v44')) {
    flags.push('CIIU_RECEPTOR_FALTANTE');
  }

  const lines: LineaDetalleOutput[] = extracted.lineas.map((rl: RawLine) => {
    const pUnit = parseFloatSafe(rl.precioUnitario);
    const cantidad = parseFloatSafe(rl.cantidad);
    const descuentoMonto = parseFloatSafe(rl.montoDescuento);
    const subtotal = parseFloatSafe(rl.subtotal);
    const montoTotal = parseFloatSafe(rl.montoTotalLinea);
    const impMonto = parseFloatSafe(rl.impuestoMonto);
    const tarifa = rl.impuestoCodigoTarifa ? parseFloatSafe(rl.impuestoCodigoTarifa) : null;

    const lineFlags: string[] = [];
    const cls = classifyLine(rl.descripcion, pUnit, cantidad, esInternacional);
    lineFlags.push(...cls.flags);

    return {
      numero_linea: rl.numeroLinea ? parseIntSafe(rl.numeroLinea) : null,
      codigo_producto: rl.codigo,
      codigo_cabys: rl.codigoCabys,
      codigo_hs: null,
      descripcion: rl.descripcion,
      cantidad,
      unidad_medida: rl.unidadMedida,
      precio_unitario: pUnit,
      descuento_monto: descuentoMonto,
      descuento_porcentaje: null,
      subtotal_linea: subtotal,
      impuesto_tipo: rl.impuestoTipo ? (rl.impuestoTipo as ImpuestoTipo) : null,
      impuesto_tarifa_porcentaje: tarifa,
      impuesto_monto: impMonto,
      total_linea: montoTotal,
      clasificacion_tipo_compra: cls.tipo_compra,
      cuenta_contable_sugerida: cls.accountCode,
      nombre_cuenta_sugerida: cls.accountCode,
      deducible_hacienda: cls.deducibilidad as Deducibilidad,
      razon_deducibilidad: cls.razon,
      aplica_retencion: false,
      porcentaje_retencion: null,
    };
  });

  const { clasificacionFiscal, retenciones } = computeFiscalSummary(lines, flags, extracted.emisor, extracted.identificacion.moneda_original);
  const importacion = computeImportSection(
    lines,
    esInternacional,
    flags,
    {
      pais_origen: extracted.emisor.pais,
      moneda_original: extracted.identificacion.moneda_original,
      tipo_cambio: tipoCambio,
    },
  );

  const asiento = generateJournalEntry({
    fecha: extracted.identificacion.fecha_emision,
    referencia: extracted.identificacion.numero_documento,
    tipoCompra: clasificacionFiscal.tipoPredominante,
    esNacional: !esInternacional,
    esCredito: extracted.identificacion.condicion_venta === 'credito',
    subtotal: extracted.totales.subtotal_sin_impuestos,
    totalIva: extracted.totales.total_iva,
    totalDocumento: extracted.totales.total_documento,
    importacion: importacion.es_documento_importacion ? importacion : undefined,
    aplicaRetencion: retenciones.aplica,
    montoRetencion: clasificacionFiscal.monto_retencion_total,
    montoBruto: extracted.totales.subtotal_sin_impuestos ?? 0,
  });

  return {
    meta: {
      ...extracted.meta,
      advertencias: [...extracted.meta.advertencias, ...clasificacionFiscal.flags],
    },
    identificacion: extracted.identificacion,
    emisor: extracted.emisor,
    receptor: extracted.receptor,
    lineas_detalle: lines,
    totales: extracted.totales,
    importacion,
    asiento_contable_sugerido: asiento,
    clasificacion_fiscal: {
      total_deducible_hacienda: clasificacionFiscal.total_deducible,
      total_no_deducible: clasificacionFiscal.total_no_deducible,
      total_costo_inventario: clasificacionFiscal.total_costo_inventario,
      requiere_retencion: retenciones.aplica,
      monto_retencion_total: clasificacionFiscal.monto_retencion_total,
      flags: clasificacionFiscal.flags,
    },
  };
}

function processFromCfdi(extracted: CfdiExtracted, tipoCambio: number | null): DocumentoProcesado {
  const flags: string[] = [];
  const esInternacional = true;
  const moneda = extracted.identificacion.moneda_original;

  if (moneda && moneda !== 'CRC' && tipoCambio === null) {
    flags.push('TIPO_CAMBIO_REQUERIDO');
  }

  const lines: LineaDetalleOutput[] = extracted.lineas.map((cl: CfdiRawLine) => {
    const pUnit = parseFloatSafe(cl.valorUnitario);
    const cantidad = parseFloatSafe(cl.cantidad);
    const descuento = parseFloatSafe(cl.descuento);
    const importe = parseFloatSafe(cl.importe);
    const impMonto = parseFloatSafe(cl.impuestoMonto);
    let impuestoTipo: ImpuestoTipo = 'otro';
    let tarifa: number | null = null;
    if (cl.impuestoTipo) {
      impuestoTipo = 'IVA';
      tarifa = cl.impuestoTasa ? parseFloat(cl.impuestoTasa) : null;
    }

    const lineFlags: string[] = [];
    const cls = classifyLine(cl.descripcion, pUnit, cantidad, esInternacional);
    lineFlags.push(...cls.flags);

    return {
      numero_linea: null,
      codigo_producto: cl.noIdentificacion,
      codigo_cabys: null,
      codigo_hs: cl.claveProdServ,
      descripcion: cl.descripcion,
      cantidad,
      unidad_medida: cl.unidad,
      precio_unitario: pUnit,
      descuento_monto: descuento,
      descuento_porcentaje: null,
      subtotal_linea: importe,
      impuesto_tipo: impuestoTipo,
      impuesto_tarifa_porcentaje: tarifa,
      impuesto_monto: impMonto,
      total_linea: importe ? (impMonto ? round2(importe + impMonto) : importe) : null,
      clasificacion_tipo_compra: cls.tipo_compra,
      cuenta_contable_sugerida: cls.accountCode,
      nombre_cuenta_sugerida: cls.accountCode,
      deducible_hacienda: cls.deducibilidad as Deducibilidad,
      razon_deducibilidad: cls.razon,
      aplica_retencion: false,
      porcentaje_retencion: null,
    };
  });

  const { clasificacionFiscal, retenciones } = computeFiscalSummary(lines, flags, extracted.emisor, moneda);
  flags.push('AUTOFACTURA_REQUERIDA');

  const importacion: ImportacionOutput = {
    es_documento_importacion: true,
    numero_poliza_aduanal: null,
    numero_declaracion_aduanera: null,
    aduana_ingreso: null,
    fecha_despacho_aduanal: null,
    pais_origen_mercancias: extracted.emisor.pais,
    incoterm: null,
    valor_fob: null,
    seguro: null,
    flete_internacional: null,
    valor_cif: null,
    dai_porcentaje: null,
    dai_monto: null,
    iva_importacion_porcentaje: 0.13,
    iva_importacion_monto: null,
    otros_cargos_aduanales: null,
    costo_total_importacion: null,
    cantidad_total_importada: null,
    costo_unitario_bodega: null,
  };

  const asiento = generateJournalEntry({
    fecha: extracted.identificacion.fecha_emision,
    referencia: extracted.identificacion.numero_documento,
    tipoCompra: clasificacionFiscal.tipoPredominante,
    esNacional: false,
    esCredito: extracted.identificacion.condicion_venta === 'credito',
    subtotal: extracted.totales.subtotal_sin_impuestos,
    totalIva: extracted.totales.total_iva,
    totalDocumento: extracted.totales.total_documento,
    importacion: undefined,
    aplicaRetencion: retenciones.aplica,
    montoRetencion: clasificacionFiscal.monto_retencion_total,
    montoBruto: extracted.totales.subtotal_sin_impuestos ?? 0,
  });

  return {
    meta: {
      ...extracted.meta,
      advertencias: [...extracted.meta.advertencias, ...clasificacionFiscal.flags],
    },
    identificacion: extracted.identificacion,
    emisor: extracted.emisor,
    receptor: extracted.receptor,
    lineas_detalle: lines,
    totales: extracted.totales,
    importacion,
    asiento_contable_sugerido: asiento,
    clasificacion_fiscal: {
      total_deducible_hacienda: clasificacionFiscal.total_deducible,
      total_no_deducible: clasificacionFiscal.total_no_deducible,
      total_costo_inventario: clasificacionFiscal.total_costo_inventario,
      requiere_retencion: retenciones.aplica,
      monto_retencion_total: clasificacionFiscal.monto_retencion_total,
      flags: clasificacionFiscal.flags,
    },
  };
}

interface FiscalSummary {
  tipoPredominante: string;
  total_deducible: number;
  total_no_deducible: number;
  total_costo_inventario: number;
  monto_retencion_total: number;
  flags: string[];
}

function computeFiscalSummary(
  lines: LineaDetalleOutput[],
  extraFlags: string[],
  emisor: IdentificacionParte,
  monedaOriginal: string | null,
): { clasificacionFiscal: FiscalSummary; retenciones: { aplica: boolean } } {
  let totalDeducible = 0;
  let totalNoDeducible = 0;
  let totalCostoInventario = 0;
  let montoRetencion = 0;
  const flags = [...extraFlags];
  const tipoCounts: Record<string, number> = {};

  for (const line of lines) {
    const total = line.total_linea ?? line.subtotal_linea ?? 0;
    if (line.deducible_hacienda === 'deducible_sin_limite' || line.deducible_hacienda === 'deducible_con_limite') {
      totalDeducible += total;
    } else {
      totalNoDeducible += total;
    }
    if (line.clasificacion_tipo_compra === 'mercaderia' || line.clasificacion_tipo_compra === 'materia_prima' || line.clasificacion_tipo_compra === 'flete_importacion') {
      totalCostoInventario += total;
    }

    tipoCounts[line.clasificacion_tipo_compra] = (tipoCounts[line.clasificacion_tipo_compra] || 0) + 1;
  }

  const tipoPredominante = Object.entries(tipoCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'gasto_operativo';

  const retParams: RetentionParams = {
    tipoCompra: tipoPredominante,
    emisorEsPersonaFisica: emisor.tipo_identificacion === 'cedula_fisica' || emisor.tipo_identificacion === 'DIMEX',
    emisorEsDomiciliado: emisor.pais === 'CR',
    emisorTipoIdentificacion: emisor.tipo_identificacion ?? 'otro',
    esServicioDigitalExtranjero: tipoPredominante === 'servicio_recurrente' && emisor.pais !== 'CR',
    paisEmisor: emisor.pais,
  };

  const retenciones = findRetentions(retParams);

  for (const rule of retenciones.rules) {
    montoRetencion += totalDeducible * (rule.percentage / 100);
  }

  if (retenciones.aplica && tipoPredominante === 'servicio_profesional') {
    flags.push('RETENCION_PENDIENTE');
  }

  if (monedaOriginal !== 'CRC' && emisor.pais !== 'CR' && (tipoPredominante === 'servicio_recurrente' || tipoPredominante === 'servicio_profesional')) {
    flags.push('IVA_SERVICIOS_DIGITALES');
  }

  return {
    clasificacionFiscal: {
      tipoPredominante,
      total_deducible: round2(totalDeducible),
      total_no_deducible: round2(totalNoDeducible),
      total_costo_inventario: round2(totalCostoInventario),
      monto_retencion_total: round2(montoRetencion),
      flags: [...new Set(flags)],
    },
    retenciones,
  };
}

function computeImportSection(
  lines: LineaDetalleOutput[],
  esInternacional: boolean,
  flags: string[],
  context: { pais_origen: string | null; moneda_original: string | null; tipo_cambio: number | null },
): ImportacionOutput {
  if (!esInternacional) {
    return {
      es_documento_importacion: false,
      numero_poliza_aduanal: null, numero_declaracion_aduanera: null,
      aduana_ingreso: null, fecha_despacho_aduanal: null,
      pais_origen_mercancias: null, incoterm: null,
      valor_fob: null, seguro: null, flete_internacional: null,
      valor_cif: null, dai_porcentaje: null, dai_monto: null,
      iva_importacion_porcentaje: 0.13, iva_importacion_monto: null,
      otros_cargos_aduanales: null, costo_total_importacion: null,
      cantidad_total_importada: null, costo_unitario_bodega: null,
    };
  }

  const fob = lines
    .filter(l => l.clasificacion_tipo_compra === 'mercaderia')
    .reduce((s, l) => s + (l.subtotal_linea ?? 0), 0);

  const importInput: ImportCostingInput = {
    valor_fob: fob > 0 ? fob : null,
    seguro: null,
    flete_internacional: null,
    dai_porcentaje: null,
    otros_cargos_aduanales: null,
    cantidad_total_importada: null,
    pais_origen: context.pais_origen,
    incoterm: null,
    numero_poliza: null,
    numero_dua: null,
    aduana: null,
    fecha_despacho: null,
    es_contribuyente_iva: true,
  };

  const importResult = calculateImportCost(importInput);

  if (!isCompleteImport(importInput)) {
    flags.push('POLIZA_PENDIENTE');
  }

  if (context.moneda_original !== 'CRC' && context.moneda_original !== 'CR' && context.tipo_cambio === null) {
    flags.push('TIPO_CAMBIO_REQUERIDO');
  }

  return importResult;
}

function buildFromLlmExtraction(extracted: any, detection: DetectionResult, tipoCambio: number | null): DocumentoProcesado {
  const flags: string[] = [];
  const esInternacional = extracted.metadata?.origin === 'international' || detection.tipo === 'foreign_service_receipt';
  const moneda = extracted.metadata?.currency || null;
  const emisorPais = extracted.issuer?.country || (esInternacional ? null : 'CR');

  if (moneda && moneda !== 'CRC' && tipoCambio === null) {
    flags.push('TIPO_CAMBIO_REQUERIDO');
  }

  if (detection.tipo === 'foreign_service_receipt') {
    flags.push('IVA_SERVICIOS_DIGITALES');
    flags.push('AUTOFACTURA_REQUERIDA');
  }

  const lines: LineaDetalleOutput[] = (extracted.items || []).map((item: any, idx: number) => {
    const totalLine = parseFloatSafe(item.totalLineForeign) ?? 0;
    const subTotal = parseFloatSafe(item.subtotalForeign) ?? parseFloatSafe(item.unitPriceForeign) ?? 0;
    const taxAmt = parseFloatSafe(item.taxAmountForeign) ?? 0;
    const pUnit = parseFloatSafe(item.unitPriceForeign);
    const qty = parseFloatSafe(item.quantity);

    const lineFlags: string[] = [];
    const desc = item.description || 'Producto/Servicio';
    const cls = classifyLine(desc, pUnit, qty, esInternacional);
    lineFlags.push(...cls.flags);

    return {
      numero_linea: idx + 1,
      codigo_producto: item.sku || null,
      codigo_cabys: null,
      codigo_hs: null,
      descripcion: desc,
      cantidad: qty,
      unidad_medida: item.unitMeasure || null,
      precio_unitario: pUnit,
      descuento_monto: parseFloatSafe(item.discount) ?? null,
      descuento_porcentaje: null,
      subtotal_linea: subTotal,
      impuesto_tipo: taxAmt > 0 ? 'IVA' as ImpuestoTipo : 'exento' as ImpuestoTipo,
      impuesto_tarifa_porcentaje: subTotal > 0 ? round2(taxAmt / subTotal) : 0,
      impuesto_monto: taxAmt,
      total_linea: totalLine,
      clasificacion_tipo_compra: cls.tipo_compra,
      cuenta_contable_sugerida: cls.accountCode,
      nombre_cuenta_sugerida: cls.accountCode,
      deducible_hacienda: cls.deducibilidad as Deducibilidad,
      razon_deducibilidad: cls.razon,
      aplica_retencion: false,
      porcentaje_retencion: null,
    };
  });

  const emisor: IdentificacionParte = {
    nombre: extracted.issuer?.name || null,
    nombre_comercial: null,
    tipo_identificacion: extracted.issuer?.taxIdType || 'otro',
    numero_identificacion: extracted.issuer?.idNumber || extracted.issuer?.taxId || null,
    pais: emisorPais,
    direccion_completa: extracted.issuer?.address || null,
    telefono: extracted.issuer?.phone || null,
    correo: extracted.issuer?.email || null,
    codigo_actividad_ciiu: null,
  };

  const clasificacionResult = computeFiscalSummary(lines, flags, emisor, moneda);
  const clasificacionFiscal = clasificacionResult.clasificacionFiscal;

  const importContext = {
    pais_origen: emisorPais,
    moneda_original: moneda,
    tipo_cambio: tipoCambio,
  };
  const importacion = computeImportSection(lines, esInternacional, clasificacionFiscal.flags, importContext);

  const asiento = generateJournalEntry({
    fecha: extracted.metadata?.issueDate || null,
    referencia: extracted.metadata?.documentId || null,
    tipoCompra: clasificacionFiscal.tipoPredominante,
    esNacional: !esInternacional,
    esCredito: false,
    subtotal: parseFloatSafe(extracted.totals?.subTotalForeign) ?? null,
    totalIva: parseFloatSafe(extracted.totals?.taxAmountForeign) ?? null,
    totalDocumento: parseFloatSafe(extracted.totals?.grandTotalForeign) ?? null,
    importacion: importacion.es_documento_importacion ? importacion : undefined,
    aplicaRetencion: clasificacionResult.retenciones.aplica,
    montoRetencion: clasificacionFiscal.monto_retencion_total,
    montoBruto: parseFloatSafe(extracted.totals?.subTotalForeign) ?? 0,
  });

  return {
    meta: {
      tipo_documento: detection.tipo,
      version_formato: null,
      confianza_extraccion: detection.confianza === 'alta' ? 'alta' : (detection.confianza === 'media' ? 'media' : 'baja'),
      idioma_original: extracted.metadata?.language || null,
      moneda_original: moneda,
      advertencias: [...detection.advertencias, ...clasificacionFiscal.flags],
    },
    identificacion: {
      numero_documento: extracted.metadata?.documentId || null,
      clave_numerica_50: null,
      uuid_cfdi: null,
      fecha_emision: extracted.metadata?.issueDate || null,
      fecha_vencimiento: extracted.metadata?.dueDate || null,
      condicion_venta: null,
      dias_credito: null,
      medio_pago: extracted.metadata?.paymentMethod || null,
      numero_orden_compra: extracted.metadata?.poNumber || null,
      moneda_original: moneda,
    },
    emisor,
    receptor: {
      nombre: null, nombre_comercial: null, tipo_identificacion: null,
      numero_identificacion: null, pais: null, direccion_completa: null,
      telefono: null, correo: null, codigo_actividad_ciiu: null,
    },
    lineas_detalle: lines,
    totales: {
      subtotal_sin_impuestos: parseFloatSafe(extracted.totals?.subTotalForeign) ?? null,
      total_descuentos: parseFloatSafe(extracted.totals?.totalDiscount) ?? null,
      total_impuestos: parseFloatSafe(extracted.totals?.taxAmountForeign) ?? null,
      total_iva: parseFloatSafe(extracted.totals?.taxAmountForeign) ?? null,
      total_otros_impuestos: null,
      total_documento: parseFloatSafe(extracted.totals?.grandTotalForeign) ?? null,
      tipo_cambio_a_crc: tipoCambio,
      total_documento_crc: tipoCambio && extracted.totals?.grandTotalForeign
        ? Math.round(extracted.totals.grandTotalForeign * tipoCambio)
        : null,
    },
    importacion,
    asiento_contable_sugerido: asiento,
    clasificacion_fiscal: {
      total_deducible_hacienda: clasificacionFiscal.total_deducible,
      total_no_deducible: clasificacionFiscal.total_no_deducible,
      total_costo_inventario: clasificacionFiscal.total_costo_inventario,
      requiere_retencion: clasificacionResult.retenciones.aplica,
      monto_retencion_total: clasificacionFiscal.monto_retencion_total,
      flags: clasificacionFiscal.flags,
    },
  };
}

export async function processDocument(input: {
  rawContent?: string;
  originalName?: string;
  extractedText?: string;
  mimeType?: string;
  tipoCambio?: number | null;
  llmExtraction?: any;
}): Promise<DocumentoProcesado> {
  const { rawContent, originalName, extractedText, mimeType, tipoCambio, llmExtraction } = input;

  const detection = detectDocumentType({ rawContent, originalName, extractedText, mimeType });

  if (llmExtraction) {
    return buildFromLlmExtraction(llmExtraction, detection, tipoCambio ?? null);
  }

  if (rawContent && (detection.tipo === 'factura_electronica_cr_v44' || detection.tipo === 'factura_electronica_cr_v43' ||
    detection.tipo === 'factura_compra_electronica_cr' || detection.tipo === 'tiquete_electronico_cr')) {
    const extracted = await extractFromCrXml(rawContent);
    return processCrXml(extracted, extracted.totales.tipo_cambio_a_crc ?? tipoCambio ?? null);
  }

  if (rawContent && detection.tipo === 'cfdi_40_mexico') {
    const extracted = await extractFromCfdi(rawContent);
    return processFromCfdi(extracted, extracted.totales.tipo_cambio_a_crc ?? tipoCambio ?? null);
  }

  throw new Error(`No se pudo procesar el documento. Tipo detectado: ${detection.tipo}`);
}

import { Parser } from 'xml2js';
import {
  DocumentType,
  Meta,
  DocumentoIdentificacion,
  IdentificacionParte,
  TotalesOutput,
  TipoIdentificacion,
  CondicionVenta,
  ImpuestoTipo,
} from '@/lib/types';

const parser = new Parser({ explicitArray: false, trim: true, normalize: true });

export interface RawLine {
  numeroLinea: string | null;
  codigo: string | null;
  codigoCabys: string | null;
  descripcion: string | null;
  cantidad: string | null;
  unidadMedida: string | null;
  precioUnitario: string | null;
  montoDescuento: string | null;
  naturalezaDescuento: string | null;
  subtotal: string | null;
  montoTotalLinea: string | null;
  impuestoTipo: string | null;
  impuestoTarifa: string | null;
  impuestoMonto: string | null;
  impuestoCodigoTarifa: string | null;
}

export interface CrXmlExtracted {
  tipo: DocumentType;
  version: string | null;
  meta: Meta;
  identificacion: DocumentoIdentificacion;
  emisor: IdentificacionParte;
  receptor: IdentificacionParte;
  lineas: RawLine[];
  totales: TotalesOutput;
}

function mapTipoIdentificacion(code: string): TipoIdentificacion {
  const map: Record<string, TipoIdentificacion> = {
    '01': 'cedula_fisica',
    '02': 'cedula_juridica',
    '03': 'NITE',
    '04': 'DIMEX',
    '05': 'extranjero_no_domiciliado',
  };
  return map[code] || 'otro';
}

function mapCondicionVenta(code: string): CondicionVenta {
  if (code === '01') return 'contado';
  if (code === '02') return 'credito';
  if (code === '03') return 'otro';
  if (code === '04') return 'otro';
  if (code === '05') return 'otro';
  return 'otro';
}

function mapMedioPago(code: string): string {
  const map: Record<string, string> = {
    '01': 'efectivo',
    '02': 'tarjeta',
    '03': 'cheque',
    '04': 'transferencia',
    '05': 'SINPE',
    '06': 'SINPE movil',
    '07': 'PayPal',
    '99': 'otro',
  };
  return map[code] || code;
}

function parseImpuestoTipo(code: string | null): ImpuestoTipo {
  if (!code) return 'otro';
  if (code === '01') return 'IVA';
  if (code === '02') return 'ISC';
  if (code === '03') return 'exento';
  if (code === '04') return 'exento';
  if (code === '05') return 'otro';
  if (code === '06') return 'otro';
  if (code === '07') return 'otro';
  if (code === '08') return 'IVA_importacion';
  return 'otro';
}

function parseTarifaImpuesto(code: string | null): number {
  if (!code) return 0;
  const map: Record<string, number> = {
    '01': 1,
    '02': 2,
    '03': 4,
    '04': 13,
    '05': 0,
    '06': 0,
    '07': 0,
    '08': 0,
  };
  return map[code] || 0;
}

function cleanHtmlEntities(str: string | null | undefined): string | null {
  if (!str) return null;
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#x2F;/g, '/').trim();
}

function parseResumenFactura(resumen: any, totales: TotalesOutput): TotalesOutput {
  if (!resumen) return totales;
  return {
    ...totales,
    subtotal_sin_impuestos: totales.subtotal_sin_impuestos ?? parseFloat(resumen.SubTotalGravado) ?? null,
    total_descuentos: parseFloat(resumen.TotalDescuentos) ?? null,
    total_impuestos: parseFloat(resumen.TotalImpuesto) ?? null,
    total_iva: parseFloat(resumen.TotalIVADevuelto) ?? parseFloat(resumen.TotalImpuesto) ?? null,
    total_otros_impuestos: parseFloat(resumen.TotalOtrosCargos) ?? null,
  };
}

export async function extractFromCrXml(rawXml: string): Promise<CrXmlExtracted> {
  const parsed = await parser.parseStringPromise(rawXml);

  const root = parsed.FacturaElectronica || parsed.FacturaElectronicaCompra || parsed.TiqueteElectronico || parsed.NotaCreditoElectronica;
  if (!root) {
    throw new Error('No se encontró un elemento raíz válido de Hacienda CR');
  }

  const isCompra = !!parsed.FacturaElectronicaCompra;
  const isTiquete = !!parsed.TiqueteElectronico;
  const isNotaCredito = !!parsed.NotaCreditoElectronica;
  const isV44 = rawXml.includes('"4.4"') || rawXml.includes('version="4.4"') || rawXml.includes('&#34;4.4&#34;');

  let tipo: DocumentType;
  if (isCompra) tipo = 'factura_compra_electronica_cr';
  else if (isTiquete) tipo = 'tiquete_electronico_cr';
  else if (isV44) tipo = 'factura_electronica_cr_v44';
  else tipo = 'factura_electronica_cr_v43';

  const clave = cleanHtmlEntities(root.Clave) || null;
  const numeroConsecutivo = cleanHtmlEntities(root.NumeroConsecutivo) || null;
  const fechaEmision = cleanHtmlEntities(root.FechaEmision) || null;
  const fechaVencimiento = cleanHtmlEntities(root.FechaVencimiento) || null;
  const condicionVenta = cleanHtmlEntities(root.CondicionVenta) || null;
  const plazoCredito = root.PlazoCredito ? parseInt(root.PlazoCredito, 10) : null;
  const medioPago = cleanHtmlEntities(root.MedioPago) || null;
  const codigoMoneda = cleanHtmlEntities(root.CodigoTipoMoneda?.CodigoMoneda) || null;
  const tipoCambio = root.CodigoTipoMoneda?.TipoCambio ? parseFloat(root.CodigoTipoMoneda.TipoCambio) : null;
  const numeroOrdenCompra = cleanHtmlEntities(root.NumeroOrdenCompra) || null;

  const emisorRaw = root.Emisor || {};
  const receptorRaw = root.Receptor || null;

  function mapParte(raw: any): IdentificacionParte {
    if (!raw) {
      return {
        nombre: null, nombre_comercial: null, tipo_identificacion: null,
        numero_identificacion: null, pais: null, direccion_completa: null,
        telefono: null, correo: null, codigo_actividad_ciiu: null,
      };
    }

    const idRaw = raw.Identificacion || {};
    const tipoId = cleanHtmlEntities(idRaw.Tipo) || null;
    const numeroId = cleanHtmlEntities(idRaw.Numero) || null;
    const nom = cleanHtmlEntities(raw.Nombre) || null;
    const nomCom = cleanHtmlEntities(raw.NombreComercial) || null;
    const ciiu = cleanHtmlEntities(raw.CodigoActividad) || cleanHtmlEntities(raw.CodigoActividadEconomica) || null;
    const dir = cleanHtmlEntities(raw.DireccionCompleta) || null;
    const tel = cleanHtmlEntities(raw.Telefono) || null;
    const correo = cleanHtmlEntities(raw.CorreoElectronico) || null;
    const pais = cleanHtmlEntities(raw.PaisNacionalidad) || null;

    return {
      nombre: nom,
      nombre_comercial: nomCom,
      tipo_identificacion: tipoId ? mapTipoIdentificacion(tipoId) : null,
      numero_identificacion: numeroId,
      pais: pais || (isTiquete ? null : 'CR'),
      direccion_completa: dir,
      telefono: tel,
      correo: correo,
      codigo_actividad_ciiu: ciiu,
    };
  }

  const emisor = mapParte(emisorRaw);
  const receptor = receptorRaw ? mapParte(receptorRaw) : {
    nombre: null, nombre_comercial: null, tipo_identificacion: null,
    numero_identificacion: null, pais: null, direccion_completa: null,
    telefono: null, correo: null, codigo_actividad_ciiu: null,
  };

  const detalle = root.DetalleServicio?.LineaDetalle || [];
  const lineasArr = Array.isArray(detalle) ? detalle : [detalle];

  const lineas: RawLine[] = lineasArr.map((linea: any) => {
    const codigo = cleanHtmlEntities(linea.Codigo?.Codigo) || null;
    const cabys = cleanHtmlEntities(linea.Codigo?.CodigoCabys) || cleanHtmlEntities(linea.CodigoCabys) || null;
    const desc = cleanHtmlEntities(linea.Detalle) || null;
    const cant = linea.Cantidad ? parseFloat(linea.Cantidad).toString() : null;
    const unid = cleanHtmlEntities(linea.UnidadMedida) || cleanHtmlEntities(linea.UnidadMedidaComercial) || null;
    const pUnit = linea.PrecioUnitario ? parseFloat(linea.PrecioUnitario).toString() : null;
    const montoDesc = linea.MontoDescuento ? parseFloat(linea.MontoDescuento).toString() : null;
    const natureDesc = cleanHtmlEntities(linea.NaturalezaDescuento) || null;
    const subTotal = linea.SubTotal ? parseFloat(linea.SubTotal).toString() : null;
    const montoTotal = linea.MontoTotalLinea ? parseFloat(linea.MontoTotalLinea).toString() : null;

    const impuestoRaw = linea.Impuesto || linea.ImpuestoIVA || {};
    const impArr = Array.isArray(impuestoRaw) ? impuestoRaw : (impuestoRaw ? [impuestoRaw] : []);
    const firstTax = impArr[0] || {};

    const impTipo = cleanHtmlEntities(firstTax.Codigo) || null;
    const impTarifa = cleanHtmlEntities(firstTax.CodigoTarifa) || null;
    const impMonto = firstTax.Monto ? parseFloat(firstTax.Monto).toString() : null;

    return {
      numeroLinea: linea.NumeroLinea || null,
      codigo,
      codigoCabys: cabys,
      descripcion: desc,
      cantidad: cant,
      unidadMedida: unid,
      precioUnitario: pUnit,
      montoDescuento: montoDesc,
      naturalezaDescuento: natureDesc,
      subtotal: subTotal,
      montoTotalLinea: montoTotal,
      impuestoTipo: impTipo,
      impuestoTarifa: impTarifa,
      impuestoMonto: impMonto,
      impuestoCodigoTarifa: firstTax.CodigoTarifa || null,
    };
  });

  const resumen = root.ResumenFactura || root.OtherCharges || {};

  let subtotalSinImpuestos: number | null = null;
  let totalDescuentos: number | null = null;
  let totalImpuestos: number | null = null;
  let totalIVA: number | null = null;
  let totalOtros: number | null = null;

  if (resumen) {
    subtotalSinImpuestos = resumen.SubTotalGravado ? parseFloat(resumen.SubTotalGravado) : null;
    totalDescuentos = resumen.TotalDescuentos ? parseFloat(resumen.TotalDescuentos) : null;
    totalImpuestos = resumen.TotalImpuesto ? parseFloat(resumen.TotalImpuesto) : null;
    totalIVA = (resumen.TotalIVADevuelto ? parseFloat(resumen.TotalIVADevuelto) : null) || totalImpuestos;
    totalOtros = resumen.TotalOtrosCargos ? parseFloat(resumen.TotalOtrosCargos) : null;
  }

  if (subtotalSinImpuestos === null) {
    subtotalSinImpuestos = lineas.reduce((acc, l) => acc + (parseFloat(l.subtotal || '0') || 0), 0);
  }

  const totalDocumento = root.TotalFactura ? parseFloat(root.TotalFactura) : (
    resumen.TotalComprobante ? parseFloat(resumen.TotalComprobante) : null
  );

  const advertencias: string[] = [];
  if (isNotaCredito) {
    advertencias.push('Documento es Nota de Crédito Electrónica — procesar como inversión de la factura original');
  }
  if (isCompra) {
    advertencias.push('Factura de Compra Electrónica — auto-factura emitida por el receptor para servicios del exterior');
  }

  const lineasSinCabys = lineas.filter((l) => !l.codigoCabys);
  if (lineasSinCabys.length > 0 && isV44) {
    advertencias.push(`${lineasSinCabys.length} línea(s) sin código CABYS — obligatorio en v4.4`);
  }
  if (receptorRaw && !receptor.codigo_actividad_ciiu && isV44) {
    advertencias.push('Receptor sin código de actividad económica CIIU — obligatorio en v4.4');
  }

  return {
    tipo,
    version: isV44 ? '4.4' : (isCompra ? '4.4' : '4.3'),
    meta: {
      tipo_documento: tipo,
      version_formato: isV44 ? '4.4' : (isCompra ? '4.4' : '4.3'),
      confianza_extraccion: 'alta',
      idioma_original: 'es',
      moneda_original: codigoMoneda,
      advertencias,
    },
    identificacion: {
      numero_documento: numeroConsecutivo,
      clave_numerica_50: clave,
      uuid_cfdi: null,
      fecha_emision: fechaEmision,
      fecha_vencimiento: fechaVencimiento,
      condicion_venta: condicionVenta ? mapCondicionVenta(condicionVenta) : null,
      dias_credito: plazoCredito,
      medio_pago: medioPago ? mapMedioPago(medioPago) : null,
      numero_orden_compra: numeroOrdenCompra,
      moneda_original: codigoMoneda,
    },
    emisor,
    receptor,
    lineas,
    totales: {
      subtotal_sin_impuestos: subtotalSinImpuestos,
      total_descuentos: totalDescuentos,
      total_impuestos: totalImpuestos,
      total_iva: totalIVA,
      total_otros_impuestos: totalOtros,
      total_documento: totalDocumento,
      tipo_cambio_a_crc: tipoCambio,
      total_documento_crc: totalDocumento && tipoCambio ? Math.round(totalDocumento * tipoCambio) : null,
    },
  };
}

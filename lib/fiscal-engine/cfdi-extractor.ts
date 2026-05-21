import { Parser } from 'xml2js';
import {
  DocumentType,
  Meta,
  DocumentoIdentificacion,
  IdentificacionParte,
  TotalesOutput,
  TipoIdentificacion,
  CondicionVenta,
} from '@/lib/types';

const parser = new Parser({
  explicitArray: false,
  trim: true,
  normalize: true,
  attrkey: '$',
  charkey: '_',
});

export interface CfdiRawLine {
  claveProdServ: string | null;
  noIdentificacion: string | null;
  cantidad: string | null;
  claveUnidad: string | null;
  unidad: string | null;
  descripcion: string | null;
  valorUnitario: string | null;
  descuento: string | null;
  importe: string | null;
  impuestoTipo: string | null;
  impuestoBase: string | null;
  impuestoTasa: string | null;
  impuestoMonto: string | null;
}

export interface CfdiExtracted {
  meta: Meta;
  identificacion: DocumentoIdentificacion;
  emisor: IdentificacionParte;
  receptor: IdentificacionParte;
  lineas: CfdiRawLine[];
  totales: TotalesOutput;
}

function mapRegimenFiscal(code: string): string {
  const map: Record<string, string> = {
    '601': 'General de Ley Personas Morales',
    '603': 'Personas Morales con Fines no Lucrativos',
    '605': 'Sueldos y Salarios e Ingresos Asimilados',
    '606': 'Arrendamiento',
    '607': 'Régimen de Enajenación o Adquisición de Bienes',
    '608': 'Demás ingresos',
    '610': 'Residentes en el Extranjero sin Establecimiento Permanente',
    '611': 'Ingresos por Dividendos',
    '612': 'Personas Físicas con Actividades Empresariales',
    '614': 'Ingresos por Intereses',
    '615': 'Régimen de los ingresos por obtención de premios',
    '616': 'Sin obligaciones fiscales',
    '620': 'Sociedades Cooperativas de Producción',
    '621': 'Incorporación Fiscal',
    '622': 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras',
    '623': 'Opcional para Grupos de Sociedades',
    '624': 'Coordinados',
    '625': 'Régimen de Actividades Empresariales con ingresos a través de Plataformas Tecnológicas',
    '626': 'Régimen Simplificado de Confianza',
  };
  return map[code] || code;
}

function parseDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  if (dateStr.includes('T')) return dateStr;
  return dateStr; // keep original format
}

function parseFormaPago(code: string | null): string {
  const map: Record<string, string> = {
    '01': 'efectivo',
    '02': 'cheque',
    '03': 'transferencia',
    '04': 'tarjeta',
    '05': 'monedero',
    '06': 'dinero electronico',
    '08': 'vales',
    '12': 'dacion',
    '13': 'pago por subrogacion',
    '14': 'pago por consignacion',
    '15': 'condonacion',
    '17': 'compensacion',
    '23': 'novacion',
    '24': 'confusion',
    '25': 'remision de deuda',
    '26': 'prescripcion o caducidad',
    '27': 'intermediacion pagos',
    '28': 'pago en especie',
    '29': 'pago por tarjeta de servicio',
    '99': 'otro',
  };
  return map[code || '99'] || 'otro';
}

export async function extractFromCfdi(rawXml: string): Promise<CfdiExtracted> {
  const parsed = await parser.parseStringPromise(rawXml);

  const cfdi = parsed['cfdi:Comprobante'] || parsed['Comprobante'];
  if (!cfdi) {
    throw new Error('No se encontró elemento Comprobante CFDI');
  }

  const advertencias: string[] = [];

  const version = cfdi.Version || cfdi.version || null;
  const serie = cfdi.Serie || null;
  const folio = cfdi.Folio || null;
  const numeroDoc = [serie, folio].filter(Boolean).join(' ') || null;
  const fecha = parseDate(cfdi.Fecha || cfdi.fecha);
  const formaPago = parseFormaPago(cfdi.FormaPago || cfdi.formaPago);
  const metodoPago = cfdi.MetodoPago || cfdi.metodoPago || null;
  const lugarExpedicion = cfdi.LugarExpedicion || cfdi.lugarExpedicion || null;
  const moneda = cfdi.Moneda || cfdi.moneda || null;
  const tipoCambio = cfdi.TipoCambio ? parseFloat(cfdi.TipoCambio) : null;
  const condicionesPago = cfdi.CondicionesDePago || null;

  const condicionVenta: CondicionVenta = metodoPago === 'PUE' ? 'contado' : metodoPago === 'PPD' ? 'credito' : 'otro';

  const emisorRaw = cfdi['cfdi:Emisor'] || cfdi['Emisor'] || {};
  const receptorRaw = cfdi['cfdi:Receptor'] || cfdi['Receptor'] || {};

  function mapParteSat(raw: any): IdentificacionParte {
    if (!raw || !raw.Nombre) {
      return {
        nombre: null, nombre_comercial: null, tipo_identificacion: 'RFC_mexico' as TipoIdentificacion,
        numero_identificacion: null, pais: 'MX', direccion_completa: null,
        telefono: null, correo: null, codigo_actividad_ciiu: null,
      };
    }
    const rfc = raw.Rfc || raw.rfc || null;
    const nombre = raw.Nombre || raw.nombre || null;
    const regimen = (raw.RegimenFiscal || raw['Regimen fiscal'] || raw.regimen) ?? null;
    const domicilio = raw.DomicilioFiscal || raw.domicilioFiscal || raw.ResidenciaFiscal || null;
    const correo = null; // CFDI does not expose email typically
    const pais = raw.ResidenciaFiscal || 'MX';

    return {
      nombre,
      nombre_comercial: null,
      tipo_identificacion: 'RFC_mexico',
      numero_identificacion: rfc,
      pais,
      direccion_completa: domicilio ? `${domicilio}${lugarExpedicion ? `, CP ${lugarExpedicion}` : ''}` : (lugarExpedicion ? `CP ${lugarExpedicion}` : null),
      telefono: null,
      correo,
      codigo_actividad_ciiu: regimen ? mapRegimenFiscal(regimen) : null,
    };
  }

  const emisor = mapParteSat(emisorRaw);
  const receptor = mapParteSat(receptorRaw);

  const conceptos = cfdi['cfdi:Conceptos']?.Concepto || cfdi['Conceptos']?.Concepto || [];
  const conceptosArr = Array.isArray(conceptos) ? conceptos : [conceptos];

  const lineas: CfdiRawLine[] = conceptosArr.map((con: any) => {
    const desc = con.Descripcion || con.descripcion || null;
    const cant = con.Cantidad || con.cantidad || null;
    const claveUnidad = con.ClaveUnidad || con.claveUnidad || null;
    const unidad = con.Unidad || con.unidad || null;
    const valorUnit = con.ValorUnitario || con.valorUnitario || null;
    const importe = con.Importe || con.importe || null;
    const descuento = con.Descuento || con.descuento || null;
    const noId = con.NoIdentificacion || con.noIdentificacion || null;
    const claveProd = con.ClaveProdServ || con.claveProdServ || null;

    let impuestoTipo: string | null = null;
    let impuestoBase: string | null = null;
    let impuestoTasa: string | null = null;
    let impuestoMonto: string | null = null;

    const impuestos = con.Impuestos || con.impuestos;
    if (impuestos) {
      const traslados = impuestos.Traslado || impuestos.traslado || null;
      const trasladosArr = traslados ? (Array.isArray(traslados) ? traslados : [traslados]) : [];
      const firstTraslado = trasladosArr[0];
      if (firstTraslado) {
        impuestoTipo = firstTraslado.Impuesto || firstTraslado.impuesto || null;
        impuestoBase = firstTraslado.Base || firstTraslado.base || null;
        impuestoTasa = firstTraslado.TasaOCuota || firstTraslado.tasaOCuota || null;
        impuestoMonto = firstTraslado.Importe || firstTraslado.importe || null;
      }
    }

    return {
      claveProdServ: claveProd,
      noIdentificacion: noId,
      cantidad: cant,
      claveUnidad,
      unidad,
      descripcion: desc,
      valorUnitario: valorUnit,
      descuento,
      importe,
      impuestoTipo,
      impuestoBase,
      impuestoTasa,
      impuestoMonto,
    };
  });

  const impuestosComprobante = cfdi['cfdi:Impuestos'] || cfdi['Impuestos'] || {};
  const totalImpuestosTrasladados = impuestosComprobante.TotalImpuestosTrasladados
    ? parseFloat(impuestosComprobante.TotalImpuestosTrasladados)
    : null;
  const totalImpuestosRetenidos = impuestosComprobante.TotalImpuestosRetenidos
    ? parseFloat(impuestosComprobante.TotalImpuestosRetenidos)
    : null;
  const subTotal = cfdi.SubTotal ? parseFloat(cfdi.SubTotal) : null;
  const descuentoTotal = cfdi.Descuento ? parseFloat(cfdi.Descuento) : null;
  const total = cfdi.Total ? parseFloat(cfdi.Total) : null;

  if (!version || version !== '4.0') {
    advertencias.push(`Versión CFDI ${version} — se esperaba 4.0`);
  }

  return {
    meta: {
      tipo_documento: 'cfdi_40_mexico',
      version_formato: version,
      confianza_extraccion: 'alta',
      idioma_original: 'es',
      moneda_original: moneda,
      advertencias,
    },
    identificacion: {
      numero_documento: numeroDoc,
      clave_numerica_50: null,
      uuid_cfdi: cfdi.UUID || cfdi.uuid || cfdi['Complemento']?.uuid || null,
      fecha_emision: fecha,
      fecha_vencimiento: null,
      condicion_venta: condicionVenta,
      dias_credito: null,
      medio_pago: formaPago,
      numero_orden_compra: null,
      moneda_original: moneda,
    },
    emisor,
    receptor,
    lineas,
    totales: {
      subtotal_sin_impuestos: subTotal,
      total_descuentos: descuentoTotal,
      total_impuestos: totalImpuestosTrasladados,
      total_iva: totalImpuestosTrasladados,
      total_otros_impuestos: totalImpuestosRetenidos,
      total_documento: total,
      tipo_cambio_a_crc: tipoCambio,
      total_documento_crc: total && tipoCambio ? Math.round(total * tipoCambio) : null,
    },
  };
}

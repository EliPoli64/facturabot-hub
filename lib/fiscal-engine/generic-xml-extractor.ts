import { Parser } from 'xml2js';
import {
  DocumentType,
  Meta,
  DocumentoIdentificacion,
  IdentificacionParte,
  TotalesOutput,
  TipoIdentificacion,
} from '@/lib/types';

const parser = new Parser({ explicitArray: false, trim: true, normalize: true });

export interface GenericXmlExtracted {
  meta: Meta;
  identificacion: DocumentoIdentificacion;
  emisor: IdentificacionParte;
  lineas: Array<{
    descripcion: string | null;
    cantidad: number | null;
    precioUnitario: number | null;
    total: number | null;
    codigo: string | null;
  }>;
  totales: TotalesOutput;
}

function extractByPaths(obj: any, paths: string[][]): any {
  for (const path of paths) {
    let current = obj;
    let found = true;
    for (const key of path) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        found = false;
        break;
      }
    }
    if (found && current !== null && current !== undefined) {
      return current;
    }
  }
  return null;
}

function parseNum(val: any): number | null {
  if (val === null || val === undefined) return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}

export async function extractFromGenericXml(rawXml: string): Promise<GenericXmlExtracted> {
  const parsed = await parser.parseStringPromise(rawXml);

  const rootKey = Object.keys(parsed).find(k =>
    ['receipt', 'Recibo', 'recu', 'Invoice', 'invoice', 'PurchaseOrder', 'purchaseOrder'].includes(k),
  );
  if (!rootKey) {
    throw new Error('No se reconoce la estructura XML del proveedor');
  }

  const root = parsed[rootKey];
  const advertencias: string[] = [];

  const company = root.company || root.empresa || root.entreprise || root.seller || root.vendor || root.Proveedor || root.proveedor || root.fournisseur || {};
  const supplier = root.supplier || root.proveedor || root.fournisseur || {};
  const receiptInfo = root.receiptInfo || root.informacionRecibo || root.details || root.header || root.info || {};
  const summary = root.summary || root.resumen || root.totaux || root.total || {};
  const rawItems = root.items?.item || root.items?.Item || root.articulos?.articulo || root.articulo || root.produits?.produit || root.lineItems?.lineItem || root.LineItems?.LineItem || [];
  const itemsArr = Array.isArray(rawItems) ? rawItems : (rawItems ? [rawItems] : []);

  const getCompanyName = () => {
    return extractByPaths(company, [
      ['name'], ['Name'], ['nombre'], ['Nombre'], ['nom'], ['Nom'],
      ['businessName'], ['BusinessName'], ['razonSocial'], ['RazonSocial'],
    ]) || null;
  };

  const getCompanyTaxId = () => {
    return extractByPaths(company, [
      ['taxId'], ['TaxId'], ['taxID'], ['TaxID'], ['cedula'], ['Cedula'],
      ['numeroFiscal'], ['NumeroFiscal'], ['registrationNumber'], ['RegistrationNumber'],
      ['rfc'], ['RFC'], ['ein'], ['EIN'],
    ]) || null;
  };

  const getCompanyAddress = () => {
    const addr = company.address || company.direccion || company.adresse || {};
    if (typeof addr === 'string') return addr;
    const parts = [
      addr.street || addr.calle || addr.rue || addr.line1 || '',
      addr.city || addr.ciudad || addr.ville || '',
      addr.state || addr.estado || addr.province || addr.region || '',
      addr.country || addr.pais || addr.pays || '',
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  const getReceiptNumber = () => {
    return extractByPaths(receiptInfo, [
      ['receiptNumber'], ['ReceiptNumber'], ['numero'], ['Numero'],
      ['numeroRecu'], ['NumeroRecu'], ['documentNumber'], ['DocumentNumber'],
      ['id'], ['ID'], ['number'], ['Number'],
    ]) || null;
  };

  const getDate = () => {
    return extractByPaths(receiptInfo, [
      ['date'], ['Date'], ['fecha'], ['Fecha'], ['issueDate'], ['IssueDate'],
    ]) || null;
  };

  const getCurrency = () => {
    return extractByPaths(receiptInfo, [
      ['currency'], ['Currency'], ['moneda'], ['Moneda'], ['devise'], ['Devise'],
      ['currencyCode'], ['CurrencyCode'],
    ]) || null;
  };

  const getSubtotal = () => {
    const v = extractByPaths(summary, [
      ['subtotal'], ['Subtotal'], ['SubTotal'], ['subTotal'], ['SubTotalGravado'],
      ['horsTaxes'], ['HorsTaxes'], ['netAmount'], ['NetAmount'],
    ]);
    return parseNum(v);
  };

  const getTax = () => {
    const v = extractByPaths(summary, [
      ['tax'], ['Tax'], ['taxAmount'], ['TaxAmount'], ['impuesto'], ['Impuesto'],
      ['taxe'], ['Taxe'], ['totalTax'], ['TotalTax'], ['iva'], ['IVA'],
    ]);
    return parseNum(v);
  };

  const getGrandTotal = () => {
    const v = extractByPaths(summary, [
      ['grandTotal'], ['GrandTotal'], ['total'], ['Total'], ['totalFinal'], ['TotalFinal'],
    ]);
    return parseNum(v);
  };

  const companyName = getCompanyName();
  const taxId = getCompanyTaxId();
  const address = getCompanyAddress();
  const receiptNumber = getReceiptNumber();
  const date = getDate();
  const currency = getCurrency();
  const subTotal = getSubtotal();
  const taxAmount = getTax();
  const grandTotal = getGrandTotal();

  const supplierName = extractByPaths(supplier, [
    ['name'], ['Name'], ['nombre'], ['Nombre'], ['nom'], ['Nom'],
  ]) || companyName;

  const supplierTaxId = extractByPaths(supplier, [
    ['taxId'], ['TaxId'], ['cedula'], ['Cedula'],
    ['numeroFiscal'], ['NumeroFiscal'], ['registrationNumber'],
  ]) || taxId;

  const lines = itemsArr.map((item: any) => {
    const desc = extractByPaths(item, [
      ['description'], ['Description'], ['descripcion'], ['Descripcion'],
      ['detalle'], ['Detalle'], ['name'], ['Name'],
      ['produit'], ['Produit'],
    ]) || 'Producto';

    const qty = extractByPaths(item, [
      ['quantity'], ['Quantity'], ['cantidad'], ['Cantidad'],
      ['quantite'], ['Quantite'],
    ]);
    const unitPrice = extractByPaths(item, [
      ['unitPrice'], ['UnitPrice'], ['precioUnitario'], ['PrecioUnitario'],
      ['prixUnitaire'], ['PrixUnitaire'],
    ]);
    const total = extractByPaths(item, [
      ['total'], ['Total'], ['monto'], ['Monto'],
      ['montant'], ['Montant'], ['amount'], ['Amount'],
    ]);

    return {
      descripcion: String(desc) || null,
      cantidad: parseNum(qty),
      precioUnitario: parseNum(unitPrice),
      total: parseNum(total),
      codigo: null,
    };
  });

  const calculatedSubtotal = subTotal ?? lines.reduce((s, l) => s + (l.total ?? (l.cantidad && l.precioUnitario ? l.cantidad * l.precioUnitario : 0)), 0);
  const calculatedTax = taxAmount ?? 0;
  const calculatedTotal = grandTotal ?? (calculatedSubtotal + calculatedTax);

  advertencias.push('Documento XML de proveedor internacional — formato no fiscal estandarizado');

  return {
    meta: {
      tipo_documento: 'supplier_invoice' as DocumentType,
      version_formato: null,
      confianza_extraccion: 'alta',
      idioma_original: null,
      moneda_original: currency,
      advertencias,
    },
    identificacion: {
      numero_documento: receiptNumber,
      clave_numerica_50: null,
      uuid_cfdi: null,
      fecha_emision: date,
      fecha_vencimiento: null,
      condicion_venta: null,
      dias_credito: null,
      medio_pago: null,
      numero_orden_compra: null,
      moneda_original: currency,
    },
    emisor: {
      nombre: supplierName,
      nombre_comercial: null,
      tipo_identificacion: 'EIN_usa' as TipoIdentificacion,
      numero_identificacion: supplierTaxId,
      pais: 'US',
      direccion_completa: address,
      telefono: null,
      correo: null,
      codigo_actividad_ciiu: null,
    },
    lineas: lines,
    totales: {
      subtotal_sin_impuestos: calculatedSubtotal,
      total_descuentos: null,
      total_impuestos: calculatedTax,
      total_iva: calculatedTax,
      total_otros_impuestos: null,
      total_documento: calculatedTotal,
      tipo_cambio_a_crc: null,
      total_documento_crc: null,
    },
  };
}

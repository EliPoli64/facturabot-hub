import { DocumentType } from '@/lib/types';

export interface DocumentTypeInfo {
  tipo: DocumentType;
  descripcion: string;
  requiereXml: boolean;
  requiereReceptor: boolean;
}

export const VALID_DOCUMENT_TYPES: Record<DocumentType, DocumentTypeInfo> = {
  factura_electronica_cr_v44: {
    tipo: 'factura_electronica_cr_v44',
    descripcion: 'Factura Electrónica Costa Rica v4.4 (obligatoria sep 2025)',
    requiereXml: true,
    requiereReceptor: true,
  },
  factura_electronica_cr_v43: {
    tipo: 'factura_electronica_cr_v43',
    descripcion: 'Factura Electrónica Costa Rica v4.3 (legado)',
    requiereXml: true,
    requiereReceptor: true,
  },
  factura_compra_electronica_cr: {
    tipo: 'factura_compra_electronica_cr',
    descripcion: 'Factura de Compra Electrónica CR (auto-factura servicios exterior)',
    requiereXml: true,
    requiereReceptor: false,
  },
  tiquete_electronico_cr: {
    tipo: 'tiquete_electronico_cr',
    descripcion: 'Tiquete Electrónico CR (consumidor final, sin receptor)',
    requiereXml: true,
    requiereReceptor: false,
  },
  cfdi_40_mexico: {
    tipo: 'cfdi_40_mexico',
    descripcion: 'CFDI 4.0 México (Comprobante Fiscal Digital)',
    requiereXml: true,
    requiereReceptor: true,
  },
  commercial_invoice: {
    tipo: 'commercial_invoice',
    descripcion: 'Commercial Invoice internacional (proveedores EE.UU./Asia)',
    requiereXml: false,
    requiereReceptor: true,
  },
  proforma_invoice: {
    tipo: 'proforma_invoice',
    descripcion: 'Proforma Invoice (pre-venta, no válida para aduanas)',
    requiereXml: false,
    requiereReceptor: true,
  },
  supplier_invoice: {
    tipo: 'supplier_invoice',
    descripcion: 'Supplier Invoice genérica (europea/asiática)',
    requiereXml: false,
    requiereReceptor: true,
  },
  poliza_aduanal: {
    tipo: 'poliza_aduanal',
    descripcion: 'Póliza aduanal / DUA (documento agente de aduanas CR)',
    requiereXml: false,
    requiereReceptor: false,
  },
  airway_bill: {
    tipo: 'airway_bill',
    descripcion: 'Airway Bill / Bill of Lading con cargos de flete internacional',
    requiereXml: false,
    requiereReceptor: false,
  },
  foreign_service_receipt: {
    tipo: 'foreign_service_receipt',
    descripcion: 'Recibo de servicio extranjero sin formato fiscal (Stripe, AWS, Shopify)',
    requiereXml: false,
    requiereReceptor: false,
  },
  unknown: {
    tipo: 'unknown',
    descripcion: 'Tipo de documento no identificado',
    requiereXml: false,
    requiereReceptor: false,
  },
};

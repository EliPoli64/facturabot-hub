export type DocumentType =
  | 'factura_electronica_cr_v44'
  | 'factura_electronica_cr_v43'
  | 'factura_compra_electronica_cr'
  | 'tiquete_electronico_cr'
  | 'cfdi_40_mexico'
  | 'commercial_invoice'
  | 'proforma_invoice'
  | 'supplier_invoice'
  | 'poliza_aduanal'
  | 'airway_bill'
  | 'foreign_service_receipt'
  | 'unknown';

export type ConfidenceLevel = 'alta' | 'media' | 'baja';

export type CondicionVenta = 'contado' | 'credito' | 'otro';

export type TipoIdentificacion =
  | 'cedula_fisica'
  | 'cedula_juridica'
  | 'NITE'
  | 'DIMEX'
  | 'extranjero_no_domiciliado'
  | 'RFC_mexico'
  | 'EIN_usa'
  | 'otro';

export type TipoCompra =
  | 'mercaderia'
  | 'materia_prima'
  | 'activo_fijo'
  | 'servicio_profesional'
  | 'servicio_recurrente'
  | 'gasto_operativo'
  | 'flete_importacion'
  | 'arancel_impuesto_importacion'
  | 'otro';

export type ImpuestoTipo = 'IVA' | 'ISC' | 'IVA_importacion' | 'DAI' | 'exento' | 'otro';

export type Deducibilidad = 'deducible_sin_limite' | 'deducible_con_limite' | 'no_deducible';

export interface Meta {
  tipo_documento: DocumentType;
  version_formato: string | null;
  confianza_extraccion: ConfidenceLevel;
  idioma_original: string | null;
  moneda_original: string | null;
  advertencias: string[];
}

export interface IdentificacionParte {
  nombre: string | null;
  nombre_comercial: string | null;
  tipo_identificacion: TipoIdentificacion | null;
  numero_identificacion: string | null;
  pais: string | null;
  direccion_completa: string | null;
  telefono: string | null;
  correo: string | null;
  codigo_actividad_ciiu: string | null;
}

export interface DocumentoIdentificacion {
  numero_documento: string | null;
  clave_numerica_50: string | null;
  uuid_cfdi: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  condicion_venta: CondicionVenta | null;
  dias_credito: number | null;
  medio_pago: string | null;
  numero_orden_compra: string | null;
  moneda_original: string | null;
}

export interface LineaDetalleOutput {
  numero_linea: number | null;
  codigo_producto: string | null;
  codigo_cabys: string | null;
  codigo_hs: string | null;
  descripcion: string | null;
  cantidad: number | null;
  unidad_medida: string | null;
  precio_unitario: number | null;
  descuento_monto: number | null;
  descuento_porcentaje: number | null;
  subtotal_linea: number | null;
  impuesto_tipo: ImpuestoTipo | null;
  impuesto_tarifa_porcentaje: number | null;
  impuesto_monto: number | null;
  total_linea: number | null;
  clasificacion_tipo_compra: TipoCompra;
  cuenta_contable_sugerida: string;
  nombre_cuenta_sugerida: string;
  deducible_hacienda: Deducibilidad;
  razon_deducibilidad: string;
  aplica_retencion: boolean;
  porcentaje_retencion: number | null;
}

export interface TotalesOutput {
  subtotal_sin_impuestos: number | null;
  total_descuentos: number | null;
  total_impuestos: number | null;
  total_iva: number | null;
  total_otros_impuestos: number | null;
  total_documento: number | null;
  tipo_cambio_a_crc: number | null;
  total_documento_crc: number | null;
}

export interface ImportacionOutput {
  es_documento_importacion: boolean;
  numero_poliza_aduanal: string | null;
  numero_declaracion_aduanera: string | null;
  aduana_ingreso: string | null;
  fecha_despacho_aduanal: string | null;
  pais_origen_mercancias: string | null;
  incoterm: string | null;
  valor_fob: number | null;
  seguro: number | null;
  flete_internacional: number | null;
  valor_cif: number | null;
  dai_porcentaje: number | null;
  dai_monto: number | null;
  iva_importacion_porcentaje: number | null;
  iva_importacion_monto: number | null;
  otros_cargos_aduanales: number | null;
  costo_total_importacion: number | null;
  cantidad_total_importada: number | null;
  costo_unitario_bodega: number | null;
}

export interface AsientoLinea {
  cuenta: string;
  nombre_cuenta: string;
  monto: number;
  nota: string;
}

export interface AsientoContableSugerido {
  descripcion: string;
  fecha: string | null;
  referencia: string | null;
  debitos: AsientoLinea[];
  creditos: AsientoLinea[];
  cuadra: boolean;
}

export interface ClasificacionFiscalOutput {
  total_deducible_hacienda: number;
  total_no_deducible: number;
  total_costo_inventario: number;
  requiere_retencion: boolean;
  monto_retencion_total: number;
  flags: string[];
}

export interface DocumentoProcesado {
  meta: Meta;
  identificacion: DocumentoIdentificacion;
  emisor: IdentificacionParte;
  receptor: IdentificacionParte;
  lineas_detalle: LineaDetalleOutput[];
  totales: TotalesOutput;
  importacion: ImportacionOutput;
  asiento_contable_sugerido: AsientoContableSugerido;
  clasificacion_fiscal: ClasificacionFiscalOutput;
}

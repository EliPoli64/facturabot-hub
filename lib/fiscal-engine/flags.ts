export type FlagCode =
  | 'ERROR_FLETE_COMO_GASTO'
  | 'RETENCION_PENDIENTE'
  | 'AUTOFACTURA_REQUERIDA'
  | 'IVA_SERVICIOS_DIGITALES'
  | 'GASTO_NO_DEDUCIBLE_DETECTADO'
  | 'LIMITE_PUBLICIDAD_RIESGO'
  | 'LIMITE_REPRESENTACION_RIESGO'
  | 'ACTIVO_FIJO_COMO_GASTO'
  | 'CABYS_FALTANTE'
  | 'CIIU_RECEPTOR_FALTANTE'
  | 'POLIZA_PENDIENTE'
  | 'TIPO_CAMBIO_REQUERIDO';

export interface FlagDef {
  code: FlagCode;
  severity: 'CRITICO' | 'IMPORTANTE' | 'INFORMATIVO';
  message: string;
  actionRequired: string;
}

export const FLAG_DEFINITIONS: Record<FlagCode, FlagDef> = {
  ERROR_FLETE_COMO_GASTO: {
    code: 'ERROR_FLETE_COMO_GASTO',
    severity: 'CRITICO',
    message: 'Flete internacional registrado como gasto en lugar de inventario',
    actionRequired: ' reclasificar el monto del flete a la cuenta 1-1100 Inventario de mercancías. NUNCA debe registrarse como gasto del período.',
  },
  RETENCION_PENDIENTE: {
    code: 'RETENCION_PENDIENTE',
    severity: 'CRITICO',
    message: 'Retención en la fuente no aplicada',
    actionRequired: ' aplicar retención según corresponda (15% servicios profesionales a persona física, 15% arrendamiento, 2% flete nacional).',
  },
  AUTOFACTURA_REQUERIDA: {
    code: 'AUTOFACTURA_REQUERIDA',
    severity: 'CRITICO',
    message: 'Pago a proveedor extranjero no domiciliado',
    actionRequired: ' emitir Factura de Compra Electrónica CR (auto-factura) según normativa Hacienda v4.4. El receptor debe emitir el comprobante.',
  },
  IVA_SERVICIOS_DIGITALES: {
    code: 'IVA_SERVICIOS_DIGITALES',
    severity: 'IMPORTANTE',
    message: 'Servicio digital del exterior detectado',
    actionRequired: ' calcular y declarar IVA de importación de servicios (monto × 13%). Este IVA NO genera crédito fiscal automático.',
  },
  GASTO_NO_DEDUCIBLE_DETECTADO: {
    code: 'GASTO_NO_DEDUCIBLE_DETECTADO',
    severity: 'IMPORTANTE',
    message: 'Gasto con patrón de gasto personal detectado',
    actionRequired: ' revisar si el gasto corresponde efectivamente a la actividad del negocio. Gastos personales no son deducibles según Ley 7092.',
  },
  LIMITE_PUBLICIDAD_RIESGO: {
    code: 'LIMITE_PUBLICIDAD_RIESGO',
    severity: 'IMPORTANTE',
    message: 'Gastos de publicidad podrían exceder límite deducible',
    actionRequired: ' el límite deducible para publicidad es 1% de ingresos brutos del período. Verificar acumulado.',
  },
  LIMITE_REPRESENTACION_RIESGO: {
    code: 'LIMITE_REPRESENTACION_RIESGO',
    severity: 'IMPORTANTE',
    message: 'Gastos de representación podrían exceder límite deducible',
    actionRequired: ' el límite deducible para gastos de representación es 1% de ingresos brutos del período. Verificar acumulado.',
  },
  ACTIVO_FIJO_COMO_GASTO: {
    code: 'ACTIVO_FIJO_COMO_GASTO',
    severity: 'CRITICO',
    message: 'Bien con valor superior a ₡100,000 registrado como gasto en lugar de activo fijo',
    actionRequired: ' registrar como activo fijo (cuenta 1-2100) y deducir vía depreciación anual. No es gasto directo del período.',
  },
  CABYS_FALTANTE: {
    code: 'CABYS_FALTANTE',
    severity: 'IMPORTANTE',
    message: 'Factura electrónica CR sin código CABYS en alguna línea',
    actionRequired: ' el código CABYS es obligatorio en facturación electrónica CR v4.4. Solicitar factura corregida al emisor.',
  },
  CIIU_RECEPTOR_FALTANTE: {
    code: 'CIIU_RECEPTOR_FALTANTE',
    severity: 'INFORMATIVO',
    message: 'Factura CR v4.4 sin código de actividad económica del receptor',
    actionRequired: ' el código CIIU del receptor es obligatorio en v4.4. Verificar con el emisor.',
  },
  POLIZA_PENDIENTE: {
    code: 'POLIZA_PENDIENTE',
    severity: 'IMPORTANTE',
    message: 'Commercial Invoice de importación sin póliza aduanal adjunta',
    actionRequired: ' para completar el costeo CIF de importación se requiere la póliza aduanal (DUA). Los montos de DAI e IVA importación están pendientes.',
  },
  TIPO_CAMBIO_REQUERIDO: {
    code: 'TIPO_CAMBIO_REQUERIDO',
    severity: 'IMPORTANTE',
    message: 'Documento en moneda extranjera sin tipo de cambio',
    actionRequired: ' obtener tipo de cambio del BCCR para la fecha de emisión del documento. El sistema no debe inventar tipos de cambio.',
  },
};

export function getFlagInfo(code: FlagCode): FlagDef {
  return FLAG_DEFINITIONS[code];
}

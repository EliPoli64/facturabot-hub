export interface RetentionRule {
  description: string;
  percentage: number;
  condition: string;
  applies: (params: RetentionParams) => boolean;
}

export interface RetentionParams {
  tipoCompra: string;
  emisorEsPersonaFisica: boolean;
  emisorEsDomiciliado: boolean;
  emisorTipoIdentificacion: string;
  esServicioDigitalExtranjero: boolean;
  paisEmisor: string | null;
}

const RETENTION_RULES: RetentionRule[] = [
  {
    description: 'Servicios profesionales a personas físicas',
    percentage: 15,
    condition: 'Servicios profesionales contratados a persona física costarricense',
    applies: (p) =>
      p.tipoCompra === 'servicio_profesional' &&
      p.emisorEsPersonaFisica &&
      p.emisorEsDomiciliado &&
      p.paisEmisor === 'CR',
  },
  {
    description: 'Arrendamiento de bienes inmuebles a persona física',
    percentage: 15,
    condition: 'Arrendamiento pagado a persona física',
    applies: (p) =>
      (p.tipoCompra === 'servicio_recurrente' || p.tipoCompra === 'gasto_operativo') &&
      p.emisorEsPersonaFisica &&
      p.emisorEsDomiciliado,
  },
  {
    description: 'Flete nacional a personas físicas (transportistas)',
    percentage: 2,
    condition: 'Servicio de flete nacional prestado por persona física',
    applies: (p) =>
      p.tipoCompra === 'gasto_operativo' &&
      p.emisorEsPersonaFisica &&
      p.emisorEsDomiciliado,
  },
  {
    description: 'Pagos a proveedores extranjeros no domiciliados por servicios',
    percentage: 15,
    condition: 'Servicios de proveedor extranjero no domiciliado en CR',
    applies: (p) =>
      !p.emisorEsDomiciliado &&
      p.paisEmisor !== 'CR' &&
      !p.emisorEsPersonaFisica,
  },
  {
    description: 'Servicios digitales del exterior — IVA de importación',
    percentage: 13,
    condition: 'IVA de importación de servicios digitales (no es retención en la fuente)',
    applies: (p) =>
      p.esServicioDigitalExtranjero && p.paisEmisor !== 'CR',
  },
];

export function findRetentions(params: RetentionParams): { aplica: boolean; rules: { description: string; percentage: number }[] } {
  const applicable = RETENTION_RULES
    .filter((r) => r.applies(params))
    .map((r) => ({ description: r.description, percentage: r.percentage }));

  return {
    aplica: applicable.length > 0,
    rules: applicable,
  };
}

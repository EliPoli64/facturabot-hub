import { TipoCompra, Deducibilidad } from '@/lib/types';

interface DeductionRule {
  tipo: TipoCompra;
  deducibilidad: Deducibilidad;
  accountCode: string;
  razon: string;
  keywords?: string[];
}

export const DEDUCTION_RULES: DeductionRule[] = [
  {
    tipo: 'mercaderia',
    deducibilidad: 'deducible_sin_limite',
    accountCode: '1-1100',
    razon: 'Costo de ventas: mercadería comprada para reventa — deducible como costo de ventas',
    keywords: ['mercadería', 'mercaderia', 'producto', 'artículo', 'articulo', 'reventa', 'inventario'],
  },
  {
    tipo: 'materia_prima',
    deducibilidad: 'deducible_sin_limite',
    accountCode: '1-1200',
    razon: 'Materia prima para producción — costo de inventario de producción',
    keywords: ['materia prima', 'insumo', 'material', 'componente', 'materia prima'],
  },
  {
    tipo: 'activo_fijo',
    deducibilidad: 'no_deducible',
    accountCode: '1-2100',
    razon: 'Activo fijo — NO es gasto deducible directo; se deduce vía depreciación anual',
    keywords: ['equipo', 'máquina', 'maquina', 'computadora', 'mobiliario', 'vehículo', 'vehiculo', 'camión', 'camion', 'herramienta'],
  },
  {
    tipo: 'servicio_profesional',
    deducibilidad: 'deducible_sin_limite',
    accountCode: '5-1200',
    razon: 'Servicios profesionales con factura electrónica — deducible. Aplica retención 15% si persona física',
    keywords: ['honorario', 'consultoría', 'consultoria', 'asesoría', 'asesoria', 'servicio profesional', 'abogado', 'contador', 'arquitecto', 'ingeniero'],
  },
  {
    tipo: 'servicio_recurrente',
    deducibilidad: 'deducible_sin_limite',
    accountCode: '5-1700',
    razon: 'Servicio recurrente del negocio — deducible',
    keywords: ['suscripción', 'suscripcion', 'alquiler', 'arrendamiento', 'internet', 'telefonía', 'telefonia', 'electricidad', 'agua', 'servicio básico'],
  },
  {
    tipo: 'gasto_operativo',
    deducibilidad: 'deducible_sin_limite',
    accountCode: '5-1900',
    razon: 'Gasto operativo general — deducible si es necesario para la operación',
    keywords: ['papelería', 'papeleria', 'limpieza', 'oficina', 'misceláneo', 'miscelaneo', 'suministro'],
  },
  {
    tipo: 'flete_importacion',
    deducibilidad: 'no_deducible',
    accountCode: '1-1100',
    razon: 'Flete internacional — NO es gasto deducible. Se capitaliza como parte del COSTO del inventario. Cuenta 1-1100 Inventario de mercancías.',
    keywords: [],
  },
  {
    tipo: 'arancel_impuesto_importacion',
    deducibilidad: 'no_deducible',
    accountCode: '1-1100',
    razon: 'Arancel/impuesto de importación — NO es gasto deducible. Se capitaliza como parte del COSTO del inventario. Cuenta 1-1100.',
    keywords: [],
  },
  {
    tipo: 'otro',
    deducibilidad: 'deducible_sin_limite',
    accountCode: '5-1900',
    razon: 'Otro gasto — evaluar deducibilidad según naturaleza específica del gasto',
    keywords: [],
  },
];

const PUBLICIDAD_KEYWORDS = ['publicidad', 'anuncio', 'marketing', 'mercadeo', 'promoción', 'promocion', 'anuncio', 'ads', 'social media'];
const REPRESENTACION_KEYWORDS = ['representación', 'representacion', 'comida', 'cena', 'restaurante', 'cliente', 'atención', 'atencion', 'agasajo'];
const GASTO_PERSONAL_KEYWORDS = ['supermercado', 'farmácia', 'farmacia', 'personal', 'hogar', 'casa', 'familia'];

export interface ClassificationResult {
  tipo_compra: TipoCompra;
  deducibilidad: Deducibilidad;
  accountCode: string;
  razon: string;
  flags: string[];
}

export function classifyLine(
  descripcion: string | null,
  precio_unitario: number | null,
  cantidad: number | null,
  documentOriginIsInternational: boolean,
): ClassificationResult {
  const desc = (descripcion || '').toLowerCase();
  const unitPrice = precio_unitario || 0;
  const flags: string[] = [];
  let matched: DeductionRule | null = null;

  for (const rule of DEDUCTION_RULES) {
    if (rule.keywords && rule.keywords.length > 0) {
      if (rule.keywords.some((kw) => desc.includes(kw))) {
        matched = rule;
        break;
      }
    }
  }

  if (documentOriginIsInternational && !matched) {
    matched = DEDUCTION_RULES.find((r) => r.tipo === 'mercaderia')!;
  }

  if (!matched) {
    matched = DEDUCTION_RULES.find((r) => r.tipo === 'gasto_operativo')!;
  }

  let tipo_compra: TipoCompra = matched.tipo;
  let deducibilidad: Deducibilidad = matched.deducibilidad;
  let accountCode = matched.accountCode;
  let razon = matched.razon;

  if (PUBLICIDAD_KEYWORDS.some((kw) => desc.includes(kw))) {
    tipo_compra = 'gasto_operativo';
    deducibilidad = 'deducible_con_limite';
    accountCode = '5-1500';
    razon = 'Publicidad y propaganda: deducible con límite de 1% de ingresos brutos del período';
  }

  if (REPRESENTACION_KEYWORDS.some((kw) => desc.includes(kw))) {
    tipo_compra = 'gasto_operativo';
    deducibilidad = 'deducible_con_limite';
    accountCode = '5-1600';
    razon = 'Gastos de representación: deducible con límite de 1% de ingresos brutos del período';
  }

  if (GASTO_PERSONAL_KEYWORDS.some((kw) => desc.includes(kw))) {
    tipo_compra = 'gasto_operativo';
    deducibilidad = 'no_deducible';
    accountCode = '5-1999';
    razon = 'Patrón de gasto personal detectado — no deducible según Ley 7092';
    flags.push('GASTO_NO_DEDUCIBLE_DETECTADO');
  }

  if (unitPrice >= 100000 && tipo_compra !== 'activo_fijo' && (desc.includes('equipo') || desc.includes('comput') || desc.includes('maquina') || desc.includes('maqina'))) {
    flags.push('ACTIVO_FIJO_COMO_GASTO');
  }

  return { tipo_compra, deducibilidad, accountCode, razon, flags };
}

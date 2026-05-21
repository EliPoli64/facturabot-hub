import { ImportacionOutput } from '@/lib/types';

export interface ImportCostingInput {
  valor_fob: number | null;
  seguro: number | null;
  flete_internacional: number | null;
  dai_porcentaje: number | null;
  otros_cargos_aduanales: number | null;
  cantidad_total_importada: number | null;
  pais_origen: string | null;
  incoterm: string | null;
  numero_poliza: string | null;
  numero_dua: string | null;
  aduana: string | null;
  fecha_despacho: string | null;
  es_contribuyente_iva: boolean;
}

const IVA_IMPORTACION_PORCENTAJE = 0.13;

export function calculateImportCost(input: ImportCostingInput): ImportacionOutput {
  const fob = input.valor_fob ?? 0;
  const seguro = input.seguro ?? 0;
  const flete = input.flete_internacional ?? 0;
  const cif = fob + seguro + flete;

  const daiPorcentaje = input.dai_porcentaje ?? 0;
  const daiMonto = cif * (daiPorcentaje / 100);

  const baseIva = cif + daiMonto;
  const ivaImportacionMonto = baseIva * IVA_IMPORTACION_PORCENTAJE;

  const otros = input.otros_cargos_aduanales ?? 0;

  const costoTotal = cif + daiMonto + ivaImportacionMonto + otros;

  const cantidad = input.cantidad_total_importada ?? 0;
  const costoUnitario = cantidad > 0 ? costoTotal / cantidad : 0;

  return {
    es_documento_importacion: input.valor_fob !== null || cif > 0,
    numero_poliza_aduanal: input.numero_poliza ?? null,
    numero_declaracion_aduanera: input.numero_dua ?? null,
    aduana_ingreso: input.aduana ?? null,
    fecha_despacho_aduanal: input.fecha_despacho ?? null,
    pais_origen_mercancias: input.pais_origen ?? null,
    incoterm: input.incoterm ?? null,
    valor_fob: input.valor_fob ?? null,
    seguro: input.seguro ?? null,
    flete_internacional: input.flete_internacional ?? null,
    valor_cif: cif > 0 ? cif : null,
    dai_porcentaje: input.dai_porcentaje ?? null,
    dai_monto: daiMonto > 0 ? Math.round(daiMonto) : null,
    iva_importacion_porcentaje: IVA_IMPORTACION_PORCENTAJE,
    iva_importacion_monto: ivaImportacionMonto > 0 ? Math.round(ivaImportacionMonto) : null,
    otros_cargos_aduanales: input.otros_cargos_aduanales ?? null,
    costo_total_importacion: costoTotal > 0 ? Math.round(costoTotal) : null,
    cantidad_total_importada: input.cantidad_total_importada ?? null,
    costo_unitario_bodega: costoUnitario > 0 ? Math.round(costoUnitario * 100) / 100 : null,
  };
}

export function isCompleteImport(input: ImportCostingInput): boolean {
  return (
    input.valor_fob !== null &&
    input.valor_fob > 0 &&
    input.numero_poliza !== null &&
    input.flete_internacional !== null
  );
}

export function getMissingImportFields(input: ImportCostingInput): string[] {
  const missing: string[] = [];
  if (!input.valor_fob || input.valor_fob <= 0) missing.push('valor_fob');
  if (!input.numero_poliza) missing.push('numero_poliza_aduanal');
  if (!input.flete_internacional) missing.push('flete_internacional');
  return missing;
}

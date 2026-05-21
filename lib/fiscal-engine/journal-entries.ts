import { AsientoContableSugerido, AsientoLinea } from '@/lib/types';
import { ImportacionOutput } from '@/lib/types';
import { getAccount } from '@/lib/fiscal-engine/rules/costa-rica/accounts';

export interface JournalEntryInput {
  fecha: string | null;
  referencia: string | null;
  tipoCompra: string;
  esNacional: boolean;
  esCredito: boolean;
  subtotal: number | null;
  totalIva: number | null;
  totalDocumento: number | null;
  importacion?: ImportacionOutput;
  aplicaRetencion: boolean;
  montoRetencion: number;
  montoBruto: number;
}

function makeLine(cuenta: string, monto: number, nota: string): AsientoLinea {
  const account = getAccount(cuenta);
  return { cuenta: account.code, nombre_cuenta: account.name, monto, nota };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function generateJournalEntry(input: JournalEntryInput): AsientoContableSugerido {
  const debitos: AsientoLinea[] = [];
  const creditos: AsientoLinea[] = [];

  const sub = input.subtotal ?? 0;
  const iva = input.totalIva ?? 0;
  const total = input.totalDocumento ?? (sub + iva);

  if (input.importacion?.es_documento_importacion && input.tipoCompra === 'mercaderia') {
    const cif = input.importacion.valor_cif ?? 0;
    const dai = input.importacion.dai_monto ?? 0;
    const ivaImportacion = input.importacion.iva_importacion_monto ?? 0;
    const otros = input.importacion.otros_cargos_aduanales ?? 0;
    const fob = input.importacion.valor_fob ?? 0;

    const costoInventario = round2(cif + dai + otros);
    const proveedorExtranjero = round2(fob);

    debitos.push(makeLine('1-1100', costoInventario, `CIF (${cif}) + DAI (${dai}) + otros (${otros})`));

    if (ivaImportacion > 0) {
      debitos.push(makeLine('1-1300', round2(ivaImportacion), 'IVA de importación — crédito fiscal'));
    }

    creditos.push(makeLine('2-1200', proveedorExtranjero, 'Valor factura proveedor extranjero (FOB)'));

    if (sub > proveedorExtranjero) {
      const cargosLocales = round2(sub - proveedorExtranjero);
      creditos.push(makeLine('2-1100', cargosLocales, 'Cargos locales del agente aduanal'));
    }

    if (otros > 0 && sub <= proveedorExtranjero) {
      creditos.push(makeLine('2-1100', round2(otros), 'Cargos locales del agente aduanal'));
    }
  } else if (input.tipoCompra === 'servicio_profesional' && input.aplicaRetencion) {
    const bruto = input.montoBruto || sub;
    const retencion = input.montoRetencion;

    debitos.push(makeLine('5-1200', round2(bruto), 'Gasto por servicios profesionales (monto bruto)'));

    if (iva > 0) {
      debitos.push(makeLine('1-1300', round2(iva), 'IVA crédito fiscal'));
    }

    creditos.push(makeLine('2-2100', round2(retencion), `Retención ${((retencion / bruto) * 100).toFixed(0)}% en la fuente`));
    creditos.push(makeLine('2-1100', round2(total - retencion), `Neto a pagar (total ₡${total} - retención ₡${retencion})`));
  } else if (input.tipoCompra === 'mercaderia' || input.tipoCompra === 'materia_prima') {
    debitos.push(makeLine('1-1100', round2(sub), 'Inventario de mercancías (subtotal)'));

    if (iva > 0) {
      debitos.push(makeLine('1-1300', round2(iva), 'IVA crédito fiscal'));
    }

    if (input.esCredito) {
      creditos.push(makeLine('2-1200', round2(total), 'Proveedores (total a pagar a crédito)'));
    } else {
      creditos.push(makeLine('2-1100', round2(total), 'Cuentas por pagar (total)'));
    }
  } else {
    // Gasto operativo general
    const accountMap: Record<string, string> = {
      servicio_profesional: '5-1200',
      servicio_recurrente: '5-1700',
      gasto_operativo: '5-1900',
    };
    const accountCode = accountMap[input.tipoCompra] || '5-1900';

    debitos.push(makeLine(accountCode, round2(sub), `Gasto por ${input.tipoCompra} (subtotal)`));

    if (iva > 0) {
      debitos.push(makeLine('1-1300', round2(iva), 'IVA crédito fiscal'));
    }

    creditos.push(makeLine('2-1100', round2(total), 'Cuentas por pagar (total)'));
  }

  const totalDebitos = round2(debitos.reduce((s, l) => s + l.monto, 0));
  const totalCreditos = round2(creditos.reduce((s, l) => s + l.monto, 0));

  return {
    descripcion: `Asiento sugerido para compra tipo: ${input.tipoCompra}`,
    fecha: input.fecha,
    referencia: input.referencia,
    debitos,
    creditos,
    cuadra: Math.abs(totalDebitos - totalCreditos) < 1,
  };
}

export interface AccountDef {
  code: string;
  name: string;
}

export const ACCOUNTS: Record<string, AccountDef> = {
  '1-1100': { code: '1-1100', name: 'Inventario de mercancías' },
  '1-1200': { code: '1-1200', name: 'Inventario de materia prima' },
  '1-1300': { code: '1-1300', name: 'IVA crédito fiscal' },
  '1-2100': { code: '1-2100', name: 'Activo fijo tangible' },
  '2-1100': { code: '2-1100', name: 'Cuentas por pagar' },
  '2-1200': { code: '2-1200', name: 'Proveedores' },
  '2-2100': { code: '2-2100', name: 'Retenciones por pagar' },
  '2-2200': { code: '2-2200', name: 'IVA por pagar' },
  '5-1100': { code: '5-1100', name: 'Costo de ventas' },
  '5-1200': { code: '5-1200', name: 'Gasto servicios profesionales y honorarios' },
  '5-1300': { code: '5-1300', name: 'Gasto arrendamiento' },
  '5-1400': { code: '5-1400', name: 'Gasto transporte y flete nacional' },
  '5-1500': { code: '5-1500', name: 'Gasto publicidad y mercadeo' },
  '5-1600': { code: '5-1600', name: 'Gasto representación y atenciones' },
  '5-1700': { code: '5-1700', name: 'Gasto servicios básicos' },
  '5-1800': { code: '5-1800', name: 'Gasto salarios y cargas sociales' },
  '5-1900': { code: '5-1900', name: 'Otros gastos operativos' },
  '5-1999': { code: '5-1999', name: 'Gastos no deducibles' },
};

export function getAccount(code: string): AccountDef {
  return ACCOUNTS[code] ?? { code, name: `Cuenta ${code}` };
}

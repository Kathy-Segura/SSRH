import { describe, expect, it } from 'vitest';
import type { PayrollInputs } from '@/lib/payroll-calculations';

const base: PayrollInputs = {
  salarioMensual: 12000, diasLaborados: 15, diasVacaciones: 0, horasExtra: 0,
  otrosIngresos: 0, consumo: 500, prestamo: 0, greceComida: 0, otros: 0,
};

describe('2.7 historial de deducciones: cada dato cae en su columna', async () => {
  const { __testing } = await import('@/lib/googleSheets');
  const item = { cedula: '0010203002086', nombre: 'Prueba', version: 'v', inputs: base };
  const row = __testing.buildHistorialRow('2026-10-09T10:00:00.000Z', '2026-10-first', item, { campo: 'consumo', anterior: 0, nuevo: 500 });
  const raw = (row.values ?? []).map((c) => c.userEnteredValue?.numberValue ?? c.userEnteredValue?.stringValue ?? '');
  const at = (column: string) => raw[(__testing.HISTORIAL_COLUMNS as readonly string[]).indexOf(column)];

  it('la fila tiene exactamente una celda por encabezado', () => {
    expect(raw).toHaveLength(__testing.HISTORIAL_COLUMNS.length);
  });
  it('el encabezado conserva el orden pedido', () => {
    expect(__testing.HISTORIAL_COLUMNS.slice(0, 10)).toEqual([
      'FECHA', 'QUINCENA', 'CEDULA', 'NOMBRE', 'SALARIO MENSUAL', 'CONCEPTO DEDUCCION',
      'DEDUCCIONES TOTALES', 'NETO A PAGAR', 'deduccionesTotales', 'netoPagar',
    ]);
  });
  it('cédula como texto, salario como número y concepto legible', () => {
    expect(at('CEDULA')).toBe('0010203002086');
    expect(at('SALARIO MENSUAL')).toBe(12000);
    expect(at('CONCEPTO DEDUCCION')).toBe('Consumo: C$ 0.00 → C$ 500.00');
  });
  it('totales y sus copias numéricas coinciden', () => {
    expect(at('DEDUCCIONES TOTALES')).toBe(at('deduccionesTotales'));
    expect(at('NETO A PAGAR')).toBe(at('netoPagar'));
  });
  it('ida y vuelta: lo que se escribe es lo que se lee', () => {
    const parsed = __testing.parseHistorialRow(raw);
    expect(parsed).toMatchObject({ periodo: '2026-10-first', cedula: '0010203002086', campo: 'consumo', valorAnterior: 0, valorNuevo: 500, salarioMensual: 12000 });
  });
  it('una fila con el orden anterior (campo en la columna E) se detecta y se lee bien', () => {
    const legacy = ['2026-09-01T00:00:00.000Z', '2026-09-first', '0010203002086', 'Prueba', 'prestamo', 0, 250, 12000, 670, 5330];
    expect(__testing.isLegacyHistorialRow(legacy)).toBe(true);
    expect(__testing.isLegacyHistorialRow(raw)).toBe(false);
    expect(__testing.parseHistorialRow(legacy)).toMatchObject({ campo: 'prestamo', valorNuevo: 250, salarioMensual: 12000, netoPagar: 5330 });
  });
});

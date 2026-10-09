import { describe, expect, it } from 'vitest';
import {
  calcularTotales, calcularINSSLaboral, getEmployeeDaysInPeriod, parseCalendarDate, PAYROLL_CONSTANTS, type PayrollInputs,
} from '@/lib/payroll-calculations'
import { coercePayrollInputs, computeInputDiffs, sameInputs, validatePayrollInputs } from '@/lib/payroll-validation';

const base: PayrollInputs = {
  salarioMensual: 12000, diasLaborados: 15, diasVacaciones: 0, horasExtra: 0,
  otrosIngresos: 0, consumo: 0, prestamo: 0, greceComida: 0, otros: 0,
};

describe('deducciones: INSS solo (IR excluido por defecto)', () => {
  it('quincena completa: devengado 6000, INSS 7% = 420, IR = 0, neto 5580', () => {
    const c = calcularTotales(base);
    expect(c.totalDevengado).toBe(6000);
    expect(c.inssLaboral).toBe(420);
    expect(c.irLaboral).toBe(0);
    expect(c.netoPagar).toBe(5580);
  });
  it('con aplicaIR=true el IR sí se calcula y baja el neto', () => {
    const sinIR = calcularTotales({ ...base, salarioMensual: 40000 });
    const conIR = calcularTotales({ ...base, salarioMensual: 40000, aplicaIR: true });
    expect(sinIR.irLaboral).toBe(0);
    expect(conIR.irLaboral).toBeGreaterThan(0);
    expect(conIR.netoPagar).toBeLessThan(sinIR.netoPagar);
  });
  it('otras deducciones se restan del neto', () => {
    const c = calcularTotales({ ...base, consumo: 100, prestamo: 200, greceComida: 50, otros: 25 });
    expect(c.otrasDeducciones).toBe(375);
    expect(c.netoPagar).toBe(5580 - 375);
  });
  it('INSS respeta el techo mensual', () => {
    const q = calcularINSSLaboral(100000);
    expect(q).toBe(Math.round((PAYROLL_CONSTANTS.inssCeilingMonthly / 2) * 0.07 * 100) / 100);
  });
});

describe('1.8 vacaciones pagadas', () => {
  it('permite 15 laborados + 15 vacaciones (antes se bloqueaba)', () => {
    expect(validatePayrollInputs({ ...base, diasVacaciones: 15 }, 15)).toEqual({});
  });
  it('permite pagar 30 días de vacaciones sin días laborados', () => {
    expect(validatePayrollInputs({ ...base, diasLaborados: 0, diasVacaciones: 30 }, 15)).toEqual({});
  });
  it('sigue bloqueando laborados > quincena y vacaciones > 30', () => {
    expect(validatePayrollInputs({ ...base, diasLaborados: 16 }, 15).diasLaborados).toBeDefined();
    expect(validatePayrollInputs({ ...base, diasVacaciones: 31 }, 15).diasVacaciones).toBeDefined();
  });
  it('las vacaciones suman al devengado', () => {
    expect(calcularTotales({ ...base, diasLaborados: 0, diasVacaciones: 30 }).totalDevengado).toBe(12000);
  });
});

describe('aplicaIR en validación y diffs', () => {
  it('coercePayrollInputs: ausente = false; no booleano = rechazo', () => {
    const { aplicaIR: _omit, ...sin } = base as PayrollInputs & { aplicaIR?: boolean };
    expect(coercePayrollInputs(sin)?.aplicaIR).toBe(false);
    expect(coercePayrollInputs({ ...sin, aplicaIR: true })?.aplicaIR).toBe(true);
    expect(coercePayrollInputs({ ...sin, aplicaIR: 'si' })).toBeNull();
  });
  it('sameInputs y computeInputDiffs detectan el cambio', () => {
    expect(sameInputs(base, { ...base, aplicaIR: false })).toBe(true);
    expect(sameInputs(base, { ...base, aplicaIR: true })).toBe(false);
    expect(computeInputDiffs(base, { ...base, aplicaIR: true })).toEqual([{ campo: 'aplicaIR', anterior: 0, nuevo: 1 }]);
  });
});

describe('días por fechas de ingreso/egreso', () => {
  const d = parseCalendarDate;
  it('Estrada (egreso 09/08/26) queda fuera en octubre 2026', () => {
    expect(getEmployeeDaysInPeriod(d('01/06/2026'), d('09/08/2026'), 2026, 10, 'first').status).toBe('outside');
  });
  it('Obregón (egreso 26/12/24) queda fuera en 2026', () => {
    expect(getEmployeeDaysInPeriod(d('01/12/2023'), d('26/12/2024'), 2026, 10, 'second').status).toBe('outside');
  });
  it('Obregón en la 2.ª quincena de dic 2024: 11 días (16..26)', () => {
    expect(getEmployeeDaysInPeriod(d('01/12/2023'), d('26/12/2024'), 2024, 12, 'second').days).toBe(11);
  });
  it('Estrada egresa el 09/08/26: 9 días en la 1.ª quincena de agosto', () => {
    const r = getEmployeeDaysInPeriod(d('01/06/2026'), d('09/08/2026'), 2026, 8, 'first');
    expect([r.status, r.days]).toEqual(['partial', 9]);
  });
  it('segunda quincena de meses de 31 días vale 15', () => {
    expect(getEmployeeDaysInPeriod(null, null, 2026, 10, 'second').days).toBe(15);
  });
});

describe('2.7 excluir INSS (pasantes / temporales)', () => {
  it('por defecto cotiza INSS', () => {
    expect(calcularTotales(base).inssLaboral).toBe(420);
  });
  it('excluirINSS=true: INSS 0, neto = devengado - otras deducciones', () => {
    const c = calcularTotales({ ...base, excluirINSS: true, consumo: 100 });
    expect(c.inssLaboral).toBe(0);
    expect(c.inssPatronal).toBe(0);
    expect(c.netoPagar).toBe(5900);
  });
  it('sin INSS y sin IR el neto es el devengado', () => {
    expect(calcularTotales({ ...base, excluirINSS: true }).netoPagar).toBe(6000);
  });
  it('coerce / sameInputs / diffs respetan excluirINSS', () => {
    expect(coercePayrollInputs({ ...base, excluirINSS: true })?.excluirINSS).toBe(true);
    expect(coercePayrollInputs({ ...base, excluirINSS: 1 })).toBeNull();
    expect(sameInputs(base, { ...base, excluirINSS: true })).toBe(false);
    expect(computeInputDiffs(base, { ...base, excluirINSS: true })).toEqual([{ campo: 'excluirINSS', anterior: 0, nuevo: 1 }]);
  });
});

describe('2.3 el guardado individual no pierde formato ni datos', async () => {
  const { __testing } = await import('@/lib/googleSheets'); ('@')
  const item = { cedula: '0010203002086', nombre: 'Prueba', version: 'v', inputs: { ...base, consumo: 150.5, aplicaIR: true, excluirINSS: true } };
  it('la cédula con ceros iniciales viaja como texto, nunca como número', () => {
    const cells = __testing.buildRowCells('2026-10-first', item, 'v');
    const idx = __testing.DEDUCCIONES_COLUMNS.indexOf('cedula');
    expect(cells[idx].userEnteredValue).toEqual({ stringValue: '0010203002086' });
  });
  it('las celdas solo llevan valor (sin userEnteredFormat que pise el formato de la hoja)', () => {
    const cells = __testing.buildRowCells('2026-10-first', item, 'v');
    expect(cells.every((c) => Object.keys(c).join() === 'userEnteredValue')).toBe(true);
  });
  it('ida y vuelta: lo que se escribe es lo que se lee (incluye IR e INSS)', () => {
    const cells = __testing.buildRowCells('2026-10-first', item, 'v');
    const raw = cells.map((c) => c.userEnteredValue?.numberValue ?? c.userEnteredValue?.stringValue ?? c.userEnteredValue?.formulaValue ?? '');
    const parsed = __testing.parseStoredRow(raw, 2);
    expect(parsed.problem).toBeNull();
    expect(parsed.inputs).toEqual(item.inputs);
    expect(parsed.cedula).toBe('0010203002086');
  });
  it('fila vieja sin columnas P/Q: cotiza INSS y no retiene IR', () => {
    const cells = __testing.buildRowCells('2026-10-first', { ...item, inputs: base }, 'v').slice(0, 15);
    const raw = cells.map((c) => c.userEnteredValue?.numberValue ?? c.userEnteredValue?.stringValue ?? c.userEnteredValue?.formulaValue ?? '');
    const parsed = __testing.parseStoredRow(raw, 2);
    expect(parsed.inputs?.aplicaIR).toBe(false);
    expect(parsed.inputs?.excluirINSS).toBe(false);
  });
});

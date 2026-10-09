import { describe, expect, it } from 'vitest';
import {
  calcularTotales, calcularINSSLaboral, getEmployeeDaysInPeriod, parseCalendarDate, PAYROLL_CONSTANTS, type PayrollInputs,
} from '@/lib/payroll-calculations';
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

import { describe, expect, it } from 'vitest';
import { calcularTotales, type PayrollInputs } from '@/lib/payroll-calculations';
import { aggregateRows, groupByRestaurant, restaurantKey, type AggregatableRow } from '@/lib/payroll-aggregates';

const mk = (restaurante: string | undefined, salarioMensual: number, extra: Partial<PayrollInputs> = {}): AggregatableRow => {
  const inputs: PayrollInputs = {
    salarioMensual, diasLaborados: 15, diasVacaciones: 0, horasExtra: 0, otrosIngresos: 0,
    consumo: 0, prestamo: 0, greceComida: 0, otros: 0, aplicaIR: false, excluirINSS: false, ...extra,
  };
  return { restaurante, inputs, calculation: calcularTotales(inputs) };
};

// Los cuatro empleados del historial real del 15/10/2026 (1.ª quincena de octubre).
const aracely = () => mk('Barrio Café', 11350);                          // IR desactivada
const mariaEugenia = () => mk('BARRIO CAFE', 13500, { aplicaIR: true }); // IR activada
const mariaAuxiliadora = () => mk('Ají', 13500);
const jose = () => mk('Aji ', 12500, { aplicaIR: true });

describe('1.1 totales recalculados correctamente', () => {
  it('cada empleado coincide con lo registrado en el historial', () => {
    expect(aracely().calculation).toMatchObject({ totalDeducciones: 397.25, netoPagar: 5277.75 });
    expect(mariaEugenia().calculation).toMatchObject({ totalDeducciones: 789.13, netoPagar: 5960.87 });
    expect(mariaAuxiliadora().calculation).toMatchObject({ totalDeducciones: 472.5, netoPagar: 6277.5 });
    expect(jose().calculation).toMatchObject({ totalDeducciones: 684.38, netoPagar: 5565.62 });
  });

  it('los totales por tipo de deducción suman exacto y cuadran con el neto', () => {
    const t = aggregateRows([aracely(), mariaEugenia(), mariaAuxiliadora(), jose()]);
    expect(t.totalDevengado).toBe(25425);
    expect(t.inssLaboral).toBe(1779.75);
    expect(t.irLaboral).toBe(563.51);
    expect(t.totalDeducciones).toBe(2343.26);
    expect(t.netoPagar).toBe(23081.74);
    expect(t.reconciles).toBe(true);
  });

  it('consumo, préstamo, GRECE y otros se totalizan por separado (sin error de decimales)', () => {
    const t = aggregateRows([
      mk('CDP', 12000, { consumo: 0.1, prestamo: 0.2, greceComida: 10.1, otros: 5.05 }),
      mk('CDP', 12000, { consumo: 0.2, prestamo: 0.1, greceComida: 0.2, otros: 0.1 }),
    ]);
    expect(t.consumo).toBe(0.3);
    expect(t.prestamo).toBe(0.3);
    expect(t.greceComida).toBe(10.3);
    expect(t.otros).toBe(5.15);
    expect(t.otrasDeducciones).toBe(16.05);
    expect(t.reconciles).toBe(true);
  });

  it('detecta un cálculo desactualizado (no cuadra)', () => {
    const bad = aracely();
    bad.calculation = { ...bad.calculation, netoPagar: bad.calculation.netoPagar + 1 };
    expect(aggregateRows([bad]).reconciles).toBe(false);
  });

  it('sin filas: todo en cero y cuadra', () => {
    const t = aggregateRows([]);
    expect(t.employees).toBe(0);
    expect(t.netoPagar).toBe(0);
    expect(t.reconciles).toBe(true);
  });

  it('costo para la empresa = devengado + INSS patronal + INATEC + provisiones', () => {
    const t = aggregateRows([aracely()]);
    expect(t.costoEmpresa).toBeCloseTo(t.totalDevengado + t.inssPatronal + t.inatec + t.provisiones, 2);
  });
});

describe('1.2 desglose por restaurante sin duplicados', () => {
  it('restaurantKey unifica mayúsculas, tildes, signos y espacios', () => {
    const keys = ['Barrio Café', 'BARRIO CAFE', '  barrio   café. ', 'Barrio-Café', 'barrio\u00a0cafe'].map(restaurantKey);
    expect(new Set(keys).size).toBe(1);
    expect(restaurantKey('')).toBe('SIN RESTAURANTE');
    expect(restaurantKey(undefined)).toBe('SIN RESTAURANTE');
  });

  it('un restaurante escrito de varias formas aparece una sola vez, con todos sus empleados', () => {
    const groups = groupByRestaurant([aracely(), mariaEugenia(), mariaAuxiliadora(), jose()], ['Todos', 'Barrio Café', 'Ají']);
    expect(groups.map((g) => g.label)).toEqual(['Barrio Café', 'Ají']);
    expect(groups[0].rows).toHaveLength(2);
    expect(groups[0].variants).toHaveLength(2);
    expect(groups[0].totals.salarioBase).toBe(24850);
    expect(groups[0].totals.netoPagar).toBe(11238.62);
    expect(groups[1].totals.salarioBase).toBe(26000);
  });

  it('la suma de los restaurantes es igual al total general', () => {
    const rows = [aracely(), mariaEugenia(), mariaAuxiliadora(), jose(), mk('CDP', 9000), mk(undefined, 8000)];
    const groups = groupByRestaurant(rows, ['Barrio Café', 'Ají', 'CDP']);
    const total = aggregateRows(rows);
    const sum = (pick: (g: (typeof groups)[number]) => number) => Math.round(groups.reduce((acc, g) => acc + pick(g), 0) * 100) / 100;
    expect(sum((g) => g.totals.netoPagar)).toBe(total.netoPagar);
    expect(sum((g) => g.totals.totalDeducciones)).toBe(total.totalDeducciones);
    expect(groups.reduce((acc, g) => acc + g.totals.employees, 0)).toBe(rows.length);
  });

  it('orden: catálogo, luego los no catalogados, "Sin restaurante" al final; los no catalogados se marcan', () => {
    const groups = groupByRestaurant([mk(undefined, 1000), mk('Zeta', 1000), mk('CDP', 1000), mk('Ají', 1000)], ['Ají', 'CDP']);
    expect(groups.map((g) => g.label)).toEqual(['Ají', 'CDP', 'Zeta', 'Sin restaurante']);
    expect(groups.map((g) => g.inCatalog)).toEqual([true, true, false, false]);
  });

  it('sin catálogo cargado no marca advertencias falsas', () => {
    const groups = groupByRestaurant([mk('CDP', 1000)], []);
    expect(groups[0].inCatalog).toBe(true);
  });
});

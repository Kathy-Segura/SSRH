// Ejecutar (sin Jest): npx tsx --test tests/payroll.test.ts
// Ajuste las rutas de import si su carpeta lib/ está en otro lugar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';

import {
  calcularIR,
  calcularTotales,
  getCurrentFortnight,
  getEmployeeDaysInPeriod,
  getPayrollPeriod,
  getPeriodoKey,
  parseCalendarDate,
  type PayrollInputs,
} from '../lib/payroll-calculations';
import {
  coercePayrollInputs,
  normalizeCedula,
  parseFormValues,
  parsePeriodParams,
  validatePayrollInputs,
} from '../lib/payroll-validation';

const base: PayrollInputs = {
  salarioMensual: 15000, diasLaborados: 15, diasVacaciones: 0, horasExtra: 0,
  otrosIngresos: 0, consumo: 0, prestamo: 0, greceComida: 0, otros: 0,
};
const d = (text: string) => parseCalendarDate(text);

// ── IR: la tabla por datos debe dar exactamente lo mismo que los if encadenados anteriores ──
test('calcularIR conserva el resultado del cálculo anterior', () => {
  const money = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
  const legacy = (q: number) => {
    const a = q * 24;
    if (a <= 100000) return 0;
    if (a <= 200000) return money(((a - 100000) * 0.15) / 24);
    if (a <= 350000) return money(((a - 200000) * 0.2 + 15000) / 24);
    if (a <= 500000) return money(((a - 350000) * 0.25 + 45000) / 24);
    return money(((a - 500000) * 0.3 + 82500) / 24);
  };
  for (let q = 0; q <= 60000; q += 37.13) assert.equal(calcularIR(q), legacy(q), `base quincenal ${q}`);
  for (const edge of [100000 / 24, 200000 / 24, 350000 / 24, 500000 / 24]) assert.equal(calcularIR(edge), legacy(edge));
});

// ── Periodos ──
test('periodo: claves y fechas de las dos quincenas', () => {
  assert.equal(getPeriodoKey(2026, 9, 'first'), '2026-09-first');
  assert.equal(getPeriodoKey(2026, 12, 'second'), '2026-12-second');
  const feb = getPayrollPeriod(2028, 2, 'second'); // bisiesto
  assert.equal(feb.start.getDate(), 16);
  assert.equal(feb.end.getDate(), 29);
  assert.equal(getPayrollPeriod(2026, 10, 'second').end.getDate(), 31);
  assert.equal(getCurrentFortnight(new Date(2026, 8, 15)), 'first');
  assert.equal(getCurrentFortnight(new Date(2026, 8, 16)), 'second');
});

test('parsePeriodParams rechaza valores inválidos sin asumir defaults', () => {
  const now = new Date(2026, 8, 28);
  assert.equal(parsePeriodParams('2026', '9', 'first', now).ok, true);
  assert.equal(parsePeriodParams('2026', '13', 'first', now).ok, false);
  assert.equal(parsePeriodParams('2026', '0', 'first', now).ok, false);
  assert.equal(parsePeriodParams('2026', '9', 'third', now).ok, false);
  assert.equal(parsePeriodParams('2026', '9', null, now).ok, false);
  assert.equal(parsePeriodParams('20', '9', 'first', now).ok, false);
  assert.equal(parsePeriodParams('2026.5', '9', 'first', now).ok, false);
  assert.equal(parsePeriodParams(null, null, null, now).ok, false);
});

// ── Días a pagar por ingreso / egreso (mes comercial de 30 días) ──
test('días por quincena: completa siempre 15, incluso en febrero y meses de 31 días', () => {
  for (const [y, m, f] of [[2026, 2, 'second'], [2026, 10, 'second'], [2026, 9, 'first'], [2028, 2, 'second']] as const) {
    const r = getEmployeeDaysInPeriod(d('2020-01-01'), null, y, m, f);
    assert.deepEqual([r.status, r.days], ['full', 15], `${y}-${m}-${f}`);
  }
});

test('días por quincena: ingreso y egreso dentro del periodo', () => {
  assert.equal(getEmployeeDaysInPeriod(d('2026-09-06'), null, 2026, 9, 'first').days, 10);
  assert.equal(getEmployeeDaysInPeriod(d('2026-09-16'), null, 2026, 9, 'second').days, 15);
  assert.equal(getEmployeeDaysInPeriod(d('2026-09-25'), null, 2026, 9, 'second').days, 6);
  assert.equal(getEmployeeDaysInPeriod(d('2026-10-31'), null, 2026, 10, 'second').days, 1);
  assert.equal(getEmployeeDaysInPeriod(d('2026-02-20'), null, 2026, 2, 'second').days, 11);
  assert.equal(getEmployeeDaysInPeriod(null, d('2026-09-10'), 2026, 9, 'first').days, 10);
  assert.equal(getEmployeeDaysInPeriod(null, d('2026-09-30'), 2026, 9, 'second').days, 15);
  assert.equal(getEmployeeDaysInPeriod(null, d('2026-02-28'), 2026, 2, 'second').days, 15);
  assert.equal(getEmployeeDaysInPeriod(d('2026-09-04'), d('2026-09-12'), 2026, 9, 'first').days, 9);
});

test('días por quincena: fuera del periodo no se paga', () => {
  assert.equal(getEmployeeDaysInPeriod(d('2026-09-16'), null, 2026, 9, 'first').status, 'outside');
  assert.equal(getEmployeeDaysInPeriod(null, d('2026-09-15'), 2026, 9, 'second').status, 'outside');
  assert.equal(getEmployeeDaysInPeriod(d('2026-10-01'), null, 2026, 9, 'second').status, 'outside');
});

test('parseCalendarDate: formatos válidos e inválidos', () => {
  assert.deepEqual(d('2026-09-05'), { year: 2026, month: 9, day: 5 });
  assert.deepEqual(d('2026-09-05T00:00:00Z'), { year: 2026, month: 9, day: 5 });
  assert.deepEqual(d('05/09/2026'), { year: 2026, month: 9, day: 5 });
  assert.equal(d('31/02/2026'), null);
  assert.equal(d('2026-13-01'), null);
  assert.equal(d('ayer'), null);
  assert.equal(d(''), null);
});

// ── Validación ──
test('validación: campos, tope de días y neto negativo', () => {
  assert.deepEqual(validatePayrollInputs(base, 15), {});
  assert.ok(validatePayrollInputs({ ...base, salarioMensual: 0 }, 15).salarioMensual);
  assert.ok(validatePayrollInputs({ ...base, consumo: -1 }, 15).consumo);
  assert.ok(validatePayrollInputs({ ...base, diasLaborados: 7.5 }, 15).diasLaborados);
  assert.ok(validatePayrollInputs({ ...base, prestamo: 10.123 }, 15).prestamo);
  assert.ok(validatePayrollInputs({ ...base, diasLaborados: 15, diasVacaciones: 1 }, 15).diasLaborados, 'laborados + vacaciones > 15');
  assert.ok(validatePayrollInputs({ ...base, diasLaborados: 10 }, 9).diasLaborados, 'prorrateo: tope por fechas');
  assert.ok(validatePayrollInputs({ ...base, consumo: 999999 }, 15).general, 'neto negativo');
  assert.ok(validatePayrollInputs({ ...base, consumo: Number.NaN }, 15).consumo);
});

test('formulario: texto → números con reglas estrictas', () => {
  const form = { salarioMensual: '15000', diasLaborados: '15', diasVacaciones: '', horasExtra: '2.5', otrosIngresos: '', consumo: '250.50', prestamo: '0', greceComida: '', otros: '' };
  const ok = parseFormValues(form, 15);
  assert.deepEqual(ok.errors, {});
  assert.equal(ok.values?.consumo, 250.5);
  assert.equal(ok.values?.diasVacaciones, 0);
  assert.ok(parseFormValues({ ...form, consumo: '1,500' }, 15).errors.consumo, 'coma no permitida (ambigua)');
  assert.ok(parseFormValues({ ...form, consumo: 'abc' }, 15).errors.consumo);
  assert.ok(parseFormValues({ ...form, consumo: '-5' }, 15).errors.consumo);
  assert.ok(parseFormValues({ ...form, salarioMensual: '' }, 15).errors.salarioMensual, 'salario requerido');
  assert.ok(parseFormValues({ ...form, diasLaborados: '' }, 15).errors.diasLaborados, 'días laborados requerido');
});

test('coercePayrollInputs exige todos los campos numéricos (sin defaults silenciosos)', () => {
  assert.deepEqual(coercePayrollInputs(base), base);
  assert.equal(coercePayrollInputs({ ...base, consumo: '10' }), null);
  const { otros: _omit, ...incompleto } = base;
  assert.equal(coercePayrollInputs(incompleto), null);
  assert.equal(coercePayrollInputs(null), null);
  assert.equal(normalizeCedula(' 001-010190-0001a '), '001-010190-0001A');
});

test('cálculo: neto coherente para quincena completa y prorrateada', () => {
  const full = calcularTotales(base);
  assert.equal(full.totalDevengado, 7500);
  assert.equal(full.inssLaboral, 525);
  assert.equal(full.netoPagar, full.totalDevengado - full.totalDeducciones);
  const partial = calcularTotales({ ...base, diasLaborados: 6 });
  assert.equal(partial.basico, 3000);
});

// ── Guardado en el Sheet: Google Sheets simulado en memoria ──
type Cell = { userEnteredValue?: { stringValue?: string; numberValue?: number } };
const grid: unknown[][] = []; // fila 1 = índice 0
let tabExists = false;
let batchCalls = 0;
let failNextBatch = false;

const fakeSheets = {
  spreadsheets: {
    get: async () => ({ data: { sheets: tabExists ? [{ properties: { sheetId: 77, title: 'DEDUCCIONES' } }] : [] } }),
    batchUpdate: async ({ requestBody }: { requestBody: { requests: Record<string, any>[] } }) => {
      batchCalls++;
      if (failNextBatch) { failNextBatch = false; throw new Error('boom'); }
      const replies: unknown[] = [];
      for (const req of requestBody.requests) {
        if (req.addSheet) { tabExists = true; replies.push({ addSheet: { properties: { sheetId: 77 } } }); continue; }
        replies.push({});
        const toValues = (cells: Cell[]) => cells.map((c) => c.userEnteredValue?.numberValue ?? c.userEnteredValue?.stringValue);
        if (req.updateCells) {
          const r = req.updateCells.range;
          grid[r.startRowIndex] = toValues(req.updateCells.rows[0].values);
        }
        if (req.appendCells) for (const row of req.appendCells.rows) grid.push(toValues(row.values));
      }
      return { data: { replies } };
    },
    values: {
      get: async ({ range }: { range: string }) => {
        if (range.endsWith('1:L1')) return { data: { values: grid[0] ? [grid[0]] : [] } };
        return { data: { values: grid.slice(1) } };
      },
      update: async ({ requestBody }: { requestBody: { values: unknown[][] } }) => {
        grid[0] = [...(grid[0] ?? []), ...requestBody.values[0]];
        return { data: {} };
      },
    },
  },
};

const originalLoad = (Module as any)._load;
(Module as any)._load = function (request: string, ...rest: unknown[]) {
  if (request === 'googleapis') {
    return { google: { auth: { GoogleAuth: class {} }, sheets: () => fakeSheets }, sheets_v4: {} };
  }
  return originalLoad.call(this, request, ...rest);
};
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'test@example.iam.gserviceaccount.com';
process.env.GOOGLE_PRIVATE_KEY = 'key';
process.env.GOOGLE_SHEET_ID = 'sheet';

test('hoja DEDUCCIONES: crea pestaña y encabezados, upsert por cédula, sin tocar otras filas', async () => {
  const { getDeducciones, upsertDeducciones, DeduccionesConflictError } = await import('../lib/googleSheets');
  const P = '2026-09-first';
  const other = '2026-09-second';

  // Primer uso: se crea la pestaña y los 12 encabezados
  assert.deepEqual((await getDeducciones(P)).registros, []);
  assert.equal(grid[0]?.length, 12);
  assert.equal(grid[0]?.[1], 'cedula');
  assert.equal(grid[0]?.[11], 'actualizadoEn');

  // Alta de dos empleados en la primera quincena y uno en la segunda
  const v1 = await upsertDeducciones(P, [
    { cedula: '001-A', inputs: { ...base, consumo: 100 }, version: null },
    { cedula: '002-B', inputs: base, version: null },
  ]);
  await upsertDeducciones(other, [{ cedula: '001-A', inputs: { ...base, prestamo: 50 }, version: null }]);
  assert.equal(grid.length, 4); // encabezado + 3 filas

  // Lectura: solo el periodo pedido, números como números
  const read = await getDeducciones(P);
  assert.equal(read.registros.length, 2);
  assert.equal(read.registros.find((r) => r.cedula === '001-A')?.inputs.consumo, 100);
  assert.equal(read.registros[0].version, v1['001-A']);

  // Actualizar SOLO 001-A de la primera quincena: no debe borrar ni 002-B ni la otra quincena
  await new Promise((r) => setTimeout(r, 5));
  const v2 = await upsertDeducciones(P, [{ cedula: '001-A', inputs: { ...base, consumo: 175 }, version: v1['001-A'] }]);
  assert.notEqual(v2['001-A'], v1['001-A']);
  const after = await getDeducciones(P);
  assert.equal(after.registros.length, 2);
  assert.equal(after.registros.find((r) => r.cedula === '001-A')?.inputs.consumo, 175);
  assert.equal(after.registros.find((r) => r.cedula === '002-B')?.inputs.consumo, 0);
  assert.equal((await getDeducciones(other)).registros[0].inputs.prestamo, 50);
  assert.equal(grid.length, 4, 'actualizar no agrega filas');

  // Conflicto: guardar con una versión vieja no escribe nada (ni siquiera las filas sin conflicto)
  const snapshot = JSON.stringify(grid);
  await assert.rejects(
    upsertDeducciones(P, [
      { cedula: '001-A', inputs: { ...base, consumo: 1 }, version: v1['001-A'] }, // versión vieja
      { cedula: '003-C', inputs: base, version: null },
    ]),
    (error: unknown) => error instanceof DeduccionesConflictError && error.cedulas.join() === '001-A'
  );
  assert.equal(JSON.stringify(grid), snapshot, 'todo o nada');

  // Fila nueva creada por otra persona mientras yo pensaba que no existía
  await assert.rejects(upsertDeducciones(P, [{ cedula: '002-B', inputs: base, version: null }]), DeduccionesConflictError);

  // Un fallo de la API no deja escritura parcial
  failNextBatch = true;
  await assert.rejects(upsertDeducciones(P, [{ cedula: '004-D', inputs: base, version: null }]), /boom/);
  assert.equal(JSON.stringify(grid), snapshot);
});

test('hoja DEDUCCIONES: filas dañadas se reportan (no se convierten en 0) y guardar las repara', async () => {
  const { getDeducciones, upsertDeducciones } = await import('../lib/googleSheets');
  const P = '2026-10-first';
  grid.push(
    [P, '010-X', 15000, 15, 0, 0, 0, '1.500,50', 0, 0, 0, '2026-10-01T00:00:00.000Z'], // texto con formato regional
    [P, '011-Y', 15000, 15, 0, 0, 0, 0, 0, 0, 0],                                   // fila legada sin versión
    ['', '', '', '', '', '', '', '', '', '', '', ''],                                // fila vacía: se ignora
    [P, '011-Y', 9999, 15, 0, 0, 0, 0, 0, 0, 0, '2026-10-02T00:00:00.000Z'],         // duplicada
  );
  const r = await getDeducciones(P);
  assert.equal(r.registros.length, 1);
  assert.equal(r.registros[0].cedula, '011-Y');
  assert.equal(r.registros[0].version, 'sin-version');
  assert.equal(r.registros[0].inputs.salarioMensual, 15000, 'la primera fila válida es la vigente');
  assert.equal(r.problemas.length, 2);
  assert.ok(r.problemas.some((p) => /no numérico/.test(p.motivo)));
  assert.ok(r.problemas.some((p) => /duplicada/.test(p.motivo)));

  // Guardar la fila dañada (el cliente la ve como inexistente → version null) la repara en su misma fila
  const before = grid.length;
  await upsertDeducciones(P, [{ cedula: '010-X', inputs: { ...base, consumo: 1500.5 }, version: null }]);
  assert.equal(grid.length, before);
  const fixed = await getDeducciones(P);
  assert.equal(fixed.registros.find((x) => x.cedula === '010-X')?.inputs.consumo, 1500.5);
  // Guardar una fila legada usando su versión 'sin-version' funciona
  await upsertDeducciones(P, [{ cedula: '011-Y', inputs: { ...base, otros: 5 }, version: 'sin-version' }]);
  assert.equal((await getDeducciones(P)).registros.find((x) => x.cedula === '011-Y')?.inputs.otros, 5);
});

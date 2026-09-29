import { google, sheets_v4 } from 'googleapis';
import { calcularTotales, PAYROLL_INPUT_FIELDS, type PayrollInputs } from './payroll-calculations';
import {
  computeInputDiffs,
  LEGACY_VERSION,
  normalizeCedula,
  sanitizeNombre,
  type DeduccionApiItem,
  type DeduccionProblem,
  type DeduccionSaveItem,
  type FieldChange,
} from './payroll-validation';

const SHEET_NAME = 'INDETERMINADO';
const RESTAURANTES_SHEET_NAME = 'RESTAURANTES';
const DEDUCCIONES_SHEET_NAME = 'DEDUCCIONES';
const HISTORIAL_SHEET_NAME = 'HISTORIAL_DEDUCCIONES';

// Dominio de la app para el enlace "Ver ficha" que se escribe en la hoja (punto 1.5).
// Configurar NEXT_PUBLIC_APP_URL (o APP_BASE_URL) con la URL pública, p. ej.
// https://miapp.vercel.app — sin esto, la columna "enlace" queda vacía.
function getEmployeeLinkBase(): string | null {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL;
  if (!base) return null;
  return base.trim().replace(/\/+$/, '') || null;
}

// ── Errores tipados (la API decide el código HTTP según la clase) ────────────

export class SheetConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SheetConfigError';
  }
}

export class DeduccionesConflictError extends Error {
  constructor(public readonly cedulas: string[]) {
    super(`Registros modificados por otra persona: ${cedulas.join(', ')}`);
    this.name = 'DeduccionesConflictError';
  }
}

// ── Cliente autenticado (cuenta de servicio) ─────────────────────────────────

let authClient: InstanceType<typeof google.auth.GoogleAuth> | null = null;
let sheetsClient: sheets_v4.Sheets | null = null;

function getAuth() {
  if (authClient) return authClient;

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const missing = [
    !clientEmail && 'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    !privateKey && 'GOOGLE_PRIVATE_KEY',
    !process.env.GOOGLE_SHEET_ID && 'GOOGLE_SHEET_ID',
  ].filter(Boolean);
  if (missing.length > 0) throw new SheetConfigError(`Faltan variables de entorno: ${missing.join(', ')}`);

  authClient = new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return authClient;
}

function getSheets(): sheets_v4.Sheets {
  if (!sheetsClient) sheetsClient = google.sheets({ version: 'v4', auth: getAuth() });
  return sheetsClient;
}

const getSpreadsheetId = () => {
  getAuth(); // valida las variables de entorno
  return process.env.GOOGLE_SHEET_ID as string;
};

// ----- EMPLEADOS -----

export async function getEmpleados(): Promise<string[][]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A2:W`,
  });

  return (response.data.values as string[][]) || [];
}

export async function appendEmpleado(fila: string[]): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A:W`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [fila] },
  });
}

export async function updateEmpleado(rowIndex: number, fila: string[]): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const sheetRow = rowIndex + 2;

  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A${sheetRow}:W${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [fila] },
  });
}

// Cache del sheetId numérico por nombre de pestaña (evita pedirlo en cada operación).
// Antes era una sola variable: devolvía el id de la primera pestaña consultada para cualquier nombre.
const sheetIdCache = new Map<string, number>();

async function getSheetIdByName(sheets: sheets_v4.Sheets, sheetName: string): Promise<number> {
  const cached = sheetIdCache.get(sheetName);
  if (cached !== undefined) return cached;

  const meta = await sheets.spreadsheets.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
  });

  const sheet = meta.data.sheets?.find((s) => s.properties?.title === sheetName);

  if (sheet?.properties?.sheetId === undefined || sheet?.properties?.sheetId === null) {
    throw new Error(`No se encontró la pestaña "${sheetName}" en el spreadsheet`);
  }

  sheetIdCache.set(sheetName, sheet.properties.sheetId);
  return sheet.properties.sheetId;
}

// ELIMINAR: borra físicamente la fila (no solo su contenido)
export async function deleteEmpleado(rowIndex: number): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const sheetId = await getSheetIdByName(sheets, SHEET_NAME);

  // Mismo criterio que updateEmpleado (sheetRow = rowIndex + 2),
  // pero deleteDimension usa índices 0-based donde 0 = fila 1 (encabezado)
  const startRowIndex = rowIndex + 1;
  const endRowIndex = startRowIndex + 1;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: startRowIndex,
              endIndex: endRowIndex,
            },
          },
        },
      ],
    },
  });
}

// ----- RESTAURANTES -----

export async function getRestaurantes(): Promise<string[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${RESTAURANTES_SHEET_NAME}!A2:A`,
  });

  const rows = (response.data.values as string[][]) || [];
  return rows.map((fila) => fila[0]).filter(Boolean);
}

export async function appendRestaurante(nombre: string): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${RESTAURANTES_SHEET_NAME}!A:A`,
  });

  const values = (response.data.values as string[][]) || [];
  const nextRow = values.length + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${RESTAURANTES_SHEET_NAME}!A${nextRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[nombre]] },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DEDUCCIONES
//
// Formato de la hoja (una fila por periodo + cédula; el orden de columnas es
// POSICIONAL, no reordenarlas; las 3 últimas son de solo lectura/conveniencia,
// nunca se leen de vuelta como fuente de verdad):
//   A periodo | B cedula | C..K campos de PayrollInputs | L actualizadoEn
//   M nombre | N totalPagar | O enlace
// `periodo` = AAAA-MM-first|second (ver getPeriodoKey). `actualizadoEn` = ISO UTC
// de la última escritura; sirve para detectar ediciones simultáneas. `nombre` y
// `totalPagar` son una foto del momento del guardado, para poder leer la hoja sin
// abrir la app; el neto vigente SIEMPRE se recalcula con calcularTotales(inputs).
// `enlace` es una fórmula HYPERLINK a la ficha del empleado (ver getEmployeeLinkBase).
// ─────────────────────────────────────────────────────────────────────────────

const DEDUCCIONES_COLUMNS = [
  'periodo', 'cedula', ...PAYROLL_INPUT_FIELDS, 'actualizadoEn', 'nombre', 'totalPagar', 'enlace',
] as const;
const COLUMN_COUNT = DEDUCCIONES_COLUMNS.length;
const REQUIRED_NUMERIC: ReadonlySet<string> = new Set(['salarioMensual', 'diasLaborados']);

const columnLetter = (position: number) => {
  if (position < 1 || position > 26) throw new Error('columnLetter solo soporta A..Z');
  return String.fromCharCode(64 + position);
};
const LAST_COLUMN = columnLetter(COLUMN_COUNT);
const HEADER_RANGE = `${DEDUCCIONES_SHEET_NAME}!A1:${LAST_COLUMN}1`;
const DATA_RANGE = `${DEDUCCIONES_SHEET_NAME}!A2:${LAST_COLUMN}`;

// Crea la pestaña/encabezados si faltan y completa columnas nuevas (migración aditiva).
// Es idempotente y se ejecuta una sola vez por instancia del servidor.
let ensurePromise: Promise<number> | null = null;

function ensureDeduccionesSheet(): Promise<number> {
  if (!ensurePromise) {
    ensurePromise = createOrMigrateDeduccionesSheet().catch((error) => {
      ensurePromise = null; // permite reintentar tras un fallo transitorio
      throw error;
    });
  }
  return ensurePromise;
}

async function createOrMigrateDeduccionesSheet(): Promise<number> {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();

  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties(sheetId,title)' });
  let sheetId = meta.data.sheets?.find((s) => s.properties?.title === DEDUCCIONES_SHEET_NAME)?.properties?.sheetId ?? null;

  if (sheetId === null) {
    const created = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          addSheet: { properties: { title: DEDUCCIONES_SHEET_NAME, gridProperties: { frozenRowCount: 1 } } },
        }],
      },
    });
    sheetId = created.data.replies?.[0]?.addSheet?.properties?.sheetId ?? null;
    if (sheetId === null) throw new Error(`No se pudo crear la pestaña "${DEDUCCIONES_SHEET_NAME}"`);
  }

  const headerResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: HEADER_RANGE });
  const header = (headerResponse.data.values?.[0] ?? []).map((cell) => String(cell ?? '').trim());
  const existing = header.filter(Boolean).length;

  if (existing < COLUMN_COUNT) {
    // Solo se escriben los encabezados que faltan; los que ya existen no se tocan.
    const missing = DEDUCCIONES_COLUMNS.slice(existing);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${DEDUCCIONES_SHEET_NAME}!${columnLetter(existing + 1)}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [[...missing]] },
    });
  }

  if (existing === 0) {
    // Hoja nueva: periodo y cédula como texto (sin conversión a fecha/número) y encabezado en negrita.
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: COLUMN_COUNT },
              cell: { userEnteredFormat: { textFormat: { bold: true } } },
              fields: 'userEnteredFormat.textFormat.bold',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: 2 },
              cell: { userEnteredFormat: { numberFormat: { type: 'TEXT' } } },
              fields: 'userEnteredFormat.numberFormat',
            },
          },
        ],
      },
    });
  }

  return sheetId;
}

const HISTORIAL_COLUMNS = ['fecha', 'periodo', 'cedula', 'nombre', 'campo', 'valorAnterior', 'valorNuevo'] as const;

// Se crea recién cuando ocurre el primer cambio real (no en cada guardado): la mayoría
// de guardados son altas nuevas, que no son "cambios" y no ameritan bitácora.
let ensureHistorialPromise: Promise<number> | null = null;

function ensureHistorialSheet(): Promise<number> {
  if (!ensureHistorialPromise) {
    ensureHistorialPromise = createHistorialSheet().catch((error) => {
      ensureHistorialPromise = null;
      throw error;
    });
  }
  return ensureHistorialPromise;
}

async function createHistorialSheet(): Promise<number> {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();

  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties(sheetId,title)' });
  const existingSheet = meta.data.sheets?.find((s) => s.properties?.title === HISTORIAL_SHEET_NAME);
  if (existingSheet?.properties?.sheetId !== undefined && existingSheet.properties.sheetId !== null) {
    return existingSheet.properties.sheetId;
  }

  const created = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        { addSheet: { properties: { title: HISTORIAL_SHEET_NAME, gridProperties: { frozenRowCount: 1 } } } },
      ],
    },
  });
  const sheetId = created.data.replies?.[0]?.addSheet?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) throw new Error(`No se pudo crear la pestaña "${HISTORIAL_SHEET_NAME}"`);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateCells: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: HISTORIAL_COLUMNS.length },
            rows: [{ values: HISTORIAL_COLUMNS.map((label) => cell(label)) }],
            fields: 'userEnteredValue',
          },
        },
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: HISTORIAL_COLUMNS.length },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: 'userEnteredFormat.textFormat.bold',
          },
        },
      ],
    },
  });
  return sheetId;
}

function buildHistorialRow(fecha: string, periodo: string, item: DeduccionSaveItem, change: FieldChange): sheets_v4.Schema$RowData {
  return {
    values: [cell(fecha), cell(periodo), cell(item.cedula), cell(item.nombre), cell(change.campo), cell(change.anterior), cell(change.nuevo)],
  };
}

// ── Lectura estricta ─────────────────────────────────────────────────────────

interface StoredRow {
  rowNumber: number;
  periodo: string;
  cedula: string;
  actualizadoEn: string;
  /** Columnas M/N: solo informativas, nunca invalidan la fila ni se usan para calcular. */
  nombre: string | null;
  totalPagarGuardado: number | null;
  inputs: PayrollInputs | null;
  problem: string | null;
}

const NUMERIC_TEXT = /^-?\d+(\.\d+)?$/;

/** undefined = celda vacía · null = valor no numérico · number = válido. */
function readNumericCell(cell: unknown): number | null | undefined {
  if (cell === undefined || cell === null || cell === '') return undefined;
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null;
  if (typeof cell === 'string' && NUMERIC_TEXT.test(cell.trim())) return Number(cell.trim());
  return null;
}

function parseStoredRow(cells: unknown[], rowNumber: number): StoredRow {
  const cellAt = (column: (typeof DEDUCCIONES_COLUMNS)[number]) => cells[DEDUCCIONES_COLUMNS.indexOf(column)];
  const periodo = String(cellAt('periodo') ?? '').trim();
  const cedula = normalizeCedula(cellAt('cedula'));
  const actualizadoEn = String(cellAt('actualizadoEn') ?? '').trim();
  const nombre = sanitizeNombre(cellAt('nombre'));
  const totalPagarRaw = readNumericCell(cellAt('totalPagar'));
  const totalPagarGuardado = typeof totalPagarRaw === 'number' ? totalPagarRaw : null;
  const base = { rowNumber, periodo, cedula, actualizadoEn, nombre, totalPagarGuardado };

  if (!periodo || !cedula) return { ...base, inputs: null, problem: 'Falta periodo o cédula' };

  const values: Partial<PayrollInputs> = {};
  for (const field of PAYROLL_INPUT_FIELDS) {
    const parsed = readNumericCell(cellAt(field));
    if (parsed === null) return { ...base, inputs: null, problem: `Valor no numérico en "${field}"` };
    if (parsed === undefined) {
      if (REQUIRED_NUMERIC.has(field)) return { ...base, inputs: null, problem: `Falta "${field}"` };
      values[field] = 0;
    } else {
      values[field] = parsed;
    }
  }
  return { ...base, inputs: values as PayrollInputs, problem: null };
}

async function readAllRows(): Promise<StoredRow[]> {
  const response = await getSheets().spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: DATA_RANGE,
    // Números como números (sin formato regional) para no confundir "1.500,50" con 0.
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const rows = (response.data.values ?? []) as unknown[][];
  return rows
    .map((cells, index) => parseStoredRow(cells, index + 2))
    .filter((row) => row.periodo || row.cedula || row.problem !== 'Falta periodo o cédula');
}

const versionOf = (row: Pick<StoredRow, 'actualizadoEn'>) => row.actualizadoEn || LEGACY_VERSION;

export async function getDeducciones(periodo: string): Promise<{ registros: DeduccionApiItem[]; problemas: DeduccionProblem[] }> {
  await ensureDeduccionesSheet();
  const rows = (await readAllRows()).filter((row) => row.periodo === periodo);

  const registros: DeduccionApiItem[] = [];
  const problemas: DeduccionProblem[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (row.problem || !row.inputs) {
      problemas.push({ fila: row.rowNumber, motivo: row.problem ?? 'Fila inválida' });
    } else if (seen.has(row.cedula)) {
      problemas.push({ fila: row.rowNumber, motivo: `Cédula ${row.cedula} duplicada en el periodo (se usa la primera fila)` });
    } else {
      seen.add(row.cedula);
      registros.push({
        cedula: row.cedula, inputs: row.inputs, version: versionOf(row),
        nombre: row.nombre, totalPagarGuardado: row.totalPagarGuardado,
      });
    }
  }
  return { registros, problemas };
}

// ── Escritura ────────────────────────────────────────────────────────────────

// Serializa las escrituras dentro de la misma instancia del servidor. Entre instancias
// distintas la protección es el control de versión de cada fila (ver upsertDeducciones).
let writeChain: Promise<unknown> = Promise.resolve();
function enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = writeChain.then(task, task);
  writeChain = run.catch(() => undefined);
  return run;
}

const cell = (value: string | number): sheets_v4.Schema$CellData => ({
  userEnteredValue: typeof value === 'number' ? { numberValue: value } : { stringValue: value },
});
const formulaCell = (formula: string): sheets_v4.Schema$CellData => ({ userEnteredValue: { formulaValue: formula } });

// Comillas dobles literales de la cédula dentro de la fórmula (por si alguna cédula las trajera).
const escapeFormulaText = (value: string) => value.replace(/"/g, '""');

function buildRowCells(periodo: string, item: DeduccionSaveItem, version: string): sheets_v4.Schema$CellData[] {
  const linkBase = getEmployeeLinkBase();
  return DEDUCCIONES_COLUMNS.map((column) => {
    if (column === 'periodo') return cell(periodo);
    if (column === 'cedula') return cell(item.cedula);
    if (column === 'actualizadoEn') return cell(version);
    if (column === 'nombre') return cell(item.nombre);
    if (column === 'totalPagar') return cell(calcularTotales(item.inputs).netoPagar);
    if (column === 'enlace') {
      if (!linkBase) return cell('');
      const url = `${linkBase}/?empleado=${encodeURIComponent(item.cedula)}`;
      return formulaCell(`=HYPERLINK("${escapeFormulaText(url)}","Ver ficha")`);
    }
    return cell(item.inputs[column]);
  });
}

/**
 * Inserta o actualiza SOLO las filas enviadas (periodo + cédula); las demás no se tocan.
 * - Si alguna fila cambió en la hoja desde que el cliente la cargó, no escribe nada
 *   y lanza DeduccionesConflictError (evita pisar el trabajo de otra persona).
 * - La escritura es una sola batchUpdate: o se aplican todas las filas o ninguna.
 * Devuelve la nueva versión de cada cédula.
 */
export function upsertDeducciones(periodo: string, items: DeduccionSaveItem[]): Promise<Record<string, string>> {
  return enqueueWrite(async () => {
    const sheetId = await ensureDeduccionesSheet();
    const rows = (await readAllRows()).filter((row) => row.periodo === periodo);

    // Misma regla que getDeducciones: la primera fila válida de cada cédula es la vigente.
    // Una fila dañada (ver `problem`) se trata como inexistente: guardar la repara.
    const existing = new Map<string, StoredRow>();
    for (const row of rows) {
      const current = existing.get(row.cedula);
      if (row.cedula && (!current || (current.problem && !row.problem))) existing.set(row.cedula, row);
    }

    const conflicts = items
      .filter((item) => {
        const current = existing.get(item.cedula);
        const loadedVersion = current && !current.problem ? versionOf(current) : null;
        return loadedVersion !== item.version;
      })
      .map((item) => item.cedula);
    if (conflicts.length > 0) throw new DeduccionesConflictError(conflicts);

    const version = new Date().toISOString();
    const requests: sheets_v4.Schema$Request[] = [];
    const appended: sheets_v4.Schema$RowData[] = [];
    const historialRows: sheets_v4.Schema$RowData[] = [];

    for (const item of items) {
      const cells = buildRowCells(periodo, item, version);
      const current = existing.get(item.cedula);
      if (current) {
        requests.push({
          updateCells: {
            range: {
              sheetId,
              startRowIndex: current.rowNumber - 1,
              endRowIndex: current.rowNumber,
              startColumnIndex: 0,
              endColumnIndex: COLUMN_COUNT,
            },
            rows: [{ values: cells }],
            fields: 'userEnteredValue',
          },
        });
        // Solo se registra en el historial si había una fila válida previa y algo cambió;
        // un alta nueva (current === undefined) no es un "cambio" y no se audita.
        if (!current.problem && current.inputs) {
          for (const change of computeInputDiffs(current.inputs, item.inputs)) {
            historialRows.push(buildHistorialRow(version, periodo, item, change));
          }
        }
      } else {
        appended.push({ values: cells });
      }
    }
    if (appended.length > 0) requests.push({ appendCells: { sheetId, rows: appended, fields: 'userEnteredValue' } });

    if (historialRows.length > 0) {
      const historialSheetId = await ensureHistorialSheet();
      requests.push({ appendCells: { sheetId: historialSheetId, rows: historialRows, fields: 'userEnteredValue' } });
    }

    await getSheets().spreadsheets.batchUpdate({
      spreadsheetId: getSpreadsheetId(),
      requestBody: { requests },
    });

    return Object.fromEntries(items.map((item) => [item.cedula, version]));
  });
}

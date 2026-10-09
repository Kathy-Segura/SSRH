
import { google, sheets_v4 } from 'googleapis';
import { calcularTotales, getPeriodoKey, PAYROLL_INPUT_FIELDS, type PayrollInputs } from './payroll-calculations';
import { parseMoney } from './money';
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
// POSICIONAL, no reordenarlas; `totalPagar` y `enlace` son de solo lectura/conveniencia,
// nunca se leen de vuelta como fuente de verdad):
//   A periodo | B cedula | C nombre | D..L campos de PayrollInputs | M totalPagar
//   N actualizadoEn | O enlace | P aplicaIR (1 = retiene IR; vacío/0 = solo INSS)
//   Q excluirINSS (1 = no cotiza INSS: pasante/temporal; vacío/0 = cotiza)
// (Antes `nombre` estaba en la columna M: createOrMigrateDeduccionesSheet mueve la columna sola.)
// `periodo` = AAAA-MM-first|second (ver getPeriodoKey). `actualizadoEn` = ISO UTC
// de la última escritura; sirve para detectar ediciones simultáneas. `nombre` y
// `totalPagar` son una foto del momento del guardado, para poder leer la hoja sin
// abrir la app; el neto vigente SIEMPRE se recalcula con calcularTotales(inputs).
// `enlace` es una fórmula HYPERLINK a la ficha del empleado (ver getEmployeeLinkBase).
// ─────────────────────────────────────────────────────────────────────────────

const DEDUCCIONES_COLUMNS = [
  'periodo', 'cedula', 'nombre', ...PAYROLL_INPUT_FIELDS, 'totalPagar', 'actualizadoEn', 'enlace', 'aplicaIR', 'excluirINSS',
] as const;
const COLUMN_COUNT = DEDUCCIONES_COLUMNS.length;
const MONEY_COLUMNS = ['salarioMensual', 'otrosIngresos', 'consumo', 'prestamo', 'greceComida', 'otros', 'totalPagar'] as const;
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

  const readHeader = async () => {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: HEADER_RANGE });
    return (response.data.values?.[0] ?? []).map((cell) => String(cell ?? '').trim());
  };
  let header = await readHeader();

  // Migración del orden de columnas: `nombre` pasa a la columna C.
  // Formato anterior: C = salarioMensual y `nombre` en la columna M (índice 12) — o sin `nombre` en hojas más viejas.
  // Es una sola operación de Sheets (mueve encabezado y datos juntos). Antes de desplegar conviene
  // duplicar la pestaña como respaldo, y abrir la app una vez para que la migración corra una sola vez.
  if (header[2]?.toLowerCase() === 'salariomensual') {
    const nombreIndex = header.findIndex((h) => h.toLowerCase() === 'nombre');
    if (nombreIndex === 12) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            moveDimension: {
              source: { sheetId, dimension: 'COLUMNS', startIndex: 12, endIndex: 13 },
              destinationIndex: 2,
            },
          }],
        },
      });
    } else if (nombreIndex === -1) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            insertDimension: { range: { sheetId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 }, inheritFromBefore: false },
          }],
        },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId, range: `${DEDUCCIONES_SHEET_NAME}!C1`, valueInputOption: 'RAW', requestBody: { values: [['nombre']] },
      });
    } else {
      throw new SheetConfigError(`La hoja ${DEDUCCIONES_SHEET_NAME} tiene "nombre" en una columna inesperada; revise los encabezados antes de continuar.`);
    }
    header = await readHeader();
  }

  // Migración 2: `totalPagar` pasa a la columna M y `actualizadoEn` a la N (antes al revés).
  // Con 'totalPagar' en N se mueve esa columna; si la hoja aún no la tiene, se inserta vacía en M
  // (las filas viejas la llenan la próxima vez que se guarden; es solo una foto informativa).
  if (header[12]?.toLowerCase() === 'actualizadoen') {
    if (header[13]?.toLowerCase() === 'totalpagar') {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            moveDimension: {
              source: { sheetId, dimension: 'COLUMNS', startIndex: 13, endIndex: 14 },
              destinationIndex: 12,
            },
          }],
        },
      });
    } else if (!header[13]) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            insertDimension: { range: { sheetId, dimension: 'COLUMNS', startIndex: 12, endIndex: 13 }, inheritFromBefore: false },
          }],
        },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId, range: `${DEDUCCIONES_SHEET_NAME}!M1`, valueInputOption: 'RAW', requestBody: { values: [['totalPagar']] },
      });
    } else {
      throw new SheetConfigError(`La hoja ${DEDUCCIONES_SHEET_NAME} tiene "${header[13]}" en la columna N y se esperaba "totalPagar" o una columna vacía.`);
    }
    header = await readHeader();
  }

  let existing = 0;
  while (existing < header.length && header[existing]) existing++;
  // Lectura y escritura son posicionales: si el orden real no coincide, se detiene todo en vez de leer datos corridos.
  for (let i = 0; i < Math.min(existing, COLUMN_COUNT); i++) {
    if (header[i].toLowerCase() !== DEDUCCIONES_COLUMNS[i].toLowerCase()) {
      throw new SheetConfigError(
        `La hoja ${DEDUCCIONES_SHEET_NAME} tiene "${header[i]}" en la columna ${columnLetter(i + 1)} y se esperaba "${DEDUCCIONES_COLUMNS[i]}". Restaure el orden de columnas.`
      );
    }
  }

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

  // Formatos de columna (idempotente, una vez por instancia): periodo/cédula/nombre como texto (conserva ceros
  // iniciales y evita que Sheets convierta a fecha/número) y montos con 2 decimales. Se aplican a TODA la columna
  // (desde la fila 2, sin fin) para que las filas nuevas (appendCells) nazcan ya con formato y no lo pierdan.
  // Las escrituras de datos usan fields='userEnteredValue', así que nunca pisan formato, colores ni validaciones.
  const formatRequests: sheets_v4.Schema$Request[] = [
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: 3 },
        cell: { userEnteredFormat: { numberFormat: { type: 'TEXT' } } },
        fields: 'userEnteredFormat.numberFormat',
      },
    },
    ...MONEY_COLUMNS.map((column) => {
      const index = DEDUCCIONES_COLUMNS.indexOf(column);
      return {
        repeatCell: {
          range: { sheetId, startRowIndex: 1, startColumnIndex: index, endColumnIndex: index + 1 },
          cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '#,##0.00' } } },
          fields: 'userEnteredFormat.numberFormat',
        },
      } as sheets_v4.Schema$Request;
    }),
  ];
  if (existing === 0) {
    formatRequests.unshift({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: COLUMN_COUNT },
        cell: { userEnteredFormat: { textFormat: { bold: true } } },
        fields: 'userEnteredFormat.textFormat.bold',
      },
    });
  }
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: formatRequests } });

  return sheetId;
}

// ── Historial de deducciones (pestaña HISTORIAL_DEDUCCIONES) ─────────────────
//
// El orden de columnas es POSICIONAL y coincide con el encabezado visible de la hoja.
// Escritura (appendCells), lectura y reparación usan SIEMPRE este mismo arreglo:
// no reordenar ni insertar columnas en medio (agregar solo al final).
//   A FECHA | B QUINCENA (clave AAAA-MM-first|second) | C CEDULA | D NOMBRE | E SALARIO MENSUAL
//   F CONCEPTO DEDUCCION (texto legible) | G DEDUCCIONES TOTALES | H NETO A PAGAR
//   I deduccionesTotales | J netoPagar (copias numéricas crudas de G y H)
//   K campo | L valorAnterior | M valorNuevo (dato estructurado del cambio; lo lee la app)
const HISTORIAL_COLUMNS = [
  'FECHA', 'QUINCENA', 'CEDULA', 'NOMBRE', 'SALARIO MENSUAL', 'CONCEPTO DEDUCCION',
  'DEDUCCIONES TOTALES', 'NETO A PAGAR', 'deduccionesTotales', 'netoPagar',
  'campo', 'valorAnterior', 'valorNuevo',
] as const;
const HISTORIAL_LAST_COLUMN = columnLetter(HISTORIAL_COLUMNS.length);
const HISTORIAL_MONEY_COLUMNS = ['SALARIO MENSUAL', 'DEDUCCIONES TOTALES', 'NETO A PAGAR', 'deduccionesTotales', 'netoPagar'] as const;
const DEDUCTION_CONCEPTS = ['consumo', 'prestamo', 'greceComida', 'otros'] as const;

const CONCEPTO_LABELS: Record<string, string> = {
  consumo: 'Consumo', prestamo: 'Mi Prestamito', greceComida: 'GRECE Comida', otros: 'Otros',
  salarioMensual: 'Cambio de salario', diasLaborados: 'Días laborados', diasVacaciones: 'Días de vacaciones',
  horasExtra: 'Horas extra', otrosIngresos: 'Otros ingresos', aplicaIR: 'Retención de IR', excluirINSS: 'Exclusión de INSS',
};
const CONCEPTO_DINERO = new Set(['consumo', 'prestamo', 'greceComida', 'otros', 'salarioMensual', 'otrosIngresos']);
const CONCEPTO_INTERRUPTOR = new Set(['aplicaIR', 'excluirINSS']);
const formatMonto = (value: number) => `C$ ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Texto legible para la columna CONCEPTO DEDUCCION. */
function conceptoTexto(change: FieldChange): string {
  const label = CONCEPTO_LABELS[change.campo] ?? change.campo;
  if (CONCEPTO_INTERRUPTOR.has(change.campo)) return `${label}: ${change.nuevo ? 'activada' : 'desactivada'}`;
  if (CONCEPTO_DINERO.has(change.campo)) return `${label}: ${formatMonto(change.anterior)} → ${formatMonto(change.nuevo)}`;
  return `${label}: ${change.anterior} → ${change.nuevo}`;
}

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

/** Formato numérico de las columnas de dinero, desde la fila 2 y sin fin (las filas nuevas nacen con formato). */
function historialFormatRequests(sheetId: number): sheets_v4.Schema$Request[] {
  return HISTORIAL_MONEY_COLUMNS.map((column) => {
    const index = HISTORIAL_COLUMNS.indexOf(column);
    return {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: index, endColumnIndex: index + 1 },
        cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '#,##0.00' } } },
        fields: 'userEnteredFormat.numberFormat',
      },
    };
  });
}

async function createHistorialSheet(): Promise<number> {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();

  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties(sheetId,title)' });
  const existingSheet = meta.data.sheets?.find((s) => s.properties?.title === HISTORIAL_SHEET_NAME);
  if (existingSheet?.properties?.sheetId !== undefined && existingSheet.properties.sheetId !== null) {
    const sheetId = existingSheet.properties.sheetId;
    // 1) Encabezado: si no coincide EXACTAMENTE con el orden esperado, se reescribe completo (A1:M1).
    const header = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${HISTORIAL_SHEET_NAME}!A1:${HISTORIAL_LAST_COLUMN}1` });
    const current = header.data.values?.[0] ?? [];
    if (!HISTORIAL_COLUMNS.every((label, index) => String(current[index] ?? '').trim() === label)) {
      await sheets.spreadsheets.values.update({
        spreadsheetId, range: `${HISTORIAL_SHEET_NAME}!A1:${HISTORIAL_LAST_COLUMN}1`, valueInputOption: 'RAW',
        requestBody: { values: [[...HISTORIAL_COLUMNS]] },
      });
    }
    // 2) Filas escritas con el orden anterior (campo en la columna E): se reacomodan a las columnas correctas.
    await repairLegacyHistorialRows(sheetId);
    // 3) Formato numérico de las columnas de dinero.
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: historialFormatRequests(sheetId) } });
    return sheetId;
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
        ...historialFormatRequests(sheetId),
      ],
    },
  });
  return sheetId;
}

interface HistorialValues {
  fecha: string; periodo: string; cedula: string; nombre: string;
  salario: number; campo: string; anterior: number; nuevo: number; deducciones: number; neto: number;
}

/** Celdas de una fila de historial, en el orden EXACTO de HISTORIAL_COLUMNS. */
function historialCells(v: HistorialValues): sheets_v4.Schema$CellData[] {
  const change: FieldChange = { campo: v.campo as FieldChange['campo'], anterior: v.anterior, nuevo: v.nuevo };
  const byColumn: Record<(typeof HISTORIAL_COLUMNS)[number], string | number> = {
    'FECHA': v.fecha,
    'QUINCENA': v.periodo,
    'CEDULA': v.cedula,
    'NOMBRE': v.nombre,
    'SALARIO MENSUAL': v.salario,
    'CONCEPTO DEDUCCION': conceptoTexto(change),
    'DEDUCCIONES TOTALES': v.deducciones,
    'NETO A PAGAR': v.neto,
    'deduccionesTotales': v.deducciones,
    'netoPagar': v.neto,
    'campo': v.campo,
    'valorAnterior': v.anterior,
    'valorNuevo': v.nuevo,
  };
  return HISTORIAL_COLUMNS.map((column) => cell(byColumn[column]));
}

function buildHistorialRow(fecha: string, periodo: string, item: DeduccionSaveItem, change: FieldChange): sheets_v4.Schema$RowData {
  const totals = calcularTotales(item.inputs);
  return {
    values: historialCells({
      fecha, periodo, cedula: item.cedula, nombre: item.nombre, salario: item.inputs.salarioMensual,
      campo: change.campo, anterior: change.anterior, nuevo: change.nuevo, deducciones: totals.totalDeducciones, neto: totals.netoPagar,
    }),
  };
}

/** Alta nueva: cada concepto de deducción con monto > 0 queda en el historial (antes 0), con su fecha. */
function altaChanges(inputs: PayrollInputs): FieldChange[] {
  const changes: FieldChange[] = DEDUCTION_CONCEPTS.filter((field) => inputs[field] > 0).map((field) => ({ campo: field, anterior: 0, nuevo: inputs[field] }));
  if (inputs.excluirINSS) changes.push({ campo: 'excluirINSS', anterior: 0, nuevo: 1 });
  if (inputs.aplicaIR) changes.push({ campo: 'aplicaIR', anterior: 0, nuevo: 1 });
  return changes;
}

export interface HistorialEntry {
  fecha: string; periodo: string; cedula: string; nombre: string; campo: string;
  valorAnterior: number | null; valorNuevo: number | null;
  salarioMensual: number | null; deduccionesTotales: number | null; netoPagar: number | null;
}

const CAMPOS_HISTORIAL = new Set(Object.keys(CONCEPTO_LABELS));

/** Formato anterior (sin columnas de la hoja actual): el nombre del campo (consumo, otros…) estaba en la columna E. */
function isLegacyHistorialRow(r: unknown[]): boolean {
  return typeof r[4] === 'string' && CAMPOS_HISTORIAL.has(r[4].trim());
}

function parseHistorialRow(r: unknown[]): HistorialEntry {
  const text = (value: unknown) => String(value ?? '');
  const num = (value: unknown) => { const n = readNumericCell(value); return typeof n === 'number' ? n : null; };
  const base = { fecha: text(r[0]), periodo: text(r[1]), cedula: normalizeCedula(r[2]), nombre: text(r[3]) };
  if (isLegacyHistorialRow(r)) {
    // Orden anterior: fecha, periodo, cedula, nombre, campo, valorAnterior, valorNuevo, salarioMensual, deduccionesTotales, netoPagar.
    return {
      ...base, campo: text(r[4]).trim(), valorAnterior: num(r[5]), valorNuevo: num(r[6]),
      salarioMensual: num(r[7]), deduccionesTotales: num(r[8]), netoPagar: num(r[9]),
    };
  }
  const at = (column: (typeof HISTORIAL_COLUMNS)[number]) => r[HISTORIAL_COLUMNS.indexOf(column)];
  return {
    ...base, campo: text(at('campo')).trim(), valorAnterior: num(at('valorAnterior')), valorNuevo: num(at('valorNuevo')),
    salarioMensual: num(at('SALARIO MENSUAL')),
    deduccionesTotales: num(at('DEDUCCIONES TOTALES')) ?? num(at('deduccionesTotales')),
    netoPagar: num(at('NETO A PAGAR')) ?? num(at('netoPagar')),
  };
}

/** Reescribe, en su misma fila, las filas con el orden anterior. Es idempotente: una fila ya corregida no se vuelve a tocar. */
async function repairLegacyHistorialRows(sheetId: number): Promise<void> {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId, range: `${HISTORIAL_SHEET_NAME}!A2:${HISTORIAL_LAST_COLUMN}`, valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const requests: sheets_v4.Schema$Request[] = [];
  ((response.data.values ?? []) as unknown[][]).forEach((r, index) => {
    if (!isLegacyHistorialRow(r)) return;
    const entry = parseHistorialRow(r);
    requests.push({
      updateCells: {
        range: { sheetId, startRowIndex: index + 1, endRowIndex: index + 2, startColumnIndex: 0, endColumnIndex: HISTORIAL_COLUMNS.length },
        rows: [{
          values: historialCells({
            fecha: entry.fecha, periodo: entry.periodo, cedula: entry.cedula, nombre: entry.nombre,
            salario: entry.salarioMensual ?? 0, campo: entry.campo, anterior: entry.valorAnterior ?? 0, nuevo: entry.valorNuevo ?? 0,
            deducciones: entry.deduccionesTotales ?? 0, neto: entry.netoPagar ?? 0,
          }),
        }],
        fields: 'userEnteredValue',
      },
    });
  });
  for (let i = 0; i < requests.length; i += 200) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: requests.slice(i, i + 200) } });
  }
}

/** Lee la bitácora (más reciente primero). No crea la pestaña: si aún no existe devuelve []. */
export async function getHistorial(periodo?: string, limit = 500): Promise<HistorialEntry[]> {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties(title)' });
  if (!meta.data.sheets?.some((s) => s.properties?.title === HISTORIAL_SHEET_NAME)) return [];
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId, range: `${HISTORIAL_SHEET_NAME}!A2:${HISTORIAL_LAST_COLUMN}`, valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const entries = ((response.data.values ?? []) as unknown[][])
    .map(parseHistorialRow)
    .filter((entry) => entry.fecha && (!periodo || entry.periodo === periodo))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  return entries.slice(0, limit);
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
  // Columna P: solo un 1 explícito activa el IR (filas anteriores a esta columna quedan sin IR).
  values.aplicaIR = readNumericCell(cellAt('aplicaIR')) === 1;
  values.excluirINSS = readNumericCell(cellAt('excluirINSS')) === 1; // vacío = cotiza
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
    if (column === 'aplicaIR') return cell(item.inputs.aplicaIR ? 1 : 0);
    if (column === 'excluirINSS') return cell(item.inputs.excluirINSS ? 1 : 0);
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
export interface UpsertResult {
  versiones: Record<string, string>;
  /** Fichas de empleado cuyo salario se actualizó porque se cambió en la deducción. */
  fichas: { cedula: string; salario: number }[];
  avisos: string[];
}

/** Contrato original: devuelve solo la nueva versión de cada cédula. */
export function upsertDeducciones(periodo: string, items: DeduccionSaveItem[]): Promise<Record<string, string>> {
  return upsertDeduccionesConDetalle(periodo, items).then((result) => result.versiones);
}

/** Igual que upsertDeducciones, pero además informa qué fichas de empleado se actualizaron y los avisos. */
export function upsertDeduccionesConDetalle(periodo: string, items: DeduccionSaveItem[]): Promise<UpsertResult> {
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
        } else {
          for (const change of altaChanges(item.inputs)) historialRows.push(buildHistorialRow(version, periodo, item, change));
        }
      } else {
        appended.push({ values: cells });
        for (const change of altaChanges(item.inputs)) historialRows.push(buildHistorialRow(version, periodo, item, change));
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

    const versiones = Object.fromEntries(items.map((item) => [item.cedula, version]));
    // La deducción ya quedó guardada; sincronizar con la ficha nunca debe hacerla fallar.
    const { fichas, avisos } = await syncSalariosHaciaFicha(periodo, items, existing);
    return { versiones, fichas, avisos };
  });
}

// ── Sincronización de salario ficha ⇄ DEDUCCIONES ───────────────────────────
//
// Regla común: solo se sincroniza la quincena VIGENTE en adelante. Los periodos anteriores son
// planillas ya pagadas y conservan el salario con que se pagaron.
// El salario solo afecta lo que se deriva de él (básico, vacaciones, valor de la hora extra, INSS, IR y
// provisiones, que se recalculan). Días, horas, otros ingresos, consumo, préstamo, comida y otros son
// montos propios de cada fila y NO se modifican.

/** Periodo (quincena) vigente hoy en Nicaragua (UTC-6, sin horario de verano), no en la hora del servidor. */
function currentPeriodoKeyNicaragua(): string {
  const local = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const fortnight = local.getUTCDate() <= 15 ? 'first' : 'second';
  return getPeriodoKey(local.getUTCFullYear(), local.getUTCMonth() + 1, fortnight);
}

/** Núcleo (sin cola de escritura: quien lo llama ya está dentro de una). */
async function applySalarioToDeducciones(
  sheetId: number, key: string, nombre: string, salario: number,
): Promise<{ actualizadas: number; periodos: string[] }> {
  const desde = currentPeriodoKeyNicaragua();
  // Claves AAAA-MM-first|second: el orden alfabético coincide con el cronológico ('first' < 'second').
  const seen = new Set<string>();
  const targets = (await readAllRows()).filter((row) => {
    if (row.cedula !== key || row.problem || !row.inputs || row.periodo < desde) return false;
    if (seen.has(row.periodo)) return false; // solo la primera fila de cada periodo (la vigente)
    seen.add(row.periodo);
    return row.inputs.salarioMensual !== salario;
  });
  if (targets.length === 0) return { actualizadas: 0, periodos: [] };

  const version = new Date().toISOString();
  const requests: sheets_v4.Schema$Request[] = [];
  const historialRows: sheets_v4.Schema$RowData[] = [];

  for (const row of targets) {
    const previous = row.inputs as PayrollInputs;
    const inputs = { ...previous, salarioMensual: salario };
    const item: DeduccionSaveItem = { cedula: key, nombre: row.nombre ?? sanitizeNombre(nombre) ?? nombre, inputs, version };
    requests.push({
      updateCells: {
        range: { sheetId, startRowIndex: row.rowNumber - 1, endRowIndex: row.rowNumber, startColumnIndex: 0, endColumnIndex: COLUMN_COUNT },
        rows: [{ values: buildRowCells(row.periodo, item, version) }],
        fields: 'userEnteredValue',
      },
    });
    for (const change of computeInputDiffs(previous, inputs)) {
      historialRows.push(buildHistorialRow(version, row.periodo, item, change));
    }
  }
  if (historialRows.length > 0) {
    const historialSheetId = await ensureHistorialSheet();
    requests.push({ appendCells: { sheetId: historialSheetId, rows: historialRows, fields: 'userEnteredValue' } });
  }
  await getSheets().spreadsheets.batchUpdate({ spreadsheetId: getSpreadsheetId(), requestBody: { requests } });
  return { actualizadas: targets.length, periodos: targets.map((row) => row.periodo) };
}

/** Ficha → DEDUCCIONES. Lo llama PUT /api/empleados/[id] cuando se edita el salario de la ficha. */
export function syncSalarioEnDeducciones(
  cedula: string, nombre: string, salario: number,
): Promise<{ actualizadas: number; periodos: string[] }> {
  return enqueueWrite(async () => {
    const key = normalizeCedula(cedula);
    if (!key || !Number.isFinite(salario) || salario <= 0) return { actualizadas: 0, periodos: [] };
    const sheetId = await ensureDeduccionesSheet();
    return applySalarioToDeducciones(sheetId, key, nombre, salario);
  });
}

/**
 * DEDUCCIONES → ficha. Se dispara solo si en ESTE guardado el salario cambió (frente a la fila guardada,
 * o frente a la ficha si la fila es nueva) y el periodo es el vigente o posterior. Editar una quincena vieja
 * (p. ej. corregir un consumo) nunca sobrescribe el salario actual de la ficha con uno antiguo.
 * Luego propaga el nuevo salario a las demás filas vigentes/futuras de esa cédula.
 */
async function syncSalariosHaciaFicha(
  periodo: string,
  items: DeduccionSaveItem[],
  existing: Map<string, StoredRow>,
): Promise<{ fichas: { cedula: string; salario: number }[]; avisos: string[] }> {
  const fichas: { cedula: string; salario: number }[] = [];
  const avisos: string[] = [];
  if (periodo < currentPeriodoKeyNicaragua()) return { fichas, avisos };

  const candidates = items.filter((item) => {
    const previous = existing.get(item.cedula);
    const previousSalary = previous && !previous.problem && previous.inputs ? previous.inputs.salarioMensual : null;
    return item.inputs.salarioMensual > 0 && previousSalary !== item.inputs.salarioMensual;
  });
  if (candidates.length === 0) return { fichas, avisos };

  try {
    const sheets = getSheets();
    const spreadsheetId = getSpreadsheetId();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId, range: `${SHEET_NAME}!B2:G`, valueRenderOption: 'UNFORMATTED_VALUE', // B = cédula … G = salario
    });
    const rows = (response.data.values ?? []) as unknown[][];
    const rowsByCedula = new Map<string, number[]>();
    rows.forEach((cells, index) => {
      const key = normalizeCedula(cells[0]);
      if (key) rowsByCedula.set(key, [...(rowsByCedula.get(key) ?? []), index]);
    });

    const data: sheets_v4.Schema$ValueRange[] = [];
    for (const item of candidates) {
      const matches = rowsByCedula.get(item.cedula);
      if (!matches || matches.length !== 1) {
        avisos.push(`No se actualizó la ficha de ${item.nombre}: ${!matches ? 'no se encontró la cédula' : 'la cédula está repetida'} en la hoja de empleados.`);
        continue;
      }
      const fichaSalary = parseMoney(rows[matches[0]][5]);
      if (fichaSalary !== null && fichaSalary === item.inputs.salarioMensual) continue;
      data.push({ range: `${SHEET_NAME}!G${matches[0] + 2}`, values: [[item.inputs.salarioMensual]] });
      fichas.push({ cedula: item.cedula, salario: item.inputs.salarioMensual });
    }
    if (data.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: 'RAW', data } });
      const sheetId = await ensureDeduccionesSheet();
      for (const ficha of fichas) {
        const nombre = candidates.find((item) => item.cedula === ficha.cedula)?.nombre ?? '';
        await applySalarioToDeducciones(sheetId, ficha.cedula, nombre, ficha.salario);
      }
    }
  } catch (error) {
    console.error('Error sincronizando salario hacia la ficha del empleado:', error);
    avisos.push('La deducción se guardó, pero no se pudo sincronizar el salario con la ficha del empleado.');
  }
  return { fichas, avisos };
}

/** Solo para pruebas unitarias (no usar desde la app). */
export const __testing = { buildRowCells, parseStoredRow, DEDUCCIONES_COLUMNS, MONEY_COLUMNS, buildHistorialRow, parseHistorialRow, isLegacyHistorialRow, conceptoTexto, HISTORIAL_COLUMNS };

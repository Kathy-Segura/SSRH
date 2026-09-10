import { google } from 'googleapis';

const SHEET_NAME = 'INDETERMINADO';
const RESTAURANTES_SHEET_NAME = 'Restaurantes';

function getAuth() {
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: key,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

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

// 👇 BLOQUE NUEVO — resuelve el bug de eliminar

// Cache del sheetId numérico de la pestaña de empleados (evita pedirlo en cada delete)
let cachedSheetId: number | null = null;

async function getSheetIdByName(
  sheets: ReturnType<typeof google.sheets>,
  sheetName: string
): Promise<number> {
  if (cachedSheetId !== null) return cachedSheetId;

  const meta = await sheets.spreadsheets.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
  });

  const sheet = meta.data.sheets?.find(
    (s) => s.properties?.title === sheetName
  );

  if (sheet?.properties?.sheetId === undefined || sheet?.properties?.sheetId === null) {
    throw new Error(`No se encontró la pestaña "${sheetName}" en el spreadsheet`);
  }

  cachedSheetId = sheet.properties.sheetId;
  return cachedSheetId;
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
import { google } from 'googleapis';

const SHEET_NAME = 'INDETERMINADO'; // Nombre exacto de la pestaña de empleados
const RESTAURANTES_SHEET_NAME = 'Restaurantes'; // Pestaña nueva: columna A = nombre del restaurante

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

// LEER: obtiene todas las filas de datos (omite la fila 1 de encabezados)
export async function getEmpleados(): Promise<string[][]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A2:W`,
  });

  return (response.data.values as string[][]) || [];
}

// CREAR: agrega una nueva fila al final del Sheet
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

// EDITAR: actualiza una fila específica por su índice
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

// ----- RESTAURANTES -----
// Nota: crea en tu Google Sheet una pestaña llamada "Restaurantes" con
// encabezado en A1 (p. ej. "Nombre") y los nombres a partir de A2.

// LEER: lista de nombres de restaurantes
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

// CREAR: agrega un nuevo restaurante a la pestaña
export async function appendRestaurante(nombre: string): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  // Leemos la columna A completa para calcular manualmente la siguiente
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${RESTAURANTES_SHEET_NAME}!A:A`,
  });

  const values = (response.data.values as string[][]) || [];
  // values.length incluye la fila de encabezado (A1).
  // Si hay 1 fila (solo encabezado) -> siguiente fila es la 2.
  // Si hay 3 filas (encabezado + 2 restaurantes) -> siguiente fila es la 4.
  const nextRow = values.length + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${RESTAURANTES_SHEET_NAME}!A${nextRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[nombre]] },
  });
}

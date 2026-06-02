import { google } from 'googleapis';

const SHEET_NAME = 'Empleados'; // Nombre exacto de la pestaña en tu Google Sheet

// Crea la autenticación usando las variables de entorno
function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

// LEER: obtiene todas las filas de datos (omite la fila 1 de encabezados)
export async function getEmpleados(): Promise<string[][]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A2:U`, // A hasta U, desde fila 2
  });

  return (response.data.values as string[][]) || [];
}

// CREAR: agrega una nueva fila al final del Sheet
export async function appendEmpleado(fila: string[]): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A:U`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [fila] },
  });
}

// EDITAR: actualiza una fila específica por su índice
// rowIndex 0 = fila 2 del Sheet (primera fila de datos)
// rowIndex 1 = fila 3 del Sheet, etc.
export async function updateEmpleado(rowIndex: number, fila: string[]): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const sheetRow = rowIndex + 2; // +2 porque fila 1 es encabezado y los índices empiezan en 0

  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A${sheetRow}:U${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [fila] },
  });
}

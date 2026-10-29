import { NextRequest, NextResponse } from 'next/server';
import { getCargos, appendCargo } from '@/lib/googleSheets';

// Siempre leer de la hoja: un cargo recién agregado debe verse de inmediato.
export const dynamic = 'force-dynamic';

const MAX_LENGTH = 60;

// GET /api/cargos -> cargos de RESTAURANTES!B + los ya usados en INDETERMINADO (sin duplicados)
export async function GET() {
  try {
    const cargos = await getCargos();
    return NextResponse.json({ cargos });
  } catch (error) {
    console.error('Error GET /api/cargos:', error);
    return NextResponse.json({ error: 'Error al obtener la lista de cargos' }, { status: 500 });
  }
}

// POST /api/cargos -> guarda un cargo nuevo en la columna Cargo de la hoja RESTAURANTES
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const nombre = String(body?.nombre ?? '').trim().replace(/\s+/g, ' ');

    if (!nombre) {
      return NextResponse.json({ error: 'El nombre del cargo es requerido' }, { status: 400 });
    }
    if (nombre.length > MAX_LENGTH) {
      return NextResponse.json({ error: `El cargo no puede superar ${MAX_LENGTH} caracteres` }, { status: 400 });
    }
    // Evita que Sheets interprete el texto como fórmula.
    if (/^[=+\-@]/.test(nombre)) {
      return NextResponse.json({ error: 'El cargo no puede empezar con =, +, - o @' }, { status: 400 });
    }

    const { nombre: guardado, existed } = await appendCargo(nombre);

    // Si ya existía (aunque con otras mayúsculas) se devuelve el nombre oficial para que el filtro lo seleccione.
    return NextResponse.json({ success: true, nombre: guardado, existed }, { status: existed ? 200 : 201 });
  } catch (error) {
    console.error('Error POST /api/cargos:', error);
    return NextResponse.json({ error: 'Error al guardar el cargo en Google Sheets' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getRestaurantes, appendRestaurante } from '@/lib/googleSheets';

// GET /api/restaurantes -> lista actual de restaurantes (para poblar el filtro al cargar la página)
export async function GET() {
  try {
    const restaurantes = await getRestaurantes();
    return NextResponse.json({ restaurantes });
  } catch (error) {
    console.error('Error GET /api/restaurantes:', error);
    return NextResponse.json(
      { error: 'Error al obtener la lista de restaurantes' },
      { status: 500 }
    );
  }
}

// POST /api/restaurantes -> guarda un restaurante nuevo en el Sheet
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const nombre = String(body?.nombre ?? '').trim().toUpperCase();

    if (!nombre) {
      return NextResponse.json(
        { error: 'El nombre del restaurante es requerido' },
        { status: 400 }
      );
    }

    const existentes = await getRestaurantes();
    if (existentes.includes(nombre)) {
      return NextResponse.json(
        { error: 'Ese restaurante ya existe' },
        { status: 409 }
      );
    }

    await appendRestaurante(nombre);

    return NextResponse.json({ success: true, nombre });
  } catch (error) {
    console.error('Error POST /api/restaurantes:', error);
    return NextResponse.json(
      { error: 'Error al guardar el restaurante en Google Sheets' },
      { status: 500 }
    );
  }
}

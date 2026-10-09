// Ruta: app/api/historial/route.ts
// GET /api/historial?periodo=2026-10-first   (sin "periodo" devuelve todos)
// Si tus otras rutas /api/deducciones validan sesión/rol, copia aquí la misma validación.
import { NextRequest, NextResponse } from 'next/server';
import { getHistorial } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const periodo = request.nextUrl.searchParams.get('periodo') ?? undefined;
    if (periodo && !/^\d{4}-\d{2}-(first|second)$/.test(periodo)) {
      return NextResponse.json({ error: 'Periodo inválido' }, { status: 400 });
    }
    const historial = await getHistorial(periodo);
    return NextResponse.json({ historial });
  } catch (error) {
    console.error('Error leyendo el historial de deducciones:', error);
    return NextResponse.json({ error: 'No se pudo leer el historial de deducciones.' }, { status: 500 });
  }
}

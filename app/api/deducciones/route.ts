import { NextRequest, NextResponse } from 'next/server';
import {
  DeduccionesConflictError,
  getDeducciones,
  SheetConfigError,
  upsertDeducciones,
} from '@/lib/googleSheets';
import { getPeriodoKey, PAYROLL_CONSTANTS } from '@/lib/payroll-calculations';
import {
  coercePayrollInputs,
  MAX_ROWS_PER_SAVE,
  normalizeCedula,
  parsePeriodParams,
  validatePayrollInputs,
  type DeduccionSaveItem,
  type FieldErrors,
} from '@/lib/payroll-validation';

// googleapis requiere Node (no Edge) y estos datos nunca deben quedar en caché.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

function handleUnexpected(error: unknown, action: string) {
  console.error(`Error ${action} /api/deducciones:`, error);
  if (error instanceof SheetConfigError) return json({ error: error.message }, 500);
  return json({ error: `Error al ${action === 'GET' ? 'obtener' : 'guardar'} las deducciones en Google Sheets` }, 500);
}

// GET /api/deducciones?year=2026&month=9&fortnight=first
// Devuelve lo guardado en la hoja DEDUCCIONES para ese periodo, por cédula.
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const period = parsePeriodParams(params.get('year'), params.get('month'), params.get('fortnight'));
    if (!period.ok) return json({ error: period.error }, 400);

    const periodo = getPeriodoKey(period.value.year, period.value.month, period.value.fortnight);
    const { registros, problemas } = await getDeducciones(periodo);

    return json({ periodo, deducciones: registros, advertencias: problemas });
  } catch (error) {
    return handleUnexpected(error, 'GET');
  }
}

// POST /api/deducciones
// body: { year, month, fortnight, filas: { cedula, inputs, version }[] }
// Inserta/actualiza únicamente las filas enviadas; no borra ni toca las demás del periodo.
export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json().catch(() => null);
    if (typeof body !== 'object' || body === null) return json({ error: 'Cuerpo JSON inválido' }, 400);
    const payload = body as Record<string, unknown>;

    const period = parsePeriodParams(payload.year, payload.month, payload.fortnight);
    if (!period.ok) return json({ error: period.error }, 400);

    const filas = payload.filas;
    if (!Array.isArray(filas) || filas.length === 0) return json({ error: 'filas debe ser un arreglo con al menos un elemento' }, 400);
    if (filas.length > MAX_ROWS_PER_SAVE) return json({ error: `Máximo ${MAX_ROWS_PER_SAVE} filas por guardado` }, 400);

    const items: DeduccionSaveItem[] = [];
    const invalid: { cedula: string; errores: FieldErrors }[] = [];
    const seen = new Set<string>();

    for (const raw of filas as Record<string, unknown>[]) {
      const cedula = normalizeCedula(raw?.cedula);
      const inputs = coercePayrollInputs(raw?.inputs);
      const version = raw?.version === null || typeof raw?.version === 'string' ? (raw.version as string | null) : undefined;

      if (!cedula) return json({ error: 'Todas las filas deben incluir cédula' }, 400);
      if (seen.has(cedula)) return json({ error: `Cédula repetida en el envío: ${cedula}` }, 400);
      if (!inputs) return json({ error: `Datos incompletos o no numéricos para la cédula ${cedula}` }, 400);
      if (version === undefined) return json({ error: `Falta version para la cédula ${cedula} (null si es un registro nuevo)` }, 400);
      seen.add(cedula);

      // Tope de días por seguridad: el máximo de una quincena. El front aplica además el tope por fechas de ingreso/egreso.
      const errores = validatePayrollInputs(inputs, PAYROLL_CONSTANTS.fortnightDays);
      if (Object.keys(errores).length > 0) invalid.push({ cedula, errores });
      else items.push({ cedula, inputs, version });
    }

    // Todo o nada: si una fila es inválida no se guarda ninguna.
    if (invalid.length > 0) {
      return json({ error: `${invalid.length} fila(s) no pasaron la validación`, detalles: invalid }, 422);
    }

    const periodo = getPeriodoKey(period.value.year, period.value.month, period.value.fortnight);
    try {
      const versiones = await upsertDeducciones(periodo, items);
      return json({ success: true, periodo, guardados: items.length, versiones });
    } catch (error) {
      if (error instanceof DeduccionesConflictError) {
        return json(
          {
            error: 'Otra persona modificó estos registros después de que usted los cargó. Recargue el periodo antes de guardar.',
            conflictos: error.cedulas,
          },
          409
        );
      }
      throw error;
    }
  } catch (error) {
    return handleUnexpected(error, 'POST');
  }
}

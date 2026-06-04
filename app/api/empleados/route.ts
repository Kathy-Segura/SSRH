import { NextResponse } from 'next/server';
import { getEmpleados, appendEmpleado } from '@/lib/googleSheets';

// GET /api/empleados — carga todos los empleados desde Google Sheets
export async function GET() {
  try {
    const filas = await getEmpleados();

    const empleados = filas
      .filter((fila) => fila[0]) // ignorar filas completamente vacías
      .map((fila, index) => {
        const fechaRetiro = (fila[20] || '').toString().trim();

        // Columna W = Estado
        const estadoGuardado = (fila[22] || 'activo')
          .toString()
          .trim()
          .toLowerCase();

        return {
          id: String(index), // índice de fila para edición

          nombreCompleto: fila[0] || '',
          cedula: fila[1] || '',
          fechaIngreso: fila[2] || '',
          fechaEgreso: fila[3] || '',
          cargo: fila[4] || '',
          restaurante: fila[5] || '',
          salario: fila[6] || '',
          beneficios: fila[7] || '',
          cumpleanos: fila[8] || '',
          direccion: fila[9] || '',
          numeroTelefono: fila[10] || '',
          numeroEmergencia: fila[11] || '',
          barrioCafe: fila[12] || '',
          df: fila[13] || '',
          laContentera: fila[14] || '',
          foodStop: fila[15] || '',
          observaciones: fila[16] || '',
          inss: fila[17] || '',
          cuentaBac: fila[18] || '',
          diasTrabajados: fila[19]
            ? Number(fila[19])
            : 0,

          fechaRetiro,
          estadoCivil: fila[21] || 'soltero',

          // Prioridad:
          // 1. Si tiene fecha de retiro => inactivo
          // 2. Si no tiene fecha de retiro => usar valor guardado en la hoja
          estado: fechaRetiro
            ? 'inactivo'
            : estadoGuardado === 'inactivo'
              ? 'inactivo'
              : 'activo',
        };
      });

    return NextResponse.json({ empleados });

  } catch (error) {
    console.error('Error GET /api/empleados:', error);

    return NextResponse.json(
      {
        error: 'Error al obtener empleados desde Google Sheets',
      },
      {
        status: 500,
      }
    );
  }
}

// POST /api/empleados — registra un nuevo empleado en Google Sheets
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validación básica de campos requeridos
    if (!body.nombreCompleto || !body.cedula) {
      return NextResponse.json(
        { error: 'Nombre completo y cédula son requeridos' },
        { status: 400 }
      );
    }

    // Armar la fila en el mismo orden que los encabezados del Sheet
    const fila = [
      body.nombreCompleto,              // A: Nombres y Apellidos
      body.cedula,                      // B: Cédula
      body.fechaIngreso       || '',    // C: Fecha Ingreso
      body.fechaEgreso        || '',    // D: Fecha Egreso
      body.cargo              || '',    // E: Cargo
      body.restaurante        || '',    // F: Restaurante
      body.salario            || '',    // G: Salario
      body.beneficios         || '',    // H: Beneficios
      body.cumpleanos         || '',    // I: Cumpleaños
      body.direccion          || '',    // J: Dirección
      body.numeroTelefono     || '',    // K: Teléfono
      body.numeroEmergencia   || '',    // L: Teléfono Emergencia
      body.barrioCafe         || '',    // M: Barrio Café
      body.df                 || '',    // N: DF
      body.laContentera       || '',    // Ñ: La Contentera
      body.foodStop           || '',    // O: Food Stop
      body.observaciones      || '',    // P: Observaciones
      body.inss               || '',    // Q: INSS
      body.cuentaBac          || '',    // R: Cuenta BAC
      body.diasTrabajados     || '0',   // S: Días Trabajados
      body.fechaRetiro        || '',    // T: Fecha Retiro
      body.estadoCivil        || '',    // U: Estado Civil
      body.estado             || 'activo', // V: Estado
    ];

    await appendEmpleado(fila);

    return NextResponse.json({ success: true, message: 'Empleado registrado correctamente' });

  } catch (error) {
    console.error('Error POST /api/empleados:', error);
    return NextResponse.json(
      { error: 'Error al registrar empleado en Google Sheets' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { getEmpleados, appendEmpleado } from '@/lib/googleSheets';

// GET /api/empleados — carga todos los empleados desde Google Sheets
export async function GET() {
  try {
    const filas = await getEmpleados();

    const empleados = filas
      .filter((fila) => fila[0]) // ignorar filas completamente vacías
      .map((fila, index) => ({
        id: String(index),                  // el índice = número de fila (para edición)
        nombreCompleto:     fila[0]  || '',
        cedula:             fila[1]  || '',
        fechaIngreso:       fila[2]  || '',
        fechaEgreso:        fila[3]  || '',
        cargo:              fila[4]  || '',
        restaurante:        fila[5]  || '',
        cumpleanos:         fila[6]  || '',
        direccion:          fila[7]  || '',
        numeroTelefono:     fila[8]  || '',
        numeroEmergencia:   fila[9]  || '',
        barrioCafe:         fila[10] || '',
        df:                 fila[11] || '',
        laContentera:       fila[12] || '',
        foodStop:           fila[13] || '',
        observaciones:      fila[14] || '',
        inss:               fila[15] || '',
        cuentaBac:          fila[16] || '',
        diasTrabajados:     fila[17] ? Number(fila[17]) : 0,
        fechaRetiro:        fila[18] || '',
        estadoCivil:        fila[19] || 'soltero',
        barrio:             fila[20] || '',
        // Estado: si tiene fecha de retiro → inactivo, si no → activo
        estado:             (fila[18] ? 'inactivo' : 'activo') as 'activo' | 'inactivo',
      }));

    return NextResponse.json({ empleados });

  } catch (error) {
    console.error('Error GET /api/empleados:', error);
    return NextResponse.json(
      { error: 'Error al obtener empleados desde Google Sheets' },
      { status: 500 }
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
      body.cumpleanos         || '',    // G: Cumpleaños
      body.direccion          || '',    // H: Dirección
      body.numeroTelefono     || '',    // I: Teléfono
      body.numeroEmergencia   || '',    // J: Teléfono Emergencia
      body.barrioCafe         || '',    // K: Barrio Café
      body.df                 || '',    // L: DF
      body.laContentera       || '',    // M: La Contentera
      body.foodStop           || '',    // N: Food Stop
      body.observaciones      || '',    // O: Observaciones
      body.inss               || '',    // P: INSS
      body.cuentaBac          || '',    // Q: Cuenta BAC
      body.diasTrabajados     || '0',   // R: Días Trabajados
      body.fechaRetiro        || '',    // S: Fecha Retiro
      body.estadoCivil        || '',    // T: Estado Civil
      body.barrio             || '',    // U: Barrio
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

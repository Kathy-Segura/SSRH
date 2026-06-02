import { NextResponse } from 'next/server';
import { getEmpleados, appendEmpleado } from '@/lib/googleSheets';

// GET /api/empleados — el frontend llama esto para cargar la tabla
export async function GET() {
  try {
    const filas = await getEmpleados();

    const empleados = filas.map((fila, index) => ({
      id: index,
      nombre:              fila[0]  || '',
      cedula:              fila[1]  || '',
      fechaIngreso:        fila[2]  || '',
      fechaEgreso:         fila[3]  || '',
      cargo:               fila[4]  || '',
      restaurante:         fila[5]  || '',
      cumpleanos:          fila[6]  || '',
      direccion:           fila[7]  || '',
      telefono:            fila[8]  || '',
      telefonoEmergencia:  fila[9]  || '',
      barrioCafe:          fila[10] || '',
      df:                  fila[11] || '',
      laContentera:        fila[12] || '',
      foodStop:            fila[13] || '',
      observaciones:       fila[14] || '',
      inss:                fila[15] || '',
      cuentaBAC:           fila[16] || '',
      diasTrabajados:      fila[17] || '',
      fechaRetiro:         fila[18] || '',
      estadoCivil:         fila[19] || '',
      // Si tiene fecha de retiro = INACTIVO, si no = ACTIVO
      estado: fila[18] ? 'INACTIVO' : 'ACTIVO',
    }));

    return NextResponse.json({ empleados });

  } catch (error) {
    return NextResponse.json(
      { error: 'Error al obtener empleados' },
      { status: 500 }
    );
  }
}

// POST /api/empleados — el frontend llama esto al guardar un nuevo empleado
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const fila = [
      body.nombre,              // A
      body.cedula,              // B
      body.fechaIngreso,        // C
      body.fechaEgreso,         // D
      body.cargo,               // E
      body.restaurante,         // F
      body.cumpleanos,          // G
      body.direccion,           // H
      body.telefono,            // I
      body.telefonoEmergencia,  // J
      body.barrioCafe,          // K
      body.df,                  // L
      body.laContentera,        // M
      body.foodStop,            // N
      body.observaciones,       // O
      body.inss,                // P
      body.cuentaBAC,           // Q
      body.diasTrabajados,      // R
      body.fechaRetiro,         // S
      body.estadoCivil,         // T
      body.fechaRetiro ? 'INACTIVO' : 'ACTIVO', // U
    ];

    await appendEmpleado(fila);
    return NextResponse.json({ success: true });

  } catch (error) {
    return NextResponse.json(
      { error: 'Error al registrar empleado' },
      { status: 500 }
    );
  }
}
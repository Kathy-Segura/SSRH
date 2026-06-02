import { NextRequest, NextResponse } from 'next/server';
import { updateEmpleado } from '@/lib/googleSheets';

export async function PUT(
  request: NextRequest,                          // ← NextRequest en vez de Request
  context: { params: Promise<unknown> }          // ← Promise<unknown> como lo espera Next.js 15
) {
  try {
    const { id } = context.params as unknown as { id: string }; // ← cast aquí
    // NO necesita await porque lo casteamos directamente
    const rowIndex = parseInt(id, 10);

    if (isNaN(rowIndex) || rowIndex < 0) {
      return NextResponse.json(
        { error: 'ID de empleado inválido' },
        { status: 400 }
      );
    }

    const body = await request.json();

    if (!body.nombreCompleto || !body.cedula) {
      return NextResponse.json(
        { error: 'Nombre completo y cédula son requeridos' },
        { status: 400 }
      );
    }

    const fila = [
      body.nombreCompleto,
      body.cedula,
      body.fechaIngreso     || '',
      body.fechaEgreso      || '',
      body.cargo            || '',
      body.restaurante      || '',
      body.cumpleanos       || '',
      body.direccion        || '',
      body.numeroTelefono   || '',
      body.numeroEmergencia || '',
      body.barrioCafe       || '',
      body.df               || '',
      body.laContentera     || '',
      body.foodStop         || '',
      body.observaciones    || '',
      body.inss             || '',
      body.cuentaBac        || '',
      body.diasTrabajados   || '0',
      body.fechaRetiro      || '',
      body.estadoCivil      || '',
      body.barrio           || '',
    ];

    await updateEmpleado(rowIndex, fila);

    return NextResponse.json({ success: true, message: 'Empleado actualizado correctamente' });

  } catch (error) {
    console.error('Error PUT /api/empleados/[id]:', error);
    return NextResponse.json(
      { error: 'Error al actualizar empleado en Google Sheets' },
      { status: 500 }
    );
  }
}
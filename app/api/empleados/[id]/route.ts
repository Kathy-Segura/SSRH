import { NextRequest, NextResponse } from 'next/server';
import { updateEmpleado, deleteEmpleado, syncSalarioEnDeducciones } from '@/lib/googleSheets';
import { parseMoney } from '@/lib/money';
// src/app/api/empleados/[id]/route.ts

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
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

    // Salario como número (no como texto) para que la hoja lo guarde como número y las fórmulas funcionen.
    const salario = parseMoney(body.salario);

    const fila = [
      body.nombreCompleto,
      body.cedula,
      body.fechaIngreso     || '',
      body.fechaEgreso      || '',
      body.cargo            || '',
      body.restaurante      || '',
      salario ?? '',
      body.beneficios       || '',
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
      body.estado           || 'activo',
    ];

    await updateEmpleado(rowIndex, fila);

    // Propaga el salario a las filas ya guardadas en DEDUCCIONES (quincena vigente en adelante).
    // Si esto falla, la ficha ya quedó guardada: se avisa en la respuesta en vez de mostrar un falso error.
    let deducciones: { ok: boolean; actualizadas?: number; periodos?: string[]; error?: string } | undefined;
    if (salario !== null && salario > 0) {
      try {
        const sync = await syncSalarioEnDeducciones(String(body.cedula), String(body.nombreCompleto), salario);
        deducciones = { ok: true, ...sync };
      } catch (syncError) {
        console.error('Error sincronizando salario en DEDUCCIONES:', syncError);
        deducciones = { ok: false, error: 'La ficha se guardó, pero no se pudo actualizar el salario en la hoja DEDUCCIONES.' };
      }
    }

    return NextResponse.json({ success: true, message: 'Empleado actualizado correctamente', deducciones });

  } catch (error) {
    console.error('Error PUT /api/empleados/[id]:', error);
    return NextResponse.json(
      { error: 'Error al actualizar empleado en Google Sheets' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const rowIndex = parseInt(id, 10);

    if (isNaN(rowIndex) || rowIndex < 0) {
      return NextResponse.json(
        { error: 'ID de empleado inválido' },
        { status: 400 }
      );
    }

    await deleteEmpleado(rowIndex);

    return NextResponse.json({ success: true, message: 'Empleado eliminado correctamente' });

  } catch (error) {
    console.error('Error DELETE /api/empleados/[id]:', error);
    return NextResponse.json(
      { error: 'No se pudo eliminar el empleado' },
      { status: 500 }
    );
  }
}
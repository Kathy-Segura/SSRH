/**
 * Motivos de salida: lista FIJA (no editable desde la app).
 * Fuente única de verdad: la usan el filtro, las rutas /api/empleados y la
 * validación de la columna MOTIVO SALIDA de la hoja INDETERMINADO.
 */
export const MOTIVOS_SALIDA = ['Renuncia inmediata', 'Renuncia Preaviso', 'Despido'] as const;

export type MotivoSalida = (typeof MOTIVOS_SALIDA)[number];

export function isMotivoSalida(value: unknown): value is MotivoSalida {
  return typeof value === 'string' && (MOTIVOS_SALIDA as readonly string[]).includes(value);
}

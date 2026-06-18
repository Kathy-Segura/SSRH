/**
 * Calcula los días trabajados según las fechas del empleado.
 * - Si hay fechaEgreso: cuenta desde fechaEgreso hasta fechaRetiro (o hoy).
 * - Si no hay fechaEgreso: cuenta desde fechaIngreso hasta fechaRetiro (o hoy).
 * - Detalle importante, si no se establece una fecha de retiro el contador --
 *   -- contará hasta la fecha del dia actual lo cual generará un incremento 
 * 
 */
export function calcularDiasTrabajados(
  fechaIngreso?: string,
  fechaEgreso?: string,
  fechaRetiro?: string
): number {
  // Parsea una fecha "YYYY-MM-DD" como fecha local (evita desfase por UTC)
  const parseLocal = (str: string): Date => {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }; 

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const fin = fechaRetiro ? parseLocal(fechaRetiro) : hoy;

  let inicio: Date | null = null;

  if (fechaEgreso) {
    // Reinicio del conteo desde la fecha de egreso
    inicio = parseLocal(fechaEgreso);
  } else if (fechaIngreso) {
    inicio = parseLocal(fechaIngreso);
  }

  if (!inicio || fin < inicio) return 0;

  const diffMs = fin.getTime() - inicio.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
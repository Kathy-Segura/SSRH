export interface Employee {
  id: string;
  nombreCompleto: string;
  cedula: string;
  fechaIngreso: string;
  fechaEgreso: string;
  cargo: string;
  restaurante: 'DF' | 'Barrio Café' | 'La Contentera' | 'Food Stop';
  cumpleanos: string;
  direccion: string;
  numeroTelefono: string;
  numeroEmergencia: string;
  barrio: string;
  inss: string;
  cuentaBac: string;
  diasTrabajados: number;
  fechaRetiro: string;
  observaciones: string;
  estadoCivil: 'soltero' | 'casado' | 'divorciado' | 'viudo';
  estado: 'activo' | 'inactivo';
}

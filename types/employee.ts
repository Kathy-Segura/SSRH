export interface Employee {
  id: string;
  nombreCompleto: string;
  cedula: string;
  fechaIngreso: string;
  fechaEgreso: string;
  cargo: string;
  restaurante:  'AJÍ' |'DF' | 'ADMIN' |'BARRIO CAFÉ' | 'LA CONTENTERA';
  salario: number;
  beneficios: string;
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

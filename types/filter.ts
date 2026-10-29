export interface FilterState {
  nombre: string;
  cedula: string;
  inss: string;
  estadoCivil: string;
  estado: string;
  restaurante: string;
  cargo: string; // 'all' o el nombre exacto del cargo
  motivoSalida: string; // 'all' o uno de MOTIVOS_SALIDA
  mescumple: string;
  mesIngreso: string; // 'all' o '01'-'12'
}

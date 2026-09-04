'use client';
/**
  COMPONENTE ENCARGADO DE FILTRAR TODOS LOS DATOS DE UN EMPLEADO
  REALIZA BUSQUEDA POR CAMPOS COMO:
  --NOMBRE
  --CEDULA
  --INSS
  --ESTADO
  --ESTADO CIVIL
  --RESTAURANTE
  --MES(CUMPLEAÑOS)
  --MES(INGRESO)
*/

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FilterState } from '@/types/filter';
import { Search, X, Plus, Check, Loader2 } from 'lucide-react';

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onSearch: () => void;
  onClear: () => void;
  /** Lista de restaurantes: SIEMPRE debe venir del padre (leída desde /api/restaurantes -> Google Sheet).
   *  Es la fuente de verdad; ya no hay una lista local "temporal". */
  restaurantes: string[];
  /**
   * Persiste el nuevo restaurante en el backend (Google Sheet).
   * Debe lanzar un error si falla, y el padre debe actualizar su estado
   * `restaurantes` cuando la promesa resuelve, para que el cambio se
   * propague a este componente y a cualquier otro filtro que lo use.
   */
  onAddRestaurante: (nombre: string) => Promise<void>;
}

const MESES = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];

export function FilterBar({
  filters,
  onFiltersChange,
  onSearch,
  onClear,
  restaurantes,
  onAddRestaurante,
}: FilterBarProps) {
  const [showAddRestaurante, setShowAddRestaurante] = useState(false);
  const [nuevoRestaurante, setNuevoRestaurante] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (field: keyof FilterState, value: string) => {
    onFiltersChange({
      ...filters,
      [field]: value,
    });
  };

  const handleConfirmAddRestaurante = async () => {
    const nombre = nuevoRestaurante.trim().toUpperCase();
    if (!nombre) return;

    if (restaurantes.includes(nombre)) {
      // Ya existe: simplemente lo seleccionamos, no hace falta guardarlo de nuevo.
      handleInputChange('restaurante', nombre);
      setNuevoRestaurante('');
      setShowAddRestaurante(false);
      setError(null);
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      // Espera a que quede guardado en el Google Sheet antes de continuar.
      await onAddRestaurante(nombre);

      // Al resolver, el padre ya habrá actualizado `restaurantes`, así que
      // seleccionarlo aquí lo deja disponible de inmediato para filtrar.
      handleInputChange('restaurante', nombre);
      setNuevoRestaurante('');
      setShowAddRestaurante(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el restaurante');
    } finally {
      setGuardando(false);
    }
  };

  const handleCancelAddRestaurante = () => {
    setNuevoRestaurante('');
    setShowAddRestaurante(false);
    setError(null);
  };

  return (
    <div className="space-y-4 p-6 bg-card border border-border rounded-lg">
      <h2 className="text-lg font-semibold text-foreground">Filtros de Búsqueda</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Nombre */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Nombre</label>
          <Input
            placeholder="Buscar por nombre..."
            value={filters.nombre}
            onChange={(e) => handleInputChange('nombre', e.target.value)}
            className="bg-background"
          />
        </div>

        {/* INSS */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">INSS</label>
          <Input
            placeholder="Buscar por INSS..."
            value={filters.inss}
            onChange={(e) => handleInputChange('inss', e.target.value)}
            className="bg-background"
          />
        </div>

        {/* Cumpleaños (Mes) */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Mes (Cumpleaños)</label>
          <Select
            value={filters.mescumple}
            onValueChange={(value) => handleInputChange('mescumple', value)}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Seleccionar un mes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {MESES.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Fecha de Ingreso (Mes) */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Mes (Ingreso)</label>
          <Select
            value={filters.mesIngreso}
            onValueChange={(value) => handleInputChange('mesIngreso', value)}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Seleccionar un mes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {MESES.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Restaurante */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Restaurante</label>

          <div className="flex gap-2">
            <Select
              value={filters.restaurante}
              onValueChange={(value) => handleInputChange('restaurante', value)}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Seleccionar restaurante" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {/* La lista ahora sale siempre de `restaurantes` (prop del padre,
                    que viene del Google Sheet), así que cualquier restaurante
                    nuevo aparece aquí sin recargar la página. */}
                {restaurantes.map((nombre) => (
                  <SelectItem key={nombre} value={nombre}>
                    {nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => setShowAddRestaurante((prev) => !prev)}
              title="Agregar restaurante"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {showAddRestaurante && (
            <div className="flex flex-col gap-1 pt-1">
              <div className="flex gap-2">
                <Input
                  autoFocus
                  placeholder="Nombre del nuevo restaurante"
                  value={nuevoRestaurante}
                  onChange={(e) => setNuevoRestaurante(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleConfirmAddRestaurante();
                    }
                    if (e.key === 'Escape') {
                      handleCancelAddRestaurante();
                    }
                  }}
                  disabled={guardando}
                  className="bg-background"
                />
                <Button
                  type="button"
                  size="icon"
                  className="shrink-0"
                  onClick={handleConfirmAddRestaurante}
                  disabled={guardando || !nuevoRestaurante.trim()}
                  title="Confirmar"
                >
                  {guardando ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={handleCancelAddRestaurante}
                  disabled={guardando}
                  title="Cancelar"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}
        </div>

        {/* Estado */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Estado</label>
          <Select value={filters.estado} onValueChange={(value) => handleInputChange('estado', value)}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Seleccionar estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="activo">Activo</SelectItem>
              <SelectItem value="inactivo">Inactivo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Estado Civil */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Estado Civil</label>
          <Select value={filters.estadoCivil} onValueChange={(value) => handleInputChange('estadoCivil', value)}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Seleccionar estado civil" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="soltero">Soltero/a</SelectItem>
              <SelectItem value="casado">Casado/a</SelectItem>
              <SelectItem value="divorciado">Divorciado/a</SelectItem>
              <SelectItem value="viudo">Viudo/a</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex flex-wrap gap-2 pt-4">
        <Button onClick={onSearch} variant="outline" className="gap-2">
          <Search className="w-4 h-4" />
          Buscar
        </Button>
        <Button onClick={onClear} variant="outline" className="gap-2">
          <X className="w-4 h-4" />
          Limpiar
        </Button>
      </div>
    </div>
  );
}

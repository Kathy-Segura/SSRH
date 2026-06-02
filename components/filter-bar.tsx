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
/**/

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
import { Search, X } from 'lucide-react';

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onSearch: () => void;
  onClear: () => void;
}

export function FilterBar({
  filters,
  onFiltersChange,
  onSearch,
  onClear,
}: FilterBarProps) {
  const handleInputChange = (field: keyof FilterState, value: string) => {
    onFiltersChange({
      ...filters,
      [field]: value,
    });
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

        {/* Cédula */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Cédula</label>
          <Input
            placeholder="Buscar por cédula..."
            value={filters.cedula}
            onChange={(e) => handleInputChange('cedula', e.target.value)}
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

        {/* Restaurante */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Restaurante</label>
          <Select value={filters.restaurante} onValueChange={(value) => handleInputChange('restaurante', value)}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Seleccionar restaurante" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="DF">DF</SelectItem>
              <SelectItem value="Barrio Café">Barrio Café</SelectItem>
              <SelectItem value="La Contentera">La Contentera</SelectItem>
              <SelectItem value="Food Stop">Food Stop</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex flex-wrap gap-2 pt-4">
        <Button
          onClick={onSearch}
          variant="outline"
          className="gap-2"
        >
          <Search className="w-4 h-4" />
          Buscar
        </Button>
        <Button
          onClick={onClear}
          variant="outline"
          className="gap-2"
        >
          <X className="w-4 h-4" />
          Limpiar
        </Button>
      </div>
    </div>
  );
}

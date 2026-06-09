'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { TopNavbar } from '@/components/top-navbar';
import { HorizontalMenu } from '@/components/horizontal-menu';
import { EmployeeTable } from '@/components/employee-table';
import { FilterBar } from '@/components/filter-bar';
import { EmployeeFormModal } from '@/components/employee-form-modal';
import { PaginationControls } from '@/components/pagination-controls';
import { PrintDialog } from '@/components/print-dialog';
import { EmployeeModal } from '@/components/employee-modal';
import { Employee } from '@/types/employee';
import { FilterState } from '@/types/filter';
import { Printer, ChevronUp, Plus, RefreshCw, AlertCircle } from 'lucide-react';

// funcion contadora de indices en el campo cedula
const getMesDesdeCedula = (cedula: string): string => {
  const tieneGuion = cedula.includes('-');
  return tieneGuion ? cedula.substring(6, 8) : cedula.substring(5, 7);
};

export default function Home() {
  // ─── Estado de datos ───────────────────────────────────────────────────────
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ─── Estado de UI ──────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<FilterState>({
    nombre: '',
    cedula: '',
    inss: '',
    estadoCivil: '',
    estado: '',
    restaurante: '',
    mescumple: '',
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | undefined>();
  const [activeSection, setActiveSection] = useState('employees');

  // ─── Cargar empleados desde la API ────────────────────────────────────────
  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/empleados');
      if (!response.ok) {
        throw new Error(`Error ${response.status}: No se pudo cargar los empleados`);
      }
      const data = await response.json();
      setEmployees(data.empleados || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido al cargar datos');
      setEmployees([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Cargar datos al montar el componente
  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // ─── Filtrar empleados ─────────────────────────────────────────────────────
    const filteredEmployees = useMemo(() => {
  return employees.filter((employee) => {
    const matchNombre = employee.nombreCompleto
      .toLowerCase()
      .includes(filters.nombre.toLowerCase());
    const matchCedula = employee.cedula
      .toLowerCase()
      .includes(filters.cedula.toLowerCase());
    const matchINSS = employee.inss
      .toLowerCase()
      .includes(filters.inss.toLowerCase());
    const matchEstadoCivil =
      !filters.estadoCivil ||
      filters.estadoCivil === 'all' ||
      employee.estadoCivil === filters.estadoCivil;
    const matchEstado =
      !filters.estado ||
      filters.estado === 'all' ||
      employee.estado === filters.estado;
    const matchRestaurante =
      !filters.restaurante ||
      filters.restaurante === 'all' ||
      employee.restaurante === filters.restaurante;

    // ← Ahora usa la función en lugar del substring fijo
    const mesCedula = getMesDesdeCedula(employee.cedula);
    const matchMesCumple =
      !filters.mescumple ||
      filters.mescumple === 'all' ||
      mesCedula === filters.mescumple;

    return (
      matchNombre &&
      matchCedula &&
      matchINSS &&
      matchEstadoCivil &&
      matchEstado &&
      matchRestaurante &&
      matchMesCumple
    );
  });
}, [employees, filters]);

   
  // ─── Paginación ────────────────────────────────────────────────────────────
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const paginatedEmployees = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredEmployees.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredEmployees, currentPage, itemsPerPage]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  // Registrar nuevo empleado → POST a la API → recarga lista
  const handleAddEmployee = async (employee: Employee) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/empleados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employee),
      });
      if (!response.ok) {
        throw new Error('No se pudo registrar el empleado');
      }
      // Recarga la lista desde Google Sheets para reflejar el nuevo registro
      await fetchEmployees();
      setIsFormModalOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al registrar empleado');
    } finally {
      setIsSaving(false);
    }
  };

  // Abrir modal de edición
  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsModalOpen(true);
  };

  // Guardar edición → PUT a la API → recarga lista
  const handleSaveEmployee = async (updatedEmployee: Employee) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/empleados/${updatedEmployee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedEmployee),
      });
      if (!response.ok) {
        throw new Error('No se pudo actualizar el empleado');
      }
      // Recarga la lista desde Google Sheets
      await fetchEmployees();
      setIsModalOpen(false);
      setSelectedEmployee(undefined);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al actualizar empleado');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSearch = () => setCurrentPage(1);

  const handleClearFilters = () => {
    setFilters({
      nombre: '',
      cedula: '',
      inss: '',
      estadoCivil: '',
      estado: '',
      restaurante: '',
      mescumple: '',
    });
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => setCurrentPage(page);

  const handleItemsPerPageChange = (items: number) => {
    setItemsPerPage(items);
    setCurrentPage(1);
  };

  // ─── Contadores para badges ────────────────────────────────────────────────
  const totalActivos = employees.filter((e) => e.estado === 'activo').length;
  const totalInactivos = employees.filter((e) => e.estado === 'inactivo').length;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top Navbar */}
      <TopNavbar />

      {/* Horizontal Menu */}
      <HorizontalMenu
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        isOpen={true}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {activeSection === 'employees' && (
            <>
              {/* Banner de error */}
              {error && (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium">Error al cargar datos</p>
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchEmployees}
                    className="border-red-300 text-red-700 hover:bg-red-100"
                  >
                    <RefreshCw className="w-4 h-4 mr-1" /> Reintentar
                  </Button>
                </div>
              )}

              {/* Badges de resumen */}
              {!isLoading && !error && (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-muted-foreground">
                    Total: <strong>{employees.length}</strong> empleados
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    ● {totalActivos} Activos
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    ● {totalInactivos} Inactivos
                  </span>
                </div>
              )}

              {/* Barra de filtros retráctil */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">Filtros</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                    className="text-foreground hover:bg-[#80CED7]/10 text-[#80CED7]"
                  >
                    <ChevronUp
                      className={`w-4 h-4 transition-transform ${isFilterOpen ? '' : 'rotate-180'}`}
                    />
                  </Button>
                </div>
                {isFilterOpen && (
                  <FilterBar
                    filters={filters}
                    onFiltersChange={setFilters}
                    onSearch={handleSearch}
                    onClear={handleClearFilters}
                  />
                )}
              </div>

              {/* Botones de acción */}
              <div className="flex justify-end gap-3 flex-wrap">
                <Button
                  onClick={fetchEmployees}
                  variant="outline"
                  className="gap-2"
                  disabled={isLoading}
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  {isLoading ? 'Cargando...' : 'Actualizar'}
                </Button>
                <Button
                  onClick={() => setIsFormModalOpen(true)}
                  className="bg-[#80CED7] hover:bg-[#007EA7] text-white gap-2"
                  disabled={isLoading}
                >
                  <Plus className="w-4 h-4" />
                  Registrar Empleado
                </Button>
                <Button
                  onClick={() => setIsPrintDialogOpen(true)}
                  className="bg-[#80CED7] hover:bg-[#007EA7] text-white gap-2"
                  disabled={isLoading}
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Reporte
                </Button>
              </div>

              {/* Tabla de empleados */}
              <EmployeeTable
                employees={paginatedEmployees}
                isLoading={isLoading}
                onEdit={handleEditEmployee}
              />

              {/* Controles de paginación */}
              {!isLoading && filteredEmployees.length > 0 && (
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                  itemsPerPage={itemsPerPage}
                  totalItems={filteredEmployees.length}
                  onPageChange={handlePageChange}
                  onItemsPerPageChange={handleItemsPerPageChange}
                />
              )}
            </>
          )}

          {activeSection === 'reports' && (
            <div className="bg-white rounded-lg p-8 text-center">
              <h2 className="text-2xl font-bold text-foreground">Reportes</h2>
              <p className="text-muted-foreground mt-4">Esta sección está en desarrollo</p>
            </div>
          )}

          {activeSection === 'settings' && (
            <div className="bg-white rounded-lg p-8 text-center">
              <h2 className="text-2xl font-bold text-foreground">Configuración</h2>
              <p className="text-muted-foreground mt-4">Esta sección está en desarrollo</p>
            </div>
          )}
        </div>
      </main>

      {/* Print Dialog */}
      <PrintDialog
        isOpen={isPrintDialogOpen}
        onClose={() => setIsPrintDialogOpen(false)}
        employees={filteredEmployees}
        filters={{ ...filters }}
      />

      {/* Modal: Registrar nuevo empleado */}
      <EmployeeFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleAddEmployee}
      />

      {/* Modal: Editar empleado existente */}
      <EmployeeModal
        isOpen={isModalOpen}
        employee={selectedEmployee}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedEmployee(undefined);
        }}
        onSave={handleSaveEmployee}
      />
    </div>
  );
}

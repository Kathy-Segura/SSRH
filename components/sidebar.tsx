'use client';
/**
  COMPONENTE ENCARGADO DEL HEADER DE LA PAGINA Y DISÑO RESPONSIVE.
/**/
import { Users, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(true);

  const sections = [
    { id: 'employees', label: 'Registro de Empleados', icon: Users },
  ];

  return (
    <>
      {/* Sidebar Desktop */}
      <div
        className={cn(
          'hidden lg:flex flex-col bg-gradient-to-b from-primary via-primary to-secondary text-primary-foreground w-64 min-h-screen transition-all duration-300 sticky top-0 shadow-xl',
          !isOpen && 'w-20'
        )}
      >
        {/* Header */}
        <div className="p-6 border-b border-primary-foreground/10 backdrop-blur-sm bg-white/5">
          <div className="flex items-center justify-between gap-3">
            <div className={cn('flex items-center gap-3', !isOpen && 'justify-center')}>
              <div className="w-10 h-10 rounded-lg bg-accent/20 border border-accent flex items-center justify-center shadow-sm">
                <Users className="w-6 h-6 text-accent" />
              </div>
              {isOpen && (
                <div>
                  <h1 className="text-lg font-bold tracking-tight">RRHH</h1>
                  <p className="text-xs text-primary-foreground/50 font-medium">Sistema</p>
                </div>
              )}
            </div>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-1 hover:bg-primary-foreground/10 rounded-lg transition-all hover:scale-110"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => onSectionChange(section.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                  activeSection === section.id
                    ? 'bg-white/20 text-primary-foreground shadow-md backdrop-blur-sm border border-white/30'
                    : 'hover:bg-white/10 text-primary-foreground hover:backdrop-blur-sm'
                )}
                title={section.label}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {isOpen && <span className="text-sm font-semibold">{section.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-primary-foreground/10 backdrop-blur-sm bg-white/5">
          <p className={cn('text-xs text-primary-foreground/50 font-medium', !isOpen && 'text-center')}>
            {isOpen ? '© 2026 RRHH' : '©'}
          </p>
        </div>
      </div>

      {/* Mobile Sidebar Toggle */}
      <div className="lg:hidden fixed bottom-4 right-4 z-40">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/40 z-20 top-0 left-0 backdrop-blur-sm">
          <div className="bg-gradient-to-b from-primary via-primary to-secondary text-primary-foreground w-64 min-h-screen p-6 space-y-6 shadow-2xl">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-accent/20 border border-accent flex items-center justify-center shadow-sm">
                  <Users className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h1 className="text-lg font-bold tracking-tight">RRHH</h1>
                  <p className="text-xs text-primary-foreground/50 font-medium">Sistema</p>
                </div>
              </div>
            </div>

            <nav className="space-y-2">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => {
                      onSectionChange(section.id);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                      activeSection === section.id
                        ? 'bg-white/20 text-primary-foreground shadow-md backdrop-blur-sm border border-white/30'
                        : 'hover:bg-white/10 text-primary-foreground hover:backdrop-blur-sm'
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-semibold">{section.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

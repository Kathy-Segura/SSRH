'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Download, X } from 'lucide-react';

export function PreviewButton() {
  const [isOpen, setIsOpen] = useState(false);

  const handleDescargar = () => {
    const link = document.createElement('a');
    link.href = '/guia-proyecto.pdf';
    link.download = 'guia-proyecto.pdf';
    link.click();
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="bg-[#80CED7] hover:bg-[#007EA7] text-white gap-2"
      >
        <FileText className="w-4 h-4" />
        Documentación
      </Button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="relative bg-white rounded-xl shadow-2xl flex flex-col"
            style={{ width: '90vw', maxWidth: 1100, height: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-5 py-3 rounded-t-xl"
              style={{ background: '#0a4d72' }}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-white" />
                <span className="text-white font-semibold text-sm">
                  Guía del Proyecto
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDescargar}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md text-white font-medium transition-colors"
                  style={{ background: '#0e7bb5' }}
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar PDF
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white/70 hover:text-white transition-colors p-1 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden rounded-b-xl bg-gray-100">
              <iframe
                src="/documento_SSRH.pdf"
                className="w-full h-full rounded-b-xl"
                title="Configuración"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
// src/lib/money.ts
// Convierte lo que devuelve/recibe la hoja ("12000", "12,000.50", "C$ 12.000,50") a número.
// Devuelve null si no hay un monto legible (NUNCA 0 por error: un salario ilegible no debe pagarse como 0).
export function parseMoney(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let text = String(value ?? '').replace(/[^\d.,-]/g, '');
  if (!text || !/\d/.test(text)) return null;

  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    // Ambos separadores: el último es el decimal.
    text = lastComma > lastDot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  } else if (lastComma !== -1) {
    // Solo coma: "12,000" (miles) vs "12,5" / "12,50" (decimal)
    text = /^-?\d{1,3}(,\d{3})+$/.test(text) ? text.replace(/,/g, '') : text.replace(',', '.');
  } else if (lastDot !== -1) {
    // Solo punto: "12.000" (miles, estilo es-NI/es-ES) vs "12.50" (decimal)
    if (/^-?\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, '');
  }
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

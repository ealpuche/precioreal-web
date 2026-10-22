/**
 * Datos del sitio que aparecen en varias páginas. Un solo lugar para que la portada, el pie y
 * "Datos para negocios" no se contradigan.
 */

export const TELEGRAM_URL = "https://t.me/precioreal_mx";
export const CONTACT_EMAIL = "hola@precioreal.mx";

/**
 * Cobertura publicada. Productos activos de Cyberpuerta medidos en Neon el 2026-10-20: 30,577
 * (Notion → Producto). Se redondea hacia abajo a propósito: la frase dice "más de" y debe
 * seguir siendo cierta aunque el catálogo baje un poco. No se lee el índice en build: pesa
 * 21 MB y haría que el build dependa de la red (#21).
 */
export const COBERTURA = {
  tienda: "Cyberpuerta",
  productos: "30,000",
  medidoEl: "2026-10-20",
} as const;

/** Ficha real que la portada usa de ejemplo. Debe existir en el feed. */
export const FICHA_EJEMPLO = {
  tienda: "cyberpuerta",
  slug: "KPM-610B",
  nombre: "Klip Xtreme Soporte de Techo para Proyector KPM-610B",
} as const;

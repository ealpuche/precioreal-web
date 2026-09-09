/**
 * Normalización de URLs de producto para compararlas contra el índice del catálogo.
 *
 * Medido contra el índice en producción (2026-09-09): sus 22,762 URLs comparten host
 * (`https://www.cyberpuerta.mx`) y ninguna lleva query string. Así que normalizar es tratar lo
 * que el usuario pega —parámetros de campaña, `http`, `www` ausente, barra final, mayúsculas
 * de host— no variantes del propio índice.
 *
 * La ruta conserva mayúsculas: los slugs de Cyberpuerta las usan y el path de una URL es
 * case-sensitive (RFC 3986).
 */
export function normalizeProductUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const path = parsed.pathname.replace(/\/+$/, "");
  return `${host}${path}`;
}

/** Lo que el usuario pegó ¿parece una URL, aunque no sea válida? Decide qué mensaje ve. */
export function looksLikeUrl(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  return t.includes("://") || (t.includes(".") === true && t.includes("/"));
}

/**
 * Tiendas cuyo dominio reconocemos pero cuyo catálogo aún no se publica en R2. Se rastrean en
 * la base, así que decir "no las rastreamos" sería falso; el mensaje habla de disponibilidad
 * en el sitio, no de cobertura.
 */
const TIENDAS_CONOCIDAS_NO_PUBLICADAS: Record<string, string> = {
  "liverpool.com.mx": "Liverpool",
  "mercadolibre.com.mx": "MercadoLibre",
  "innovasport.com": "Innovasport",
};

/** Nombre de la tienda si la reconocemos pero no está publicada; null en cualquier otro caso. */
export function tiendaNoPublicada(normalizedUrl: string): string | null {
  const host = normalizedUrl.split("/")[0];
  for (const [dominio, nombre] of Object.entries(
    TIENDAS_CONOCIDAS_NO_PUBLICADAS,
  )) {
    if (host === dominio || host.endsWith(`.${dominio}`)) return nombre;
  }
  return null;
}

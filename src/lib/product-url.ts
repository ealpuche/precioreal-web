/**
 * Normalización de URLs de producto para compararlas contra el índice del catálogo.
 *
 * Medido contra el índice en producción (2026-09-09): sus 31,520 URLs comparten host
 * (`https://www.cyberpuerta.mx`) y ninguna lleva query string. Así que normalizar es tratar lo
 * que el usuario pega —parámetros de campaña, `http`, `www` ausente, barra final, mayúsculas
 * de host— no variantes del propio índice. Lo que una hoja de compartir pone alrededor del
 * enlace lo trata `normalizePastedUrl`, que `/buscar` usa en vez de esta.
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

// Primer enlace http(s) dentro de un texto. Compartir desde el navegador del teléfono pega
// "nombre del producto + enlace", a veces con el enlace en su propia línea; `new URL` sobre
// ese texto lanzaba y la búsqueda terminaba en "ilegible" con el enlace correcto adentro
// (#42: 36 de 92 búsquedas por enlace entre el 2 y el 22 de octubre).
const ENLACE_EN_TEXTO = /https?:\/\/\S+/i;

// Puntuación, comillas (rectas, tipográficas, guillemets) y marcas de WhatsApp (`*…*`,
// `_…_`) que una frase pega al final de un enlace. Las URLs del índice terminan en `.html`,
// así que quitarlas nunca rompe una real.
const PUNTUACION_FINAL = new Set([...'".,;:!?)]"\'»>”’…*_']);

// Recorre desde el final en vez de `/[…]+$/`: esa expresión reintenta desde cada posición y
// con 16 KB de puntos seguidos de una letra tardaba ~350 ms por llamada (medido en Node,
// CR PR #62 ronda 2). Así es lineal.
function sinPuntuacionFinal(s: string): string {
  let fin = s.length;
  while (fin > 0 && PUNTUACION_FINAL.has(s[fin - 1])) fin--;
  return s.slice(0, fin);
}

/**
 * Normaliza lo que el usuario pegó: el enlace que haya dentro del texto, o el texto entero
 * si no trae uno. Sin enlace y con espacios devuelve null: es un nombre tecleado, no una
 * URL (antes salía null solo porque `new URL` lanzaba, y "cyberpuerta.mx/x.html Dell"
 * pasaba con el espacio codificado como `%20`).
 *
 * Solo para la entrada del usuario. El recorrido del índice en `catalog.ts` usa
 * `normalizeProductUrl` directo: sus 31,903 URLs son canónicas y no necesitan el regex
 * (CR PR #62, evidencia insuficiente 2).
 */
export function normalizePastedUrl(raw: string): string | null {
  const enlace = ENLACE_EN_TEXTO.exec(raw)?.[0] ?? raw.trim();
  const candidato = sinPuntuacionFinal(enlace);
  if (!candidato || /\s/.test(candidato)) return null;
  return normalizeProductUrl(candidato);
}

/**
 * Lo que el usuario pegó ¿parece una URL, aunque no sea válida? Decide el modo de la
 * búsqueda (`url` o `texto`) y con él el mensaje y la fila de D1: un nombre tecleado es
 * demanda de búsqueda por nombre (#15), no un enlace que fallamos en leer (#42).
 *
 * Es enlace si trae `http(s)://` en cualquier parte, o si es una sola palabra con un punto
 * (`cyberpuerta.mx`, `cyberpuerta.mx/Laptops/x.html`). "Monitor LG 27 pulg." tiene punto
 * pero también espacios y ningún esquema: es texto.
 */
export function looksLikeUrl(raw: string): boolean {
  const t = raw.trim();
  if (ENLACE_EN_TEXTO.test(t)) return true;
  return !/\s/.test(t) && t.includes(".");
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
  for (const [dominio, nombre] of Object.entries(
    TIENDAS_CONOCIDAS_NO_PUBLICADAS,
  )) {
    if (hostPertenece(normalizedUrl, dominio)) return nombre;
  }
  return null;
}

/**
 * ¿El host de una URL ya normalizada pertenece a este dominio, como raíz o como subdominio?
 *
 * Existe porque `/buscar` comparaba Cyberpuerta con `startsWith("cyberpuerta.mx/")` mientras
 * `tiendaNoPublicada`, en este mismo archivo, aceptaba subdominios: una URL sin ruta o de un
 * subdominio recibía "solo tenemos historial de Cyberpuerta" siendo justo esa la tienda
 * pegada (CR PR #11, H5).
 */
export function hostPertenece(normalizedUrl: string, dominio: string): boolean {
  const host = normalizedUrl.split("/")[0];
  return host === dominio || host.endsWith(`.${dominio}`);
}

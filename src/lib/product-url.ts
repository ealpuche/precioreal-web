/**
 * Normalización de URLs de producto para compararlas contra el índice del catálogo.
 *
 * Medido contra el índice en producción (2026-09-09): sus 31,520 URLs comparten host
 * (`https://www.cyberpuerta.mx`) y ninguna lleva query string. Así que normalizar es tratar lo
 * que el usuario pega —parámetros de campaña, `http`, `www` ausente, barra final, mayúsculas
 * de host, y el texto que una hoja de compartir pone alrededor del enlace— no variantes del
 * propio índice.
 *
 * La ruta conserva mayúsculas: los slugs de Cyberpuerta las usan y el path de una URL es
 * case-sensitive (RFC 3986).
 */

// Primer enlace http(s) dentro de un texto. Compartir desde el navegador del teléfono pega
// "nombre del producto + enlace", a veces con el enlace en su propia línea; `new URL` sobre
// ese texto lanzaba y la búsqueda terminaba en "ilegible" con el enlace correcto adentro
// (#42: 36 de 92 búsquedas por enlace entre el 2 y el 22 de octubre).
const ENLACE_EN_TEXTO = /https?:\/\/\S+/i;

// Puntuación que una frase pega al final de un enlace ("(…html)." ). Las URLs del índice
// terminan en `.html`, así que quitar un punto final nunca rompe una real.
const PUNTUACION_FINAL = /[.,;:)\]]+$/;

/** El enlace que hay dentro de lo que el usuario pegó, o el texto entero si no trae uno. */
function candidatoAUrl(raw: string): string {
  const enlace = ENLACE_EN_TEXTO.exec(raw)?.[0] ?? raw.trim();
  return enlace.replace(PUNTUACION_FINAL, "");
}

export function normalizeProductUrl(raw: string): string | null {
  const candidato = candidatoAUrl(raw);
  // Sin enlace dentro y con espacios, es un nombre tecleado, no una URL. Antes esto salía
  // null porque `new URL` lanzaba; ahora es la regla, para que no dependa del parser.
  if (!candidato || /\s/.test(candidato)) return null;

  let parsed: URL;
  try {
    parsed = new URL(
      candidato.includes("://") ? candidato : `https://${candidato}`,
    );
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const path = parsed.pathname.replace(/\/+$/, "");
  return `${host}${path}`;
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

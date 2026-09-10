import type { CatalogIndex, CatalogProduct } from "../contracts/catalog";
import { normalizeProductUrl } from "./product-url";
import { SKU_RE } from "./sku";

const FEED_BASE = "https://feed.precioreal.mx";

// Único slug real hoy (catalog.md: ddtech, pcel después). Sin esta guarda, cualquier ruta de
// dos segmentos —incluido el ruido de escáneres contra /wp-admin, /.env, etc.— disparaba una
// invocación de worker más una lectura a R2 antes de responder 404 (CR PR #7, H3 ronda 1).
const TIENDAS_VALIDAS = new Set(["cyberpuerta"]);

// Sin esto, un upstream que se cuelga (no responde ni falla) deja la respuesta bloqueada hasta
// que el runtime corte la invocación: el usuario no ve ni el 502 ni contenido (CR PR #7, H2).
const UPSTREAM_TIMEOUT_MS = 5000;

export type FetchProductResult =
  | { ok: true; product: CatalogProduct }
  | { ok: false; reason: "not_found" | "invalid_route" | "upstream_error" };

/**
 * Valida los campos que la página realmente consume. No es una validación completa del
 * contrato —los strings de precio y fecha no se comprueban parseables, eso exigiría una
 * librería de esquemas (issue #6)— pero sí cubre todo lo que produciría basura visible bajo
 * un 200: sin `max_90d` las coordenadas del SVG salen NaN y la gráfica queda vacía; sin `sku`,
 * `site` u `obs` la cabecera imprime "undefined" (CR PR #7, H3 y ronda 4).
 */
function hasExpectedShape(value: unknown): value is CatalogProduct {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const current = v.current as Record<string, unknown> | undefined;

  const baseOk =
    typeof v.sku === "string" &&
    typeof v.site === "string" &&
    typeof v.name === "string" &&
    typeof v.url === "string" &&
    typeof v.obs === "number" &&
    typeof v.window_days === "number" &&
    Array.isArray(v.series) &&
    v.series.every(
      (pt) =>
        Array.isArray(pt) &&
        typeof pt[0] === "string" &&
        typeof pt[1] === "string",
    ) &&
    typeof current?.price === "string" &&
    typeof current?.since === "string" &&
    typeof current?.available === "boolean" &&
    (v.is_from_price === undefined || typeof v.is_from_price === "boolean") &&
    (v.first_seen_at === undefined || typeof v.first_seen_at === "string") &&
    (v.status === undefined ||
      v.status === "ok" ||
      v.status === "insufficient_history");
  if (!baseOk) return false;

  // Ausentes o strings, nunca otra cosa: el contrato dice que el productor no las emite con
  // este estado, pero la guarda existe justamente para no confiar en eso. Un número truthy
  // pasaría a la ficha y de ahí al SVG (CR PR #10, H4 y Copilot).
  const optionalString = (x: unknown) =>
    x === undefined || typeof x === "string";
  if (v.status === "insufficient_history") {
    return (
      optionalString(v.typical_90d) &&
      optionalString(v.min_90d) &&
      optionalString(v.max_90d)
    );
  }
  return (
    typeof v.typical_90d === "string" &&
    typeof v.min_90d === "string" &&
    typeof v.max_90d === "string"
  );
}

/**
 * Trae la ficha de un producto desde R2. No lanza. Tres casos de fallo, cada uno con su
 * mensaje: `invalid_route` (tienda o sku que no pueden existir — información local, no hace
 * falta preguntarle a R2), `not_found` (404 real del feed) y `upstream_error` (red, 5xx,
 * JSON inválido o forma inesperada).
 */
export async function fetchProduct(
  tienda: string,
  sku: string,
): Promise<FetchProductResult> {
  if (!TIENDAS_VALIDAS.has(tienda) || !SKU_RE.test(sku)) {
    return { ok: false, reason: "invalid_route" };
  }
  const url = `${FEED_BASE}/${encodeURIComponent(tienda)}/products/${encodeURIComponent(sku)}.json`;
  let res: Response;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, reason: "upstream_error" };
  }
  if (res.status === 404) {
    return { ok: false, reason: "not_found" };
  }
  if (!res.ok) {
    return { ok: false, reason: "upstream_error" };
  }
  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    return { ok: false, reason: "upstream_error" };
  }
  if (!hasExpectedShape(parsed)) {
    return { ok: false, reason: "upstream_error" };
  }
  return { ok: true, product: parsed };
}

/**
 * Índice cacheado por isolate, no por request: en Cloudflare el módulo sobrevive entre
 * invocaciones. Un fallo NO se cachea — la versión anterior guardaba la promesa resuelta a
 * `null`, y como toda Promise es truthy, un timeout de 5 s o un 5xx puntual de R2 dejaba la
 * búsqueda por URL rota hasta que el isolate se reciclara, sin límite observable
 * (CR PR #11, H1 y Copilot).
 *
 * Va por tienda aunque hoy solo exista cyberpuerta: la firma recibe `tienda`, así que un
 * caché global haría que la primera en llegar fijara el índice de todas.
 * También lo consume la generación de sitemaps.
 */
const indexCache = new Map<string, Promise<CatalogIndex | null>>();

// Sin TTL, un isolate caliente serviría indefinidamente el primer índice que leyó.
// Para /buscar eso es tolerable —una ficha nueva tarda en aparecer—, pero el sitemap
// anuncia `Cache-Control: max-age=14400` y su valor entero es que Google descubra
// fichas nuevas: un sitemap congelado es exactamente el fallo que #16 evita
// (CR PR #19, H2 y Copilot).
const INDEX_TTL_MS = 4 * 3600 * 1000;
const indexCacheAt = new Map<string, number>();

export async function fetchIndex(tienda: string): Promise<CatalogIndex | null> {
  const cached = indexCache.get(tienda);
  const cachedAt = indexCacheAt.get(tienda);
  if (
    cached &&
    cachedAt !== undefined &&
    Date.now() - cachedAt < INDEX_TTL_MS
  ) {
    return cached;
  }

  const pending = (async () => {
    try {
      const res = await fetch(
        `${FEED_BASE}/${encodeURIComponent(tienda)}/products/index.json`,
        { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) },
      );
      if (!res.ok) return null;
      const parsed = (await res.json()) as CatalogIndex;
      return Array.isArray(parsed?.products) ? parsed : null;
    } catch {
      return null;
    }
  })();

  // Se cachea la promesa en vuelo para que dos búsquedas simultáneas no pidan el índice dos
  // veces, y se descarta si resultó fallida: el siguiente intento vuelve a preguntar.
  indexCache.set(tienda, pending);
  indexCacheAt.set(tienda, Date.now());
  const result = await pending;
  if (result === null) indexCache.delete(tienda);
  if (result === null) indexCacheAt.delete(tienda);
  return result;
}

export type ResolveUrlResult =
  | { ok: true; sku: string }
  | { ok: false; reason: "not_found" | "upstream_error" };

/**
 * Encuentra el sku cuyo `url` en el índice coincide con la que pegó el usuario.
 *
 * Corre en el worker y no en el navegador a propósito: el índice pesa ~2.7 MB gzip y le llega
 * al worker desde el caché de borde (verificado: cf-cache-status HIT). Resolverlo aquí hace
 * que el usuario reciba un redirect en vez de esos megabytes, que en móvil con datos serían
 * el coste de cada búsqueda.
 */
export async function resolveProductUrl(
  tienda: string,
  normalizedUrl: string,
): Promise<ResolveUrlResult> {
  if (!TIENDAS_VALIDAS.has(tienda)) {
    return { ok: false, reason: "not_found" };
  }
  const index = await fetchIndex(tienda);
  if (!index) return { ok: false, reason: "upstream_error" };

  for (const p of index.products) {
    // `Array.isArray(products)` no dice nada de sus elementos: `products: [null]` lanzaba al
    // leer `p.url`, y una entrada con `sku` no-string redirigía a `/cyberpuerta/undefined`
    // (CR PR #11, Copilot).
    if (
      typeof p?.url !== "string" ||
      typeof p?.sku !== "string" ||
      p.sku === ""
    ) {
      continue;
    }
    if (normalizeProductUrl(p.url) === normalizedUrl) {
      // El slug y no el sku: la ficha vive bajo la clave que el productor publica, que para
      // los skus con espacios o caracteres sustituidos no es el sku. Devolver el sku daba un
      // 404 en 3,377 productos —el 65% de las tarjetas madre— porque los fabricantes de
      // componentes usan nombres comerciales con espacios como identificador (#13).
      // Opcional mientras el backfill propaga: sin él, el sku es lo que se usaba antes y
      // sigue siendo correcto para los que ya podían ir en una ruta.
      const clave =
        typeof p.slug === "string" && p.slug !== "" ? p.slug : p.sku;
      // Sin slug y con un sku que no cabe en una ruta no hay destino posible: mejor "no
      // encontramos ese producto" en /buscar que un redirect a un 404 garantizado, que además
      // gasta una invocación de worker y muestra el mensaje equivocado (CR PR #14, H2 y
      // Copilot). Pasa durante la propagación del backfill, cuando una ficha aún no reescrita
      // no trae `slug`.
      if (!SKU_RE.test(clave)) {
        return { ok: false, reason: "not_found" };
      }
      return { ok: true, sku: clave };
    }
  }
  return { ok: false, reason: "not_found" };
}

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

// Forma mínima del binding de R2 que este módulo usa (mismo criterio que `EventsDb`: el
// proyecto no depende de @cloudflare/workers-types). `get` resuelve a null cuando la clave
// no existe.
export type CatalogBucket = {
  get(key: string): Promise<{ json(): Promise<unknown> } | null>;
};

// Subconjunto estructural de `locals.runtime`. Todo es opcional: el binding `CATALOG` se
// crea a mano en el dashboard de Pages, así que puede no existir (tests, un preview sin
// configurar, producción antes de crearlo o después de quitarlo para revertir).
export type CatalogRuntime = { env?: { CATALOG?: unknown } } | undefined;

export type CatalogSource = "r2" | "http";

/** Cabecera de diagnóstico: por qué vía lee el catálogo el worker que respondió (#67). */
export const CATALOG_SOURCE_HEADER = "X-Catalog-Source";

// Con forma de bucket y no solo "definido": una variable de texto llamada CATALOG creada
// por error en el dashboard no debe convertir cada ficha en un 502.
function catalogBucket(runtime: CatalogRuntime): CatalogBucket | null {
  const bucket = runtime?.env?.CATALOG as CatalogBucket | undefined;
  return typeof bucket?.get === "function" ? bucket : null;
}

/**
 * Vía por la que se lee el catálogo: el binding de R2 si existe, HTTP a feed.precioreal.mx
 * si no. Con binding nunca se cae a HTTP, ni siquiera ante un error: el objetivo de #67 es
 * que las páginas SSR no dependan de las reglas de seguridad de la zona, y un respaldo
 * silencioso escondería un binding roto hasta el siguiente bloqueo.
 */
export function catalogSource(runtime: CatalogRuntime): CatalogSource {
  return catalogBucket(runtime) ? "r2" : "http";
}

type Lectura =
  { estado: "ok"; data: unknown } | { estado: "ausente" } | { estado: "error" };

// El binding no acepta AbortSignal: el mismo límite que la vía HTTP se impone con una
// carrera, y cubre también la lectura del cuerpo.
async function conLimite<T>(promesa: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  try {
    return await Promise.race([promesa, limite]);
  } finally {
    clearTimeout(timer);
  }
}

async function leerPorBinding(
  bucket: CatalogBucket,
  key: string,
): Promise<Lectura> {
  try {
    return await conLimite(
      (async (): Promise<Lectura> => {
        const objeto = await bucket.get(key);
        if (objeto === null) return { estado: "ausente" };
        return { estado: "ok", data: await objeto.json() };
      })(),
      UPSTREAM_TIMEOUT_MS,
    );
  } catch (err) {
    // Solo el mensaje del error: un binding mal enlazado se ve en la consola del worker
    // en vez de parecer un fallo cualquiera del catálogo.
    console.error(
      JSON.stringify({
        t: "catalog_error",
        via: "r2",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return { estado: "error" };
  }
}

async function leerPorHttp(tienda: string, archivo: string): Promise<Lectura> {
  try {
    const res = await fetch(
      `${FEED_BASE}/${encodeURIComponent(tienda)}/products/${encodeURIComponent(archivo)}`,
      { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) },
    );
    if (res.status === 404) return { estado: "ausente" };
    if (!res.ok) return { estado: "error" };
    return { estado: "ok", data: await res.json() };
  } catch {
    return { estado: "error" };
  }
}

/**
 * Lee `{tienda}/products/{archivo}` del catálogo. No lanza. La clave de R2 es la ruta del
 * feed sin codificar: feed.precioreal.mx sirve la raíz del bucket y el productor escribe
 * esas mismas claves (specs/contracts/catalog.md).
 */
function leerCatalogo(
  runtime: CatalogRuntime,
  tienda: string,
  archivo: string,
): Promise<Lectura> {
  const bucket = catalogBucket(runtime);
  return bucket
    ? leerPorBinding(bucket, `${tienda}/products/${archivo}`)
    : leerPorHttp(tienda, archivo);
}

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
 * falta preguntarle a R2), `not_found` (la clave no existe: null del binding o 404 del feed)
 * y `upstream_error` (binding o red, 5xx, JSON inválido o forma inesperada).
 *
 * `runtime` es `locals.runtime`: con el binding `CATALOG` se lee por R2; sin él, por HTTP.
 */
export async function fetchProduct(
  tienda: string,
  sku: string,
  runtime?: CatalogRuntime,
): Promise<FetchProductResult> {
  if (!TIENDAS_VALIDAS.has(tienda) || !SKU_RE.test(sku)) {
    return { ok: false, reason: "invalid_route" };
  }
  const lectura = await leerCatalogo(runtime, tienda, `${sku}.json`);
  if (lectura.estado === "ausente") {
    return { ok: false, reason: "not_found" };
  }
  if (lectura.estado === "error" || !hasExpectedShape(lectura.data)) {
    return { ok: false, reason: "upstream_error" };
  }
  return { ok: true, product: lectura.data };
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

export async function fetchIndex(
  tienda: string,
  runtime?: CatalogRuntime,
): Promise<CatalogIndex | null> {
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
    const lectura = await leerCatalogo(runtime, tienda, "index.json");
    if (lectura.estado !== "ok") return null;
    const parsed = lectura.data as CatalogIndex;
    return Array.isArray(parsed?.products) ? parsed : null;
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
 * Corre en el worker y no en el navegador a propósito: resolverlo aquí hace que el usuario
 * reciba un redirect en vez del índice completo, que en móvil con datos sería el coste de
 * cada búsqueda. El índice pesa 21.4 MB sin comprimir y ya NO llega desde el caché de borde
 * (medido 2026-10-01: cf-cache-status DYNAMIC, #21): cada isolate lo baja de R2 al arrancar
 * y otra vez cada INDEX_TTL_MS (4 h). El argumento de resolver en el worker sigue en pie; el
 * de coste no, hasta que #21 se cierre.
 */
export async function resolveProductUrl(
  tienda: string,
  normalizedUrl: string,
  runtime?: CatalogRuntime,
): Promise<ResolveUrlResult> {
  if (!TIENDAS_VALIDAS.has(tienda)) {
    return { ok: false, reason: "not_found" };
  }
  const index = await fetchIndex(tienda, runtime);
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

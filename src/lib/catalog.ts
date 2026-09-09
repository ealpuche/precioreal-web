import type { CatalogProduct } from "../contracts/catalog";
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

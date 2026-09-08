import type { CatalogProduct } from "../contracts/catalog";

const FEED_BASE = "https://feed.precioreal.mx";

// Único slug real hoy (catalog.md: ddtech, pcel después). Sin esta guarda, cualquier ruta de
// dos segmentos —incluido el ruido de escáneres contra /wp-admin, /.env, etc.— disparaba una
// invocación de worker más una lectura a R2 antes de responder 404 (CR PR #7, H3).
const TIENDAS_VALIDAS = new Set(["cyberpuerta"]);
const SKU_RE = /^[A-Za-z0-9._-]{1,64}$/;

export type FetchProductResult =
  | { ok: true; product: CatalogProduct }
  | { ok: false; reason: "not_found" | "upstream_error" };

/** Forma mínima que buildVerdict y PriceChart necesitan sin lanzar. No es una validación
 * completa del contrato, solo la guarda contra un JSON con forma inesperada (CR PR #7, H5). */
function hasExpectedShape(value: unknown): value is CatalogProduct {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const current = v.current as Record<string, unknown> | undefined;
  return (
    typeof v.typical_90d === "string" &&
    typeof v.min_90d === "string" &&
    typeof v.window_days === "number" &&
    Array.isArray(v.series) &&
    typeof current?.price === "string" &&
    typeof current?.available === "boolean"
  );
}

/**
 * Trae la ficha de un producto desde R2. No lanza: los dos casos de fallo (recurso
 * ausente vs. error de red/servidor/forma inesperada) se distinguen porque el mensaje al
 * usuario debe ser distinto — "no encontrado" es un 404 legítimo, "upstream_error" es un
 * problema nuestro.
 */
export async function fetchProduct(
  tienda: string,
  sku: string,
): Promise<FetchProductResult> {
  if (!TIENDAS_VALIDAS.has(tienda) || !SKU_RE.test(sku)) {
    return { ok: false, reason: "not_found" };
  }
  const url = `${FEED_BASE}/${encodeURIComponent(tienda)}/products/${encodeURIComponent(sku)}.json`;
  let res: Response;
  try {
    res = await fetch(url);
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

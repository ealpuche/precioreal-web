import type { CatalogProduct } from "../contracts/catalog";

const FEED_BASE = "https://feed.precioreal.mx";

export type FetchProductResult =
  | { ok: true; product: CatalogProduct }
  | { ok: false; reason: "not_found" | "upstream_error" };

/**
 * Trae la ficha de un producto desde R2. No lanza: los dos casos de fallo (recurso
 * ausente vs. error de red/servidor) se distinguen porque el mensaje al usuario debe ser
 * distinto — "no encontrado" es un 404 legítimo, "upstream_error" es un problema nuestro.
 */
export async function fetchProduct(
  tienda: string,
  sku: string,
): Promise<FetchProductResult> {
  let res: Response;
  try {
    res = await fetch(`${FEED_BASE}/${tienda}/products/${sku}.json`);
  } catch {
    return { ok: false, reason: "upstream_error" };
  }
  if (res.status === 404) {
    return { ok: false, reason: "not_found" };
  }
  if (!res.ok) {
    return { ok: false, reason: "upstream_error" };
  }
  try {
    const product = (await res.json()) as CatalogProduct;
    return { ok: true, product };
  } catch {
    return { ok: false, reason: "upstream_error" };
  }
}

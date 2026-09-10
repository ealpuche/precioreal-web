import type { CatalogProduct } from "../contracts/catalog";
import { formatMXN, pricePrefix } from "./format";

export const MAX_TITLE = 110;
export const MAX_DESCRIPTION = 165;

export function truncar(texto: string, max: number): string {
  if (max < 2) return "";
  if (texto.length <= max) return texto;

  const limit = max - 1;
  const lastSpace = texto.lastIndexOf(" ", limit);
  let cut =
    lastSpace !== -1 ? texto.slice(0, lastSpace) : texto.slice(0, limit);

  cut = cut.replace(/[\s\p{P}]+$/u, "");
  return cut + "…";
}

export function buildTitle(p: CatalogProduct): string {
  const sufijo = ` — historial de precios en ${p.site} | PrecioReal`;
  const nombre = truncar(p.name, Math.max(20, MAX_TITLE - sufijo.length));
  return nombre + sufijo;
}

export function buildDescription(p: CatalogProduct): string {
  if (!p.current.available) {
    const resto = `: no disponible en ${p.site}. El último precio visto fue ${pricePrefix(p)}${formatMXN(p.current.price)}. Consulta su historial completo en PrecioReal.`;
    const presupuesto = Math.max(20, MAX_DESCRIPTION - resto.length);
    const nombre = truncar(p.name, presupuesto);
    return `${nombre}${resto}`;
  }

  if (p.status === "insufficient_history" || !p.typical_90d || !p.min_90d) {
    const resto = ` en ${p.site}: ${pricePrefix(p)}${formatMXN(p.current.price)}. Todavía lo estamos rastreando y aún no hay suficiente historial para decir si es buen precio.`;
    const presupuesto = Math.max(20, MAX_DESCRIPTION - resto.length);
    const nombre = truncar(p.name, presupuesto);
    return `${nombre}${resto}`;
  }

  const resto = ` en ${p.site}: ${pricePrefix(p)}${formatMXN(p.current.price)} hoy. Habitual ${formatMXN(p.typical_90d)}, mínimo ${formatMXN(p.min_90d)} en ${p.window_days} días. Historial verificado en PrecioReal.`;
  const presupuesto = Math.max(20, MAX_DESCRIPTION - resto.length);
  const nombre = truncar(p.name, presupuesto);
  return `${nombre}${resto}`;
}

export function buildCanonical(
  siteUrl: string,
  tienda: string,
  slug: string,
): string {
  return new URL(`/${tienda}/${encodeURIComponent(slug)}`, siteUrl).href;
}

export function buildProductJsonLd(p: CatalogProduct): string | null {
  if ((p.status ?? "ok") !== "ok") return null;

  const obj: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    sku: p.sku,
  };

  if (typeof p.image_url === "string" && p.image_url !== "") {
    obj.image = p.image_url;
  }
  if (typeof p.category === "string" && p.category !== "") {
    obj.category = p.category;
  }

  obj.offers = {
    "@type": "Offer",
    price: p.current.price,
    priceCurrency: "MXN",
    availability: p.current.available
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock",
    url: p.url,
  };

  return JSON.stringify(obj).replaceAll("<", "\\u003c");
}

import type { CatalogIndex, CatalogIndexProduct } from "../contracts/catalog";
import { SKU_RE } from "./sku";

export const URLS_POR_ARCHIVO = 50000;
export const TIENDAS_SITEMAP = ["cyberpuerta"];
// 4 h: el mismo `max-age` que el feed anuncia (medido 2026-09-09 sobre
// feed.precioreal.mx: `cache-control: public, max-age=14400`). El contrato no
// documenta la cabecera, así que el número se sostiene en esa medición, no en
// el contrato (CR PR #19, H4).
export const SITEMAP_MAX_AGE = 14400;
export const RETRY_AFTER_SEGUNDOS = 300;

export function respuesta503(): Response {
  return new Response("Índice de catálogo no disponible.", {
    status: 503,
    headers: {
      "Retry-After": String(RETRY_AFTER_SEGUNDOS),
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export function xmlEscape(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function isoLastmod(since: unknown): string | null {
  if (typeof since !== "string") return null;
  const t = Date.parse(since);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}

/**
 * Misma resolución que `resolveProductUrl` en catalog.ts: el slug y no el sku, porque
 * la ficha vive bajo la clave que publica el productor.
 *
 * El fallback a `sku` hereda la excepción del contrato: es correcto solo cuando
 * `slug == sku`, y eso NO es invariante (specs/contracts/catalog.md: un sku `-ABC-`
 * pasa el charset de ruta pero su ficha vive en `ABC`). En /buscar el coste de ese
 * caso es un redirect a un 404; aquí sería una URL rota reportada a Search Console.
 * Se mantiene el fallback en vez de exigir `slug` porque medido 2026-09-09 los 25,381
 * indexables lo traen —el backfill de price-crawler-saas#137 ya propagó— y exigirlo
 * excluiría en silencio miles de fichas el día que el backfill se rompa, que es peor
 * que unas pocas URLs rotas y visible solo por su ausencia (CR PR #19, H1).
 */
export function claveDeRuta(p: CatalogIndexProduct): string | null {
  if (typeof p !== "object" || p === null) return null;
  const clave = typeof p.slug === "string" && p.slug !== "" ? p.slug : p.sku;
  if (typeof clave !== "string" || clave === "" || !SKU_RE.test(clave)) {
    return null;
  }
  return clave;
}

export function esIndexable(p: CatalogIndexProduct): boolean {
  return claveDeRuta(p) !== null && (p.status ?? "ok") === "ok";
}

export function productosIndexables(
  index: CatalogIndex,
): CatalogIndexProduct[] {
  if (!Array.isArray(index?.products)) return [];
  return index.products.filter(esIndexable);
}

export function totalArchivos(n: number): number {
  return Math.max(1, Math.ceil(n / URLS_POR_ARCHIVO));
}

export function buildSitemapIndex(
  siteUrl: string,
  entradas: Array<{ tienda: string; n: number; lastmod: string | null }>,
): string {
  let xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  for (const e of entradas) {
    const loc = xmlEscape(
      new URL(`/sitemap/${e.tienda}/${e.n}.xml`, siteUrl).href,
    );
    xml += "\n  <sitemap>\n";
    xml += `    <loc>${loc}</loc>\n`;
    if (e.lastmod !== null) {
      xml += `    <lastmod>${xmlEscape(e.lastmod)}</lastmod>\n`;
    }
    xml += "  </sitemap>";
  }
  xml += "\n</sitemapindex>\n";
  return xml;
}

export function buildUrlset(
  siteUrl: string,
  tienda: string,
  productos: CatalogIndexProduct[],
): string {
  let xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  for (const p of productos) {
    const clave = claveDeRuta(p);
    if (clave === null) continue;
    const loc = xmlEscape(
      new URL(`/${tienda}/${encodeURIComponent(clave)}`, siteUrl).href,
    );
    xml += "\n  <url>\n";
    xml += `    <loc>${loc}</loc>\n`;
    const lastmod = isoLastmod(p.since);
    if (lastmod !== null) {
      xml += `    <lastmod>${xmlEscape(lastmod)}</lastmod>\n`;
    }
    xml += "  </url>";
  }
  xml += "\n</urlset>\n";
  return xml;
}

export const prerender = false;

import type { APIRoute } from "astro";
import { fetchIndex } from "../lib/catalog";
import {
  TIENDAS_SITEMAP,
  SITEMAP_MAX_AGE,
  respuesta503,
  productosIndexables,
  totalArchivos,
  isoLastmod,
  buildSitemapIndex,
  URLS_POR_ARCHIVO,
} from "../lib/sitemap";

export const GET: APIRoute = async (context) => {
  const siteUrl = (context.site ?? new URL("https://precioreal.mx")).origin;

  const entradas: Array<{ tienda: string; n: number; lastmod: string | null }> =
    [];

  for (const tienda of TIENDAS_SITEMAP) {
    const index = await fetchIndex(tienda);
    if (index === null) return respuesta503();

    const indexables = productosIndexables(index);
    if (indexables.length === 0) return respuesta503();

    const chunks = totalArchivos(indexables.length);
    for (let i = 1; i <= chunks; i++) {
      const slice = indexables.slice(
        (i - 1) * URLS_POR_ARCHIVO,
        i * URLS_POR_ARCHIVO,
      );
      let chunkLastmod: string | null = null;
      for (const p of slice) {
        const d = isoLastmod(p.since);
        if (d !== null) {
          if (chunkLastmod === null || d > chunkLastmod) {
            chunkLastmod = d;
          }
        }
      }
      entradas.push({ tienda, n: i, lastmod: chunkLastmod });
    }
  }

  const xml = buildSitemapIndex(siteUrl, entradas);
  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": `public, max-age=${SITEMAP_MAX_AGE}`,
    },
  });
};

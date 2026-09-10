export const prerender = false;

import type { APIRoute } from "astro";
import { fetchIndex } from "../../../lib/catalog";
import {
  TIENDAS_SITEMAP,
  SITEMAP_MAX_AGE,
  URLS_POR_ARCHIVO,
  respuesta503,
  productosIndexables,
  totalArchivos,
  buildUrlset,
} from "../../../lib/sitemap";

export const GET: APIRoute = async (context) => {
  const { tienda, n } = context.params;

  if (typeof tienda !== "string" || !TIENDAS_SITEMAP.includes(tienda)) {
    return new Response("No encontrado", { status: 404 });
  }

  if (typeof n !== "string" || !/^[1-9][0-9]{0,3}$/.test(n)) {
    return new Response("No encontrado", { status: 404 });
  }

  const num = Number(n);

  const index = await fetchIndex(tienda);
  if (index === null) return respuesta503();

  const indexables = productosIndexables(index);
  if (indexables.length === 0) return respuesta503();

  if (num > totalArchivos(indexables.length)) {
    return new Response("No encontrado", { status: 404 });
  }

  const slice = indexables.slice(
    (num - 1) * URLS_POR_ARCHIVO,
    num * URLS_POR_ARCHIVO,
  );
  const siteUrl = (context.site ?? new URL("https://precioreal.mx")).origin;
  const xml = buildUrlset(siteUrl, tienda, slice);

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": `public, max-age=${SITEMAP_MAX_AGE}`,
    },
  });
};

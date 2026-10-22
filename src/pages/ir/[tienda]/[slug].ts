import type { APIRoute } from "astro";
import { fetchProduct } from "../../../lib/catalog";
import { logEvent, ORIGENES_SALIDA, validateEvent } from "../../../lib/event";
import { storeEvent } from "../../../lib/event-store";
import { hostPertenece, normalizeProductUrl } from "../../../lib/product-url";

export const prerender = false;

/**
 * Salida a la tienda desde una oferta (web#60): Telegram y deals.json enlazan aquí en vez
 * de a la tienda, se registra un `salida_tienda` con `origen` y se responde 302 a la URL
 * del producto. Es la base de medición de Ofertas v2 (price-crawler-saas#214).
 *
 * La URL de destino sale de la ficha del feed, nunca de la petición: un parámetro con el
 * destino sería un redirector abierto. Aun así se comprueba que el host sea el de la tienda,
 * porque un dato corrupto en R2 no debe convertir a precioreal.mx en un salto a otro sitio.
 * Sin cookies ni parámetros de afiliado (decisión vigente).
 */
const DOMINIO_DE_TIENDA: Record<string, string> = {
  cyberpuerta: "cyberpuerta.mx",
};

const SIN_CACHE = { "Cache-Control": "no-store" };

function redirigir(destino: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: destino, ...SIN_CACHE },
  });
}

export const GET: APIRoute = async ({ params, url, locals }) => {
  const tienda = params.tienda ?? "";
  const slug = params.slug ?? "";
  const resultado = await fetchProduct(tienda, slug);

  // Tienda o slug imposibles: fetchProduct no consulta R2 y no hay ficha a la cual volver.
  if (!resultado.ok && resultado.reason === "invalid_route") {
    return redirigir("/");
  }
  const ficha = `/${tienda}/${encodeURIComponent(slug)}`;
  if (!resultado.ok) {
    // 404 o upstream caído: la ficha propia muestra el mensaje correcto. Sin evento: no
    // hubo salida a la tienda.
    return redirigir(ficha);
  }

  const destino = resultado.product.url;
  const normalizado = normalizeProductUrl(destino);
  const dominio = DOMINIO_DE_TIENDA[tienda];
  if (!normalizado || !dominio || !hostPertenece(normalizado, dominio)) {
    console.warn(JSON.stringify({ t: "ir_destino_rechazado", tienda, slug }));
    return redirigir(ficha);
  }

  const de = url.searchParams.get("de") ?? "";
  const origen = (ORIGENES_SALIDA as readonly string[]).includes(de)
    ? de
    : "otro";
  const evento = validateEvent({
    evento: "salida_tienda",
    props: { tienda, slug, origen },
  });
  if (evento) {
    logEvent(evento);
    await storeEvent(locals?.runtime, evento);
  }
  return redirigir(destino);
};

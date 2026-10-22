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

// Agentes que piden la URL sin que nadie haya hecho clic: las vistas previas de Telegram y de
// otras apps de mensajería, y los rastreadores que ignoran robots.txt. Se les redirige igual,
// pero no se cuentan (CR PR #63). El user agent se lee para decidir y no se guarda.
// Agentes concretos y no la subcadena "bot": un teléfono CUBOT lleva "BOT" en el modelo y
// es un clic real (CR PR #63 ronda 2). `crawler`/`spider` sí son genéricos de rastreador.
const NO_ES_CLIC =
  /telegrambot|twitterbot|facebookexternalhit|facebot|whatsapp|slackbot|slack-imgproxy|discordbot|linkedinbot|skypeuripreview|googlebot|bingbot|applebot|yandexbot|duckduckbot|baiduspider|embedly|crawler|spider/i;

type Destino = { url: string } | { ficha: string } | { portada: true };

async function resolver(tienda: string, slug: string): Promise<Destino> {
  const resultado = await fetchProduct(tienda, slug);
  // Tienda o slug imposibles: fetchProduct no consulta R2 y no hay ficha a la cual volver.
  if (!resultado.ok && resultado.reason === "invalid_route") {
    return { portada: true };
  }
  const ficha = `/${tienda}/${encodeURIComponent(slug)}`;
  // 404 o upstream caído: la ficha propia muestra el mensaje correcto.
  if (!resultado.ok) return { ficha };

  // Se valida y se redirige la MISMA URL ya parseada: normalizeProductUrl acepta una URL
  // sin esquema, y redirigir el texto crudo "www.cyberpuerta.mx/…" sería un salto relativo
  // dentro de precioreal.mx (CR PR #63, H1).
  let parsed: URL;
  try {
    parsed = new URL(resultado.product.url);
  } catch {
    return { ficha };
  }
  const dominio = DOMINIO_DE_TIENDA[tienda];
  const normalizado = normalizeProductUrl(parsed.href);
  if (
    (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
    !normalizado ||
    !dominio ||
    !hostPertenece(normalizado, dominio)
  ) {
    console.warn(JSON.stringify({ t: "ir_destino_rechazado", tienda, slug }));
    return { ficha };
  }
  return { url: parsed.href };
}

function responder(destino: Destino): Response {
  if ("url" in destino) return redirigir(destino.url);
  if ("ficha" in destino) return redirigir(destino.ficha);
  return redirigir("/");
}

export const GET: APIRoute = async ({ params, url, request, locals }) => {
  const tienda = params.tienda ?? "";
  const slug = params.slug ?? "";
  const destino = await resolver(tienda, slug);

  const ua = request.headers.get("user-agent") ?? "";
  if ("url" in destino && !NO_ES_CLIC.test(ua)) {
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
  }
  return responder(destino);
};

// HEAD explícito: un verificador de enlaces que solo pregunta si la URL existe recibe la
// misma redirección y no cuenta como clic.
export const HEAD: APIRoute = async ({ params }) =>
  responder(await resolver(params.tienda ?? "", params.slug ?? ""));

import { resolveProductUrl, type ResolveUrlResult } from "./catalog";
import type { MODOS_BUSCAR, RESULTADOS_BUSCAR } from "./event";
import {
  hostPertenece,
  looksLikeUrl,
  normalizePastedUrl,
  tiendaNoPublicada,
} from "./product-url";
import { SKU_RE } from "./sku";

export type ModoBuscar = (typeof MODOS_BUSCAR)[number];
export type ResultadoBuscar = (typeof RESULTADOS_BUSCAR)[number];

/** Lo que `/buscar` hace con una consulta: redirigir a una ficha o mostrar un mensaje. */
export type DecisionBuscar =
  | { modo: ModoBuscar; resultado: "redirigido"; destino: string }
  | {
      modo: ModoBuscar;
      resultado: Exclude<ResultadoBuscar, "redirigido">;
      error: string;
    };

export type Resolver = (
  tienda: string,
  normalizedUrl: string,
) => Promise<ResolveUrlResult>;

const MENSAJE_TEXTO =
  "Eso no parece un código ni un enlace. Todavía no buscamos por nombre: abre el producto en Cyberpuerta y copia su código (SKU) o el enlace de la página.";

const MENSAJE_ENLACE_ILEGIBLE =
  "No pudimos leer ese enlace. Copia la dirección completa de la página del producto en Cyberpuerta y pégala aquí.";

/**
 * Decide la respuesta de `/buscar` sin tocar la petición ni el registro de eventos: la página
 * solo redirige o pinta el mensaje, y emite la fila de D1 con `modo` y `resultado`. Vive
 * aparte de `buscar.astro` para poder probar cada camino con vitest (#42).
 *
 * `modo` separa lo que el usuario intentó: `sku` (código), `url` (enlace, aunque no se
 * pudiera leer) y `texto` (un nombre tecleado). Hasta #42 un nombre con espacios caía en
 * `url`/`ilegible` y uno de una palabra en `url`/`tienda_desconocida`, así que D1 no
 * distinguía la demanda de búsqueda por nombre (#15) de los enlaces que fallamos en leer.
 */
export async function decidirBusqueda(
  q: string,
  resolver: Resolver = resolveProductUrl,
): Promise<DecisionBuscar> {
  // SKU_RE excluye `/`, `:` y espacios: un código nunca parece enlace ni texto.
  if (SKU_RE.test(q)) {
    return {
      modo: "sku",
      resultado: "redirigido",
      destino: `/cyberpuerta/${encodeURIComponent(q)}`,
    };
  }
  if (!looksLikeUrl(q)) {
    return { modo: "texto", resultado: "ilegible", error: MENSAJE_TEXTO };
  }

  const modo = "url";
  const normalized = normalizePastedUrl(q);
  if (!normalized) {
    return { modo, resultado: "ilegible", error: MENSAJE_ENLACE_ILEGIBLE };
  }
  const tiendaPendiente = tiendaNoPublicada(normalized);
  if (tiendaPendiente) {
    return {
      modo,
      resultado: "tienda_no_publicada",
      error: `Rastreamos ${tiendaPendiente}, pero su historial todavía no está disponible en el sitio. Por ahora solo puedes consultar Cyberpuerta.`,
    };
  }
  if (!hostPertenece(normalized, "cyberpuerta.mx")) {
    return {
      modo,
      resultado: "tienda_desconocida",
      error: "Por ahora solo tenemos historial de Cyberpuerta.",
    };
  }
  if (!normalized.includes("/")) {
    return {
      modo,
      resultado: "sin_ruta",
      error:
        "Ese es el enlace de la portada de Cyberpuerta. Pega el de un producto.",
    };
  }

  const resolved = await resolver("cyberpuerta", normalized);
  if (resolved.ok) {
    return {
      modo,
      resultado: "redirigido",
      destino: `/cyberpuerta/${encodeURIComponent(resolved.sku)}`,
    };
  }
  if (resolved.reason === "upstream_error") {
    return {
      modo,
      resultado: "error_upstream",
      error:
        "No pudimos consultar el catálogo con ese enlace en este momento. Prueba con el código del producto: aparece como SKU en su página de Cyberpuerta.",
    };
  }
  return {
    modo,
    resultado: "no_encontrado",
    error: "No encontramos ese producto en nuestro catálogo de Cyberpuerta.",
  };
}

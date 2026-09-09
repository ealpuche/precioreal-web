import type { CatalogProduct } from "../contracts/catalog";
import { TZ } from "./tz";

// Sin centavos por decisión de diseño (mockup aprobado): el retail mexicano de hardware casi
// nunca anuncia precios con centavos. El contrato SÍ entrega 2 decimales de precisión; esta
// función es la única que los redondea para mostrar, y buildVerdict redondea el diff antes de
// ramificar para que el texto y el número mostrado nunca se contradigan (CR PR #7, H6).
const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

/** El contrato entrega strings decimales; esta es la única puerta de parseo a número. */
export function parsePrice(value: string): number {
  return Number(value);
}

export function formatMXN(value: string): string {
  return mxn.format(parsePrice(value));
}

export interface Verdict {
  headline: string;
  detail: string;
  tone: "good" | "neutral" | "warn";
}

/**
 * "desde " cuando el precio publicado es el de la variante más barata de un producto
 * multi-talla o multi-color. Vive aquí y no en la página porque el veredicto también imprime
 * precios: tenerlo en dos sitios ya produjo que la grilla dijera "desde $1,500" y el veredicto
 * "El último precio visto fue $1,500" en la misma ficha (CR PR #10 ronda 3, Copilot).
 */
export function pricePrefix(product: CatalogProduct): string {
  return product.is_from_price ? "desde " : "";
}

/**
 * Frase honesta, no una calificación genérica. "Está $X por debajo" requiere
 * current < typical; si current >= typical, el mensaje no debe insinuar una oferta que no
 * existe.
 */
export function buildVerdict(product: CatalogProduct): Verdict {
  // Antes que cualquier otra rama: si el producto no está disponible, no hay precio vigente
  // que evaluar, tenga o no historial. Con este chequeo después del de historial insuficiente,
  // un producto agotado y recién rastreado decía "llevamos N días rastreándolo" mientras la
  // grilla de la misma ficha mostraba "último precio visto" (CR PR #10, H1).
  if (!product.current.available) {
    return {
      headline: "Este producto no está disponible actualmente.",
      detail: `El último precio visto fue ${pricePrefix(product)}${formatMXN(product.current.price)}, el ${new Date(product.current.since).toLocaleDateString("es-MX", { timeZone: TZ })}.`,
      tone: "neutral",
    };
  }

  // Un producto sin estadísticas de ventana no tiene "precio habitual" contra el que
  // comparar: cualquier veredicto sería inventado. Lo honesto es decir qué falta y cuánto
  // llevamos observándolo (#131).
  if (product.status === "insufficient_history" || !product.typical_90d) {
    // Number.isFinite, no el parseo: `Date.parse` y `new Date().getTime()` devuelven NaN por
    // igual ante una fecha ilegible. La guarda de forma acepta cualquier string como fecha a
    // propósito (issue #6), así que es aquí donde un NaN dejaría de llegar al texto visible
    // como "Llevamos NaN días". Ilegible es lo mismo que ausente (CR PR #10, H6 y H8).
    const t = product.first_seen_at ? Date.parse(product.first_seen_at) : NaN;
    const dias = Number.isFinite(t)
      ? Math.max(0, Math.floor((Date.now() - t) / 86_400_000))
      : null;
    return {
      headline: "Todavía no podemos decir si este precio es bueno.",
      detail:
        dias === null
          ? "Necesitamos más historial para comparar. Ya lo estamos rastreando."
          : `Llevamos ${dias} ${dias === 1 ? "día" : "días"} rastreándolo y aún no hay suficientes cambios de precio para comparar.`,
      tone: "neutral",
    };
  }

  const current = parsePrice(product.current.price);
  const typical = parsePrice(product.typical_90d!);
  const min = parsePrice(product.min_90d!);
  // Redondeado a lo que el usuario ve: con maximumFractionDigits: 0, una diferencia de
  // $0.40 mostraría "Está $0 por debajo", contradiciendo el propio propósito de esta función
  // (CR PR #7, H6). isLowest se mantiene con la comparación exacta (current <= min): ahí no
  // se muestra el número, solo se decide una rama de texto.
  const diff = Math.round(typical - current);

  if (diff > 0) {
    const isLowest = current <= min;
    return {
      headline: `Está ${formatMXN(String(diff))} por debajo de su precio habitual.`,
      detail: isLowest
        ? `Es el precio más bajo registrado en los últimos ${product.window_days} días.`
        : `Su precio habitual en ${product.window_days} días es ${formatMXN(product.typical_90d!)}.`,
      tone: "good",
    };
  }

  if (diff < 0) {
    return {
      headline: `Está ${formatMXN(String(-diff))} por encima de su precio habitual.`,
      detail: `Su precio habitual en ${product.window_days} días es ${formatMXN(product.typical_90d!)}.`,
      tone: "warn",
    };
  }

  return {
    headline: "Está en su precio habitual.",
    detail: `Sin cambios frente al promedio de los últimos ${product.window_days} días.`,
    tone: "neutral",
  };
}

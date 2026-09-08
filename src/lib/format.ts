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
 * Frase honesta, no una calificación genérica. "Está $X por debajo" requiere
 * current < typical; si current >= typical, el mensaje no debe insinuar una oferta que no
 * existe.
 */
export function buildVerdict(product: CatalogProduct): Verdict {
  const current = parsePrice(product.current.price);
  const typical = parsePrice(product.typical_90d);
  const min = parsePrice(product.min_90d);
  // Redondeado a lo que el usuario ve: con maximumFractionDigits: 0, una diferencia de
  // $0.40 mostraría "Está $0 por debajo", contradiciendo el propio propósito de esta función
  // (CR PR #7, H6). isLowest se mantiene con la comparación exacta (current <= min): ahí no
  // se muestra el número, solo se decide una rama de texto.
  const diff = Math.round(typical - current);

  if (!product.current.available) {
    return {
      headline: "Este producto no está disponible actualmente.",
      detail: `El último precio visto fue ${formatMXN(product.current.price)}, el ${new Date(product.current.since).toLocaleDateString("es-MX", { timeZone: TZ })}.`,
      tone: "neutral",
    };
  }

  if (diff > 0) {
    const isLowest = current <= min;
    return {
      headline: `Está ${formatMXN(String(diff))} por debajo de su precio habitual.`,
      detail: isLowest
        ? `Es el precio más bajo registrado en los últimos ${product.window_days} días.`
        : `Su precio habitual en ${product.window_days} días es ${formatMXN(product.typical_90d)}.`,
      tone: "good",
    };
  }

  if (diff < 0) {
    return {
      headline: `Está ${formatMXN(String(-diff))} por encima de su precio habitual.`,
      detail: `Su precio habitual en ${product.window_days} días es ${formatMXN(product.typical_90d)}.`,
      tone: "warn",
    };
  }

  return {
    headline: "Está en su precio habitual.",
    detail: `Sin cambios frente al promedio de los últimos ${product.window_days} días.`,
    tone: "neutral",
  };
}

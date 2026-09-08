import type { CatalogProduct } from "../contracts/catalog";

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
 * Frase honesta, no una calificación genérica. "Está $X por debajo" requiere current
 * typical; si current >= typical, el mensaje no debe insinuar una oferta que no existe.
 */
export function buildVerdict(product: CatalogProduct): Verdict {
  const current = parsePrice(product.current.price);
  const typical = parsePrice(product.typical_90d);
  const min = parsePrice(product.min_90d);
  const diff = typical - current;

  if (!product.current.available) {
    return {
      headline: "Este producto no está disponible actualmente.",
      detail: `El último precio visto fue ${formatMXN(product.current.price)}, el ${new Date(product.current.since).toLocaleDateString("es-MX")}.`,
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

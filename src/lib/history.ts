import type { CatalogProduct, CatalogSeriesPoint } from "../contracts/catalog";
import { formatMXN, parsePrice } from "./format";
import { TZ } from "./tz";

/**
 * Lectura del historial de una ficha en frases y filas, para que la página cuente lo que la
 * serie ya sabe. Existe por #28: Google rastreó ~2,000 fichas y no indexó ninguna por
 * contenido delgado; el historial existía, la página no lo contaba (#40).
 *
 * Regla de todo el módulo: cada frase sale de un número del contrato. Nada se interpola ni se
 * redondea hacia una conclusión; si un dato falta o no se puede leer, la frase no se emite.
 */

const DAY_MS = 86_400_000;

interface Level {
  t: number;
  price: number;
}

/**
 * Niveles de precio en orden ascendente, sin fechas ilegibles ni precios no finitos, y con los
 * repetidos consecutivos colapsados: el contrato solo publica `is_available=true`, así que dos
 * puntos seguidos con el mismo precio son un hueco de disponibilidad, no un cambio.
 */
export function levelsFromSeries(series: CatalogSeriesPoint[]): Level[] {
  const levels: Level[] = [];
  for (const point of series) {
    if (!Array.isArray(point)) continue;
    const t = Date.parse(point[0]);
    const price = parsePrice(point[1]);
    if (!Number.isFinite(t) || !Number.isFinite(price)) continue;
    const prev = levels[levels.length - 1];
    if (prev && prev.price === price) continue;
    if (prev && t < prev.t) continue;
    levels.push({ t, price });
  }
  return levels;
}

export interface PriceChange {
  /** ISO de inicio del nivel. */
  iso: string;
  price: number;
  /** Diferencia contra el nivel anterior; null en el primero de la serie. */
  delta: number | null;
}

/** Últimos `limit` cambios de precio, del más reciente al más antiguo. */
export function recentChanges(
  series: CatalogSeriesPoint[],
  limit = 8,
): PriceChange[] {
  const levels = levelsFromSeries(series);
  const out: PriceChange[] = [];
  for (let i = levels.length - 1; i >= 0 && out.length < limit; i--) {
    const prev = i > 0 ? levels[i - 1] : null;
    out.push({
      iso: new Date(levels[i].t).toISOString(),
      price: levels[i].price,
      delta: prev ? levels[i].price - prev.price : null,
    });
  }
  return out;
}

export function formatDay(ms: number): string {
  return new Date(ms)
    .toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      timeZone: TZ,
    })
    .replace(".", "");
}

export function formatDayYear(ms: number): string {
  return new Date(ms)
    .toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: TZ,
    })
    .replace(".", "");
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

/**
 * Instante de referencia: la última escritura de la ficha o el último cambio, lo que sea más
 * reciente. Nunca la hora de la visita: el productor no reescribe fichas estables (#183 del
 * crawler), así que "ahora" inventaría días que nadie observó (mismo criterio que freshness).
 */
function referenceMs(product: CatalogProduct, levels: Level[]): number | null {
  const gen = Date.parse(product.generated_at);
  const last = levels.length ? levels[levels.length - 1].t : NaN;
  const candidates = [gen, last].filter(Number.isFinite);
  return candidates.length ? Math.max(...candidates) : null;
}

/** Duración de cada nivel en días completos; el último dura hasta la referencia. */
function levelDays(levels: Level[], i: number, refMs: number): number {
  const end = i + 1 < levels.length ? levels[i + 1].t : refMs;
  return Math.max(0, Math.floor((end - levels[i].t) / DAY_MS));
}

/**
 * Frases del bloque "Qué dice el historial". Devuelve [] si no hay serie legible.
 *
 * Con `insufficient_history` solo se emiten las frases que no dependen de estadísticas de
 * ventana: el contrato dice que el productor no publica esas estadísticas en ese estado, y la
 * UI no debe fabricarlas (catalog.md).
 */
export function historySentences(product: CatalogProduct): string[] {
  const levels = levelsFromSeries(product.series);
  if (levels.length === 0) return [];
  const ref = referenceMs(product, levels);
  if (ref === null) return [];

  const sentences: string[] = [];
  const firstSeen = Date.parse(product.first_seen_at ?? "");
  const since = Number.isFinite(firstSeen)
    ? Math.min(firstSeen, levels[0].t)
    : levels[0].t;
  const totalChanges = levels.length - 1;

  sentences.push(
    `Lo rastreamos en ${product.site} desde el ${formatDayYear(since)}; desde entonces su precio cambió ${plural(totalChanges, "vez", "veces")}.`,
  );

  const windowDays = product.window_days;
  const windowStart = ref - windowDays * DAY_MS;
  const changesInWindow = levels.filter(
    (l, i) => i > 0 && l.t >= windowStart,
  ).length;

  const hasStats =
    (product.status ?? "ok") === "ok" &&
    typeof product.min_90d === "string" &&
    typeof product.max_90d === "string";

  if (hasStats && changesInWindow !== totalChanges) {
    sentences.push(
      `En los últimos ${windowDays} días cambió ${plural(changesInWindow, "vez", "veces")}.`,
    );
  }

  let minIsCurrent = false;
  if (hasStats) {
    const min = parsePrice(product.min_90d!);
    const max = parsePrice(product.max_90d!);
    // La fecha se busca en la serie pero el número es el del productor: así la frase nunca
    // contradice la grilla de estadísticas. Si el productor y la serie no coinciden, se
    // omite la fecha en vez de adivinarla.
    const minIdx = findLastLevel(levels, min, windowStart);
    const maxIdx = findLastLevel(levels, max, windowStart);
    if (Number.isFinite(max) && maxIdx !== -1) {
      sentences.push(
        `Su precio más alto en ${windowDays} días fue ${formatMXN(String(max))}, el ${formatDay(levels[maxIdx].t)}.`,
      );
    }
    if (Number.isFinite(min) && minIdx !== -1) {
      const isCurrent = minIdx === levels.length - 1;
      minIsCurrent = isCurrent;
      const days = levelDays(levels, minIdx, ref);
      sentences.push(
        isCurrent
          ? `Su mínimo de ${windowDays} días, ${formatMXN(String(min))}, empezó el ${formatDay(levels[minIdx].t)} y es el precio de hoy.`
          : `Su mínimo de ${windowDays} días fue ${formatMXN(String(min))}, el ${formatDay(levels[minIdx].t)}, y duró ${plural(days, "día", "días")}.`,
      );
    }
  }

  const jump = largestMove(levels, windowStart, 1);
  if (hasStats && jump) {
    sentences.push(
      `La mayor subida en un solo cambio fue el ${formatDay(jump.t)}: de ${formatMXN(String(jump.from))} a ${formatMXN(String(jump.to))}.`,
    );
  }
  const drop = largestMove(levels, windowStart, -1);
  if (hasStats && drop) {
    sentences.push(
      `La mayor bajada en un solo cambio fue el ${formatDay(drop.t)}: de ${formatMXN(String(drop.from))} a ${formatMXN(String(drop.to))}.`,
    );
  }

  // Si el mínimo es el precio de hoy, su frase ya dice desde cuándo: repetirlo es relleno.
  if (minIsCurrent) return sentences;

  const current = levels[levels.length - 1];
  const daysAtCurrent = levelDays(levels, levels.length - 1, ref);
  sentences.push(
    daysAtCurrent === 0
      ? `El precio actual, ${formatMXN(String(current.price))}, apareció el ${formatDay(current.t)}.`
      : `Lleva ${plural(daysAtCurrent, "día", "días")} en ${formatMXN(String(current.price))}, desde el ${formatDay(current.t)}.`,
  );

  return sentences;
}

function findLastLevel(levels: Level[], price: number, fromMs: number): number {
  for (let i = levels.length - 1; i >= 0; i--) {
    if (levels[i].t < fromMs) break;
    if (levels[i].price === price) return i;
  }
  return -1;
}

/**
 * El cambio más grande en una dirección dentro de la ventana. `sign` 1 busca subidas y -1
 * bajadas. El nivel anterior puede caer fuera de la ventana: lo que cuenta es cuándo ocurrió
 * el cambio.
 */
function largestMove(
  levels: Level[],
  fromMs: number,
  sign: 1 | -1,
): { t: number; from: number; to: number } | null {
  let best: { t: number; from: number; to: number } | null = null;
  for (let i = 1; i < levels.length; i++) {
    if (levels[i].t < fromMs) continue;
    const delta = (levels[i].price - levels[i - 1].price) * sign;
    if (delta <= 0) continue;
    if (!best || delta > (best.to - best.from) * sign) {
      best = { t: levels[i].t, from: levels[i - 1].price, to: levels[i].price };
    }
  }
  return best;
}

export interface Anchor {
  typical: string;
  current: string;
  /** Diferencia redondeada como se muestra; positiva = por debajo del habitual. */
  diff: number;
  tone: "good" | "neutral" | "warn";
  text: string;
}

/**
 * "Habitual → Hoy". Null cuando no hay precio vigente o no hay habitual publicado: el ancla es
 * justo la estadística que el productor no emite con `insufficient_history`.
 * El redondeo es el mismo que `buildVerdict` para que el ancla y el veredicto no se
 * contradigan en la misma ficha.
 */
export function buildAnchor(product: CatalogProduct): Anchor | null {
  if (!product.current.available) return null;
  if ((product.status ?? "ok") !== "ok" || !product.typical_90d) return null;
  const typical = parsePrice(product.typical_90d);
  const current = parsePrice(product.current.price);
  if (!Number.isFinite(typical) || !Number.isFinite(current)) return null;
  const diff = Math.round(typical - current);
  if (diff > 0) {
    return {
      typical: formatMXN(product.typical_90d),
      current: formatMXN(product.current.price),
      diff,
      tone: "good",
      text: `${formatMXN(String(diff))} menos que su precio habitual`,
    };
  }
  if (diff < 0) {
    return {
      typical: formatMXN(product.typical_90d),
      current: formatMXN(product.current.price),
      diff,
      tone: "warn",
      text: `Pagarías ${formatMXN(String(-diff))} de más`,
    };
  }
  return {
    typical: formatMXN(product.typical_90d),
    current: formatMXN(product.current.price),
    diff,
    tone: "neutral",
    text: "Igual a su precio habitual",
  };
}

export interface Badge {
  label: string;
  tone: "good" | "neutral" | "warn";
}

/**
 * Etiqueta corta sobre el veredicto. Usa las mismas ramas y el mismo redondeo que
 * `buildVerdict` (format.ts) para que la etiqueta y la frase nunca digan cosas distintas.
 */
export function verdictBadge(product: CatalogProduct): Badge {
  if (!product.current.available) {
    return { label: "No disponible", tone: "neutral" };
  }
  if ((product.status ?? "ok") !== "ok" || !product.typical_90d) {
    return { label: "Historial en construcción", tone: "neutral" };
  }
  const current = parsePrice(product.current.price);
  const diff = Math.round(parsePrice(product.typical_90d) - current);
  if (diff > 0) {
    const min = product.min_90d ? parsePrice(product.min_90d) : NaN;
    return {
      label:
        Number.isFinite(min) && current <= min
          ? `Mínimo de ${product.window_days} días`
          : "Debajo de su precio habitual",
      tone: "good",
    };
  }
  if (diff < 0) return { label: "Arriba de su precio habitual", tone: "warn" };
  return { label: "En su precio habitual", tone: "neutral" };
}

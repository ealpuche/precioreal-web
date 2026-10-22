/**
 * Margen izquierdo de la gráfica, en unidades del viewBox, para que quepa la etiqueta más
 * larga del eje Y. Con un margen fijo de 72 y fuente 17, "125,000" se recortaba
 * (H1, tercera revisión del PR #41).
 *
 * IBM Plex Mono mide 0.6 em por carácter; se usa 0.62 para no depender del redondeo del
 * motor de render, más 10 de separación con la gráfica.
 */
const CHAR_EM = 0.62;
const GAP = 10;
const MIN_MARGIN = 72;

export function yAxisMargin(labels: string[], fontSize: number): number {
  const longest = labels.reduce((n, l) => Math.max(n, l.length), 0);
  return Math.max(MIN_MARGIN, Math.ceil(longest * fontSize * CHAR_EM) + GAP);
}

const DAY_MS = 86_400_000;

/**
 * Índice del punto que la gráfica marca como "mínimo": el último punto dentro de la ventana
 * cuyo precio es el mínimo que publica el productor. -1 si no hay ninguno o si es el último
 * punto (ese ya lo marca el punto de hoy).
 *
 * Buscaba en toda la serie: un precio igual al mínimo de 90 días pero de hace cinco meses se
 * marcaba como "mínimo" (H1, cuarta revisión del PR #41).
 */
export function minMarkerIndex(
  series: [string, string, boolean][],
  min: string | undefined,
  windowDays: number,
  refMs: number,
): number {
  const minValue = min !== undefined ? Number(min) : Number.NaN;
  if (!Number.isFinite(minValue)) return -1;
  const windowStart = refMs - windowDays * DAY_MS;
  for (let i = series.length - 1; i >= 0; i--) {
    const t = Date.parse(series[i][0]);
    if (!Number.isFinite(t)) continue;
    if (t < windowStart) break;
    if (Number(series[i][1]) === minValue) {
      return i === series.length - 1 ? -1 : i;
    }
  }
  return -1;
}

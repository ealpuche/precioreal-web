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

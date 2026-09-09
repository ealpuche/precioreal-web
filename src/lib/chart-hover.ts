export interface ChartPoint {
  px: number;
  py: number;
  date: string;
  price: string;
}

/**
 * Búsqueda binaria del punto más cercano a una coordenada X del viewBox. Extraído del
 * componente para que sea testeable con Vitest sin depender del DOM — lo que sí necesita
 * navegador (addEventListener, getBoundingClientRect) se queda en PriceChart.astro.
 */
export function nearestPointIndex(
  points: ChartPoint[],
  viewBoxX: number,
): number {
  if (points.length === 0) {
    throw new Error("nearestPointIndex requiere al menos un punto");
  }
  let lo = 0,
    hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].px < viewBoxX) lo = mid + 1;
    else hi = mid;
  }
  if (
    lo > 0 &&
    Math.abs(points[lo - 1].px - viewBoxX) < Math.abs(points[lo].px - viewBoxX)
  ) {
    return lo - 1;
  }
  return lo;
}

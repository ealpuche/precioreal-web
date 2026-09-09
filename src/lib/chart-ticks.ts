export interface MonthTick {
  /** Milisegundos UTC de la frontera de mes. El componente lo proyecta a coordenada X. */
  t: number;
  label: string;
}

/**
 * Fronteras de mes entre dos instantes, calculadas Y etiquetadas en UTC.
 *
 * Ambas operaciones van en la misma zona a propósito. La versión anterior calculaba la
 * frontera con `new Date(y, m+1, 1)` —medianoche UTC bajo el runtime del edge— y la
 * etiquetaba con `timeZone: "America/Mexico_City"`, donde ese instante son las 18:00 del
 * último día del mes anterior: el eje entero salía corrido un mes (CR PR #7 ronda final, H1).
 *
 * Se elige UTC y no la zona de México porque la línea del tick solo necesita caer dentro del
 * mes que rotula; a escala de meses una diferencia de 6 h es invisible, mientras que mezclar
 * zonas produce el error de un mes completo.
 */
export function monthTicks(fromMs: number, toMs: number): MonthTick[] {
  const ticks: MonthTick[] = [];
  if (!(toMs > fromMs)) return ticks;

  const start = new Date(fromMs);
  const cur = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
  );

  while (cur.getTime() <= toMs) {
    ticks.push({
      t: cur.getTime(),
      label: cur
        .toLocaleDateString("es-MX", { month: "short", timeZone: "UTC" })
        .replace(".", ""),
    });
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return ticks;
}

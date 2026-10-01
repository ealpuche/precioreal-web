/**
 * La marca de la gráfica viaja en la captura de la gráfica; una fecha inventada ahí es
 * una afirmación falsa (CR PR #14 ronda 2, H1). Por eso no existe caída a "ahora".
 *
 * Dice "actualizado" y no "verificado": `generated_at` es la fecha en que el productor
 * escribió la ficha, y es lo único que ese dato prueba. Ningún dato publicado hoy prueba
 * cuándo se observó el producto por última vez (CR PR #37, H2; price-crawler-saas#185).
 */

import { TZ } from "./tz";

function formatDay(iso: string | null | undefined): string | null {
  if (typeof iso !== "string" || iso === "") return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  });
}

export function buildChartStamp(
  generatedAt: string | null | undefined,
): string {
  const day = formatDay(generatedAt);
  return day ? `precioreal.mx · actualizado ${day}` : "precioreal.mx";
}

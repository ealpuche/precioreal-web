/**
 * La marca de la gráfica viaja en la captura de la gráfica; una fecha inventada ahí es
 * una afirmación falsa (CR PR #14 ronda 2, H1). Por eso no existe caída a "ahora".
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
  verifiedAt: string | null | undefined,
): string {
  let stamp = "precioreal.mx";
  const genDay = formatDay(generatedAt);
  if (genDay) {
    stamp += ` · último cambio ${genDay}`;
  }
  const verDay = formatDay(verifiedAt);
  if (verDay) {
    stamp += ` · verificado ${verDay}`;
  }
  return stamp;
}

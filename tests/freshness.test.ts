import { describe, it, expect } from "vitest";
import { buildChartStamp } from "../src/lib/freshness";
import { TZ } from "../src/lib/tz";

function formatExpected(iso: string, tz: string = TZ): string {
  return new Date(Date.parse(iso)).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: tz,
  });
}

describe("buildChartStamp", () => {
  it("con ambas fechas: contiene último cambio {d1} y verificado {d2}, en ese orden", () => {
    const genIso = "2026-09-15T12:00:00Z";
    const verIso = "2026-10-01T01:19:47Z";
    const d1 = formatExpected(genIso);
    const d2 = formatExpected(verIso);

    const stamp = buildChartStamp(genIso, verIso);
    expect(stamp).toContain(`último cambio ${d1}`);
    expect(stamp).toContain(`verificado ${d2}`);
    expect(stamp.indexOf(`último cambio ${d1}`)).toBeLessThan(
      stamp.indexOf(`verificado ${d2}`),
    );
  });

  it("solo generatedAt: contiene último cambio y NO contiene verificado", () => {
    const genIso = "2026-09-15T12:00:00Z";
    const d1 = formatExpected(genIso);

    const stamp = buildChartStamp(genIso, null);
    expect(stamp).toContain(`último cambio ${d1}`);
    expect(stamp).not.toContain("verificado");
  });

  it("solo verifiedAt: contiene verificado y NO contiene último cambio", () => {
    const verIso = "2026-10-01T01:19:47Z";
    const d2 = formatExpected(verIso);

    const stamp = buildChartStamp(null, verIso);
    expect(stamp).toContain(`verificado ${d2}`);
    expect(stamp).not.toContain("último cambio");
  });

  it("sin ninguna: es exactamente precioreal.mx", () => {
    expect(buildChartStamp(null, null)).toBe("precioreal.mx");
    expect(buildChartStamp(undefined, undefined)).toBe("precioreal.mx");
    expect(buildChartStamp("", "")).toBe("precioreal.mx");
  });

  it("generatedAt ilegible ('basura') y sin verifiedAt: es exactamente precioreal.mx", () => {
    expect(buildChartStamp("basura", null)).toBe("precioreal.mx");
  });

  it("zona horaria: generatedAt = '2026-10-01T03:00:00Z' se rotula con el día 30 de septiembre de México, no con el 1 de octubre", () => {
    const iso = "2026-10-01T03:00:00Z";
    const stamp = buildChartStamp(iso, null);

    const expectedMx = formatExpected(iso, TZ);
    const expectedUtc = formatExpected(iso, "UTC");

    expect(expectedMx).not.toBe(expectedUtc);
    expect(stamp).toBe(`precioreal.mx · último cambio ${expectedMx}`);
  });
});

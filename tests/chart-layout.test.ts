import { describe, expect, it } from "vitest";
import { minMarkerIndex, yAxisMargin } from "../src/lib/chart-layout";

describe("yAxisMargin", () => {
  it("cabe una etiqueta de 6 cifras con fuente 17 (H1, tercera revisión del PR #41)", () => {
    // 7 caracteres de "125,000" a ~0.62 em cada uno en IBM Plex Mono.
    const margin = yAxisMargin(["0", "62,500", "125,000"], 17);
    expect(margin).toBeGreaterThanOrEqual(Math.ceil(7 * 17 * 0.62) + 10);
  });

  it("no baja del mínimo con etiquetas cortas", () => {
    expect(yAxisMargin(["487", "1,531"], 17)).toBe(72);
  });

  it("sin etiquetas devuelve el mínimo", () => {
    expect(yAxisMargin([], 17)).toBe(72);
  });
});

describe("minMarkerIndex", () => {
  const DAY = 86_400_000;
  const ref = Date.parse("2026-10-20T00:00:00Z");
  const series: [string, string, boolean][] = [
    ["2026-05-01T00:00:00Z", "50.00", true], // fuera de la ventana de 90 días
    ["2026-08-01T00:00:00Z", "100.00", true],
    ["2026-09-01T00:00:00Z", "120.00", true],
    ["2026-10-01T00:00:00Z", "130.00", true],
  ];

  it("H1 (4a revisión): marca el mínimo dentro de la ventana, no un precio igual fuera de ella", () => {
    const withOldTwin: [string, string, boolean][] = [
      ["2026-05-01T00:00:00Z", "100.00", true],
      ["2026-06-01T00:00:00Z", "110.00", true],
      ...series.slice(1),
    ];
    // El mínimo de la ventana es 100 (1 ago); el 100 de mayo queda fuera.
    expect(minMarkerIndex(withOldTwin, "100.00", 90, ref)).toBe(2);
  });

  it("no marca nada si el mínimo publicado solo aparece fuera de la ventana", () => {
    expect(minMarkerIndex(series, "50.00", 90, ref)).toBe(-1);
  });

  it("no marca el último punto: ya lo marca el punto de hoy", () => {
    expect(minMarkerIndex(series, "130.00", 90, ref)).toBe(-1);
  });

  it("sin mínimo publicado o ilegible no marca nada", () => {
    expect(minMarkerIndex(series, undefined, 90, ref)).toBe(-1);
    expect(minMarkerIndex(series, "abc", 90, ref)).toBe(-1);
  });

  it("la ventana se mide hacia atrás desde la referencia", () => {
    expect(ref - 90 * DAY).toBeLessThan(Date.parse("2026-08-01T00:00:00Z"));
  });
});

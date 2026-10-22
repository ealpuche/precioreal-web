import { describe, expect, it } from "vitest";
import { yAxisMargin } from "../src/lib/chart-layout";

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

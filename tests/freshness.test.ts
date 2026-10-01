import { describe, it, expect } from "vitest";
import { buildChartStamp } from "../src/lib/freshness";
import { TZ } from "../src/lib/tz";

function formatExpected(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  });
}

describe("buildChartStamp", () => {
  it("rotula el día con prefijo cuando generated_at es válido", () => {
    const iso = "2026-09-15T10:30:00Z";
    expect(buildChartStamp(iso)).toBe(
      `precioreal.mx · actualizado ${formatExpected(iso)}`,
    );
  });

  it("devuelve solo el dominio si generated_at es undefined", () => {
    expect(buildChartStamp(undefined)).toBe("precioreal.mx");
  });

  it("devuelve solo el dominio si generated_at es null", () => {
    expect(buildChartStamp(null)).toBe("precioreal.mx");
  });

  it("devuelve solo el dominio si generated_at es cadena vacía", () => {
    expect(buildChartStamp("")).toBe("precioreal.mx");
  });

  it("devuelve solo el dominio si generated_at no parsea", () => {
    expect(buildChartStamp("no-es-fecha")).toBe("precioreal.mx");
  });
});

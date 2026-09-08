import { describe, it, expect } from "vitest";
import { buildVerdict, formatMXN, parsePrice } from "../src/lib/format";
import type { CatalogProduct } from "../src/contracts/catalog";

function makeProduct(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    sku: "TEST1234",
    name: "Teclado Mecánico Gamer",
    url: "https://cyberpuerta.mx/p/TEST1234",
    image_url: "https://cyberpuerta.mx/img/TEST1234.jpg",
    category: "Periféricos",
    site: "cyberpuerta",
    generated_at: "2026-09-08T12:00:00Z",
    window_days: 90,
    current: {
      price: "1200.00",
      since: "2026-09-01T00:00:00Z",
      available: true,
    },
    typical_90d: "1500.00",
    min_90d: "1200.00",
    max_90d: "1800.00",
    obs: 45,
    series: [
      ["2026-06-01T00:00:00Z", "1500.00", true],
      ["2026-09-01T00:00:00Z", "1200.00", true],
    ],
    ...overrides,
  };
}

describe("format helpers", () => {
  it("parses price and formats MXN currency", () => {
    expect(parsePrice("1250.50")).toBe(1250.5);
    const formatted = formatMXN("1250.50");
    expect(formatted).toContain("1,251");
  });
});

describe("buildVerdict", () => {
  it("handles unavailable products", () => {
    const p = makeProduct({
      current: {
        price: "1500.00",
        since: "2026-09-01T10:00:00Z",
        available: false,
      },
    });

    const v = buildVerdict(p);
    expect(v.tone).toBe("neutral");
    expect(v.headline).toBe("Este producto no está disponible actualmente.");
    expect(v.detail).toContain("El último precio visto fue");
    expect(v.detail).toContain(formatMXN("1500.00"));
  });

  it("handles price below typical and equal to min (lowest)", () => {
    const p = makeProduct({
      current: {
        price: "1100.00",
        since: "2026-09-01T00:00:00Z",
        available: true,
      },
      typical_90d: "1500.00",
      min_90d: "1100.00",
      window_days: 90,
    });

    const v = buildVerdict(p);
    expect(v.tone).toBe("good");
    expect(v.headline).toBe(
      `Está ${formatMXN("400")} por debajo de su precio habitual.`,
    );
    expect(v.detail).toBe(
      "Es el precio más bajo registrado en los últimos 90 días.",
    );
  });

  it("handles price below typical but not the lowest", () => {
    const p = makeProduct({
      current: {
        price: "1300.00",
        since: "2026-09-01T00:00:00Z",
        available: true,
      },
      typical_90d: "1500.00",
      min_90d: "1100.00",
      window_days: 90,
    });

    const v = buildVerdict(p);
    expect(v.tone).toBe("good");
    expect(v.headline).toBe(
      `Está ${formatMXN("200")} por debajo de su precio habitual.`,
    );
    expect(v.detail).toBe(
      `Su precio habitual en 90 días es ${formatMXN("1500.00")}.`,
    );
  });

  it("handles price above typical", () => {
    const p = makeProduct({
      current: {
        price: "1750.00",
        since: "2026-09-01T00:00:00Z",
        available: true,
      },
      typical_90d: "1500.00",
      min_90d: "1100.00",
      window_days: 60,
    });

    const v = buildVerdict(p);
    expect(v.tone).toBe("warn");
    expect(v.headline).toBe(
      `Está ${formatMXN("250")} por encima de su precio habitual.`,
    );
    expect(v.detail).toBe(
      `Su precio habitual en 60 días es ${formatMXN("1500.00")}.`,
    );
  });

  it("handles price equal to typical", () => {
    const p = makeProduct({
      current: {
        price: "1500.00",
        since: "2026-09-01T00:00:00Z",
        available: true,
      },
      typical_90d: "1500.00",
      min_90d: "1100.00",
      window_days: 90,
    });

    const v = buildVerdict(p);
    expect(v.tone).toBe("neutral");
    expect(v.headline).toBe("Está en su precio habitual.");
    expect(v.detail).toBe(
      "Sin cambios frente al promedio de los últimos 90 días.",
    );
  });

  it("treats sub-peso differences as no change, not as a false deal", () => {
    const p = makeProduct({
      current: {
        price: "1499.60",
        since: "2026-09-01T00:00:00Z",
        available: true,
      },
      typical_90d: "1500.00",
      min_90d: "1100.00",
      window_days: 90,
    });

    const v = buildVerdict(p);
    expect(v.tone).toBe("neutral");
    expect(v.headline).toBe("Está en su precio habitual.");
  });
});

import { describe, it, expect } from "vitest";
import type { CatalogProduct } from "../src/contracts/catalog";
import {
  truncar,
  buildTitle,
  buildDescription,
  buildCanonical,
  buildProductJsonLd,
  MAX_TITLE,
  MAX_DESCRIPTION,
} from "../src/lib/seo";

describe("seo", () => {
  const baseProduct: CatalogProduct = {
    sku: "SKU123",
    name: "Mouse Óptico Inalámbrico",
    url: "https://cyberpuerta.mx/p/SKU123",
    image_url: null,
    category: "Accesorios",
    site: "cyberpuerta",
    generated_at: "2026-09-08T12:00:00Z",
    window_days: 90,
    current: {
      price: "350.00",
      since: "2026-09-01T00:00:00Z",
      available: true,
    },
    typical_90d: "400.00",
    min_90d: "300.00",
    max_90d: "450.00",
    obs: 30,
    series: [
      ["2026-06-01T00:00:00Z", "400.00", true],
      ["2026-09-01T00:00:00Z", "350.00", true],
    ],
  };

  it("truncar invariant: never exceeds max length, returns empty string when max < 2", () => {
    expect(truncar("Hola mundo", 0)).toBe("");
    expect(truncar("Hola mundo", 1)).toBe("");
    expect(truncar("Hola mundo", 10)).toBe("Hola mundo");
    expect(truncar("Hola mundo", 9).length).toBeLessThanOrEqual(9);
    expect(
      truncar("PalabraMuyLargaSinEspacios", 10).length,
    ).toBeLessThanOrEqual(10);
    expect(
      truncar("Hola, mundo! Qué tal estás?", 15).length,
    ).toBeLessThanOrEqual(15);
  });

  it("case 1: status ok, available true -> title exact pattern; description has current, typical, min; lengths <= MAX", () => {
    const p = { ...baseProduct, status: "ok" as const };
    const title = buildTitle(p);
    const desc = buildDescription(p);

    expect(title).toBe(
      "Mouse Óptico Inalámbrico — historial de precios en cyberpuerta | PrecioReal",
    );
    expect(title.length).toBeLessThanOrEqual(MAX_TITLE);

    expect(desc).toContain("$350");
    expect(desc).toContain("$400");
    expect(desc).toContain("$300");
    expect(desc).toContain("90 días");
    expect(desc.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
  });

  it("case 2: status insufficient_history -> description does NOT contain typical or min (explicit negative assertion)", () => {
    const p: CatalogProduct = {
      ...baseProduct,
      status: "insufficient_history",
      typical_90d: "400.00",
      min_90d: "300.00",
    };
    const desc = buildDescription(p);

    expect(desc).toContain("$350");
    expect(desc).toContain(
      "Todavía lo estamos rastreando y aún no hay suficiente historial para decir si es buen precio.",
    );
    expect(desc).not.toContain("$400");
    expect(desc).not.toContain("$300");
    expect(desc).not.toContain("400");
    expect(desc).not.toContain("300");
    expect(desc.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
  });

  it("case 3: is_from_price true -> description prefixes 'desde ' to price", () => {
    const p: CatalogProduct = {
      ...baseProduct,
      is_from_price: true,
    };
    const desc = buildDescription(p);
    expect(desc).toContain("desde $350");
  });

  it("case 4: available false + status ok -> says not available and does not present price as current; typical/min can appear", () => {
    const p: CatalogProduct = {
      ...baseProduct,
      status: "ok",
      current: {
        price: "350.00",
        since: "2026-09-01T00:00:00Z",
        available: false,
      },
    };
    const desc = buildDescription(p);
    expect(desc).toContain("no disponible en cyberpuerta");
    expect(desc).toContain("El último precio visto fue $350");
    expect(desc).toContain("Consulta su historial completo en PrecioReal.");
    expect(desc.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
  });

  it("case 5: available false + status insufficient_history -> unavailable branch wins", () => {
    const p: CatalogProduct = {
      ...baseProduct,
      status: "insufficient_history",
      current: {
        price: "350.00",
        since: "2026-09-01T00:00:00Z",
        available: false,
      },
    };
    const desc = buildDescription(p);
    expect(desc).toContain("no disponible en cyberpuerta");
    expect(desc).not.toContain("Todavía lo estamos rastreando");
    expect(desc.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
  });

  it("case 6: long name of 240 chars -> title <= MAX_TITLE, description <= MAX_DESCRIPTION, prices complete", () => {
    const longName = "A".repeat(240);
    const p: CatalogProduct = {
      ...baseProduct,
      name: longName,
    };
    const title = buildTitle(p);
    const desc = buildDescription(p);

    expect(title.length).toBeLessThanOrEqual(MAX_TITLE);
    expect(desc.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
    expect(desc).toContain("$350");
    expect(desc).toContain("$400");
    expect(desc).toContain("$300");
  });

  it("case 7: buildProductJsonLd: returns null with status insufficient_history; ok returns parseable JSON with OutOfStock when unavailable and offers.url is product.url", () => {
    const pInsufficient: CatalogProduct = {
      ...baseProduct,
      status: "insufficient_history",
    };
    expect(buildProductJsonLd(pInsufficient)).toBeNull();

    const pOkUnavailable: CatalogProduct = {
      ...baseProduct,
      status: "ok",
      current: {
        price: "350.00",
        since: "2026-09-01T00:00:00Z",
        available: false,
      },
    };
    const jsonStr = buildProductJsonLd(pOkUnavailable);
    expect(jsonStr).not.toBeNull();
    const parsed = JSON.parse(jsonStr!);
    expect(parsed["@type"]).toBe("Product");
    expect(parsed.offers.availability).toBe("https://schema.org/OutOfStock");
    expect(parsed.offers.url).toBe(baseProduct.url);
  });

  it("case 8: buildProductJsonLd with image_url null -> 'image' key does not exist in parsed object", () => {
    const p: CatalogProduct = {
      ...baseProduct,
      image_url: null,
    };
    const jsonStr = buildProductJsonLd(p);
    const parsed = JSON.parse(jsonStr!);
    expect("image" in parsed).toBe(false);
  });

  it("case 9: buildProductJsonLd with name containing </script> -> returned string does NOT contain </script>, JSON.parse recovers original name", () => {
    const trickyName = 'Monitor Pro </script><script>alert("xss")</script>';
    const p: CatalogProduct = {
      ...baseProduct,
      name: trickyName,
    };
    const jsonStr = buildProductJsonLd(p);
    expect(jsonStr).not.toBeNull();
    expect(jsonStr!).not.toContain("</script>");
    const parsed = JSON.parse(jsonStr!);
    expect(parsed.name).toBe(trickyName);
  });

  it("case 10: buildProductJsonLd never includes aggregateRating nor review", () => {
    const p: CatalogProduct = { ...baseProduct };
    const jsonStr = buildProductJsonLd(p);
    const parsed = JSON.parse(jsonStr!);
    expect(parsed.aggregateRating).toBeUndefined();
    expect(parsed.review).toBeUndefined();
  });

  it('case 11: name with double quote (2.5") -> JSON.parse recovers full original name', () => {
    const quoteName = 'SSD WD Green, 480GB, 2.5"';
    const p: CatalogProduct = {
      ...baseProduct,
      name: quoteName,
    };
    const jsonStr = buildProductJsonLd(p);
    const parsed = JSON.parse(jsonStr!);
    expect(parsed.name).toBe(quoteName);
  });

  it("buildCanonical formats url properly", () => {
    expect(
      buildCanonical("https://precioreal.mx", "cyberpuerta", "SKU123"),
    ).toBe("https://precioreal.mx/cyberpuerta/SKU123");
  });
});

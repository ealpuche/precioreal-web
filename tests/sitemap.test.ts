import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  CatalogIndex,
  CatalogIndexProduct,
} from "../src/contracts/catalog";
import {
  esIndexable,
  claveDeRuta,
  isoLastmod,
  totalArchivos,
  buildUrlset,
  buildSitemapIndex,
} from "../src/lib/sitemap";

describe("sitemap pure helpers", () => {
  it("esIndexable: true with status ok, true with status ausente, false with insufficient_history, false when clave invalid", () => {
    const valid: CatalogIndexProduct = {
      sku: "SKU1",
      name: "Prod 1",
      url: "https://cyberpuerta.mx/p/SKU1",
      image_url: null,
      category: null,
      price: "100.00",
      obs: 1,
      since: "2026-09-01T00:00:00Z",
      available: true,
      is_from_price: false,
      status: "ok",
    };
    expect(esIndexable(valid)).toBe(true);

    const sinStatus = { ...valid };
    delete sinStatus.status;
    expect(esIndexable(sinStatus)).toBe(true);

    const insufficient = { ...valid, status: "insufficient_history" as const };
    expect(esIndexable(insufficient)).toBe(false);

    const badSku = { ...valid, sku: "bad sku with spaces!" };
    expect(esIndexable(badSku)).toBe(false);
  });

  it("claveDeRuta: prefers slug over sku, falls back to sku if slug empty/missing, null if invalid or element non-object", () => {
    const pSlug: CatalogIndexProduct = {
      sku: "SKU1",
      slug: "SLUG-1",
      name: "Prod",
      url: "https://cyberpuerta.mx/p/1",
      image_url: null,
      category: null,
      price: "10",
      obs: 1,
      since: "2026-09-01",
      available: true,
      is_from_price: false,
    };
    expect(claveDeRuta(pSlug)).toBe("SLUG-1");

    const pEmptySlug = { ...pSlug, slug: "" };
    expect(claveDeRuta(pEmptySlug)).toBe("SKU1");

    const pNoSlug = { ...pSlug };
    delete pNoSlug.slug;
    expect(claveDeRuta(pNoSlug)).toBe("SKU1");

    const pBadSku = { ...pNoSlug, sku: "invalid sku @#$" };
    expect(claveDeRuta(pBadSku)).toBeNull();

    expect(claveDeRuta(null as unknown as CatalogIndexProduct)).toBeNull();
    expect(claveDeRuta(undefined as unknown as CatalogIndexProduct)).toBeNull();
    expect(
      claveDeRuta("not an object" as unknown as CatalogIndexProduct),
    ).toBeNull();
  });

  it("isoLastmod: normalizes microseconds, returns null on invalid string, number, undefined", () => {
    expect(isoLastmod("2026-09-09T19:22:07.912484+00:00")).toBe(
      "2026-09-09T19:22:07.912Z",
    );
    expect(isoLastmod("invalid date string")).toBeNull();
    expect(isoLastmod(123456789)).toBeNull();
    expect(isoLastmod(undefined)).toBeNull();
    expect(isoLastmod(null)).toBeNull();
  });

  it("totalArchivos: 1 with 0, 1 with 25381, 1 with 50000, 2 with 50001", () => {
    expect(totalArchivos(0)).toBe(1);
    expect(totalArchivos(25381)).toBe(1);
    expect(totalArchivos(50000)).toBe(1);
    expect(totalArchivos(50001)).toBe(2);
  });

  it("buildUrlset: skips product whose claveDeRuta is null, emits lastmod only when valid, escapes correctly", () => {
    const prods: CatalogIndexProduct[] = [
      {
        sku: "SKU1",
        name: "P1",
        url: "https://cyberpuerta.mx/p/1",
        image_url: null,
        category: null,
        price: "10",
        obs: 1,
        since: "2026-09-09T12:00:00Z",
        available: true,
        is_from_price: false,
      },
      {
        sku: "bad sku with spaces",
        name: "P2",
        url: "https://cyberpuerta.mx/p/2",
        image_url: null,
        category: null,
        price: "10",
        obs: 1,
        since: "2026-09-09T12:00:00Z",
        available: true,
        is_from_price: false,
      },
      {
        sku: "SKU&2",
        slug: "SKU_2",
        name: "P3",
        url: "https://cyberpuerta.mx/p/3",
        image_url: null,
        category: null,
        price: "10",
        obs: 1,
        since: "invalid-date",
        available: true,
        is_from_price: false,
      },
    ];

    const xml = buildUrlset("https://precioreal.mx", "cyberpuerta", prods);
    expect(xml).toContain("<loc>https://precioreal.mx/cyberpuerta/SKU1</loc>");
    expect(xml).toContain("<lastmod>2026-09-09T12:00:00.000Z</lastmod>");
    expect(xml).not.toContain("bad sku with spaces");
    expect(xml).toContain("<loc>https://precioreal.mx/cyberpuerta/SKU_2</loc>");
    // Product 3 has invalid since, so no lastmod for it
    expect(xml).not.toContain("<lastmod>invalid-date</lastmod>");
    expect(xml).not.toContain("<changefreq>");
    expect(xml).not.toContain("<priority>");
  });

  it("buildSitemapIndex: generates valid sitemapindex with loc and lastmod", () => {
    const entradas = [
      { tienda: "cyberpuerta", n: 1, lastmod: "2026-09-09T12:00:00.000Z" },
      { tienda: "cyberpuerta", n: 2, lastmod: null },
    ];
    const xml = buildSitemapIndex("https://precioreal.mx", entradas);
    expect(xml).toContain(
      "<loc>https://precioreal.mx/sitemap/cyberpuerta/1.xml</loc>",
    );
    expect(xml).toContain("<lastmod>2026-09-09T12:00:00.000Z</lastmod>");
    expect(xml).toContain(
      "<loc>https://precioreal.mx/sitemap/cyberpuerta/2.xml</loc>",
    );
  });
});

describe("sitemap endpoints", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const sampleIndex: CatalogIndex = {
    generated_at: "2026-09-09T12:00:00Z",
    site: "cyberpuerta",
    window_days: 90,
    count: 3,
    products: [
      {
        sku: "SKU-OK-1",
        slug: "slug-ok-1",
        name: "Product OK 1",
        url: "https://cyberpuerta.mx/p/1",
        image_url: null,
        category: null,
        price: "100.00",
        obs: 10,
        since: "2026-09-01T00:00:00Z",
        available: true,
        is_from_price: false,
        status: "ok",
      },
      {
        sku: "SKU-OK-2",
        slug: "slug-ok-2",
        name: "Product OK 2",
        url: "https://cyberpuerta.mx/p/2",
        image_url: null,
        category: null,
        price: "200.00",
        obs: 10,
        since: "2026-09-02T00:00:00Z",
        available: true,
        is_from_price: false,
        status: "ok",
      },
      {
        sku: "SKU-INSUFFICIENT",
        slug: "slug-insufficient",
        name: "Product Insufficient",
        url: "https://cyberpuerta.mx/p/3",
        image_url: null,
        category: null,
        price: "300.00",
        obs: 1,
        since: "2026-09-03T00:00:00Z",
        available: true,
        is_from_price: false,
        status: "insufficient_history",
      },
    ],
  };

  it("index with 2 'ok' + 1 'insufficient_history' -> GET /sitemap/cyberpuerta/1.xml returns 200, Content-Type application/xml, Cache-Control, contains 2 expected loc and DOES NOT contain insufficient_history slug", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => sampleIndex,
    } as unknown as Response);

    const chunkEndpoint = await import("../src/pages/sitemap/[tienda]/[n].xml");
    const response = await chunkEndpoint.GET({
      params: { tienda: "cyberpuerta", n: "1" },
      site: new URL("https://precioreal.mx"),
    } as any);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/xml; charset=utf-8",
    );
    expect(response.headers.get("Cache-Control")).toContain("max-age=14400");

    const text = await response.text();
    expect(text).toContain(
      "<loc>https://precioreal.mx/cyberpuerta/slug-ok-1</loc>",
    );
    expect(text).toContain(
      "<loc>https://precioreal.mx/cyberpuerta/slug-ok-2</loc>",
    );
    expect(text).not.toContain("slug-insufficient");
  });

  it("fetch rejects -> both endpoints return 503 with Retry-After and Cache-Control: no-store, and body does NOT contain <urlset nor <sitemapindex", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network failed"));

    const indexEndpoint = await import("../src/pages/sitemap.xml");
    const resIndex = await indexEndpoint.GET({
      site: new URL("https://precioreal.mx"),
    } as any);

    expect(resIndex.status).toBe(503);
    expect(resIndex.headers.get("Retry-After")).toBe("300");
    expect(resIndex.headers.get("Cache-Control")).toBe("no-store");
    const bodyIndex = await resIndex.text();
    expect(bodyIndex).not.toContain("<sitemapindex");

    const chunkEndpoint = await import("../src/pages/sitemap/[tienda]/[n].xml");
    const resChunk = await chunkEndpoint.GET({
      params: { tienda: "cyberpuerta", n: "1" },
      site: new URL("https://precioreal.mx"),
    } as any);

    expect(resChunk.status).toBe(503);
    expect(resChunk.headers.get("Retry-After")).toBe("300");
    expect(resChunk.headers.get("Cache-Control")).toBe("no-store");
    const bodyChunk = await resChunk.text();
    expect(bodyChunk).not.toContain("<urlset");
  });

  it("valid index but with 0 indexables -> 503, not an empty urlset", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ...sampleIndex,
        products: [
          {
            ...sampleIndex.products[2], // insufficient_history
          },
        ],
      }),
    } as unknown as Response);

    const indexEndpoint = await import("../src/pages/sitemap.xml");
    const resIndex = await indexEndpoint.GET({
      site: new URL("https://precioreal.mx"),
    } as any);
    expect(resIndex.status).toBe(503);

    const chunkEndpoint = await import("../src/pages/sitemap/[tienda]/[n].xml");
    const resChunk = await chunkEndpoint.GET({
      params: { tienda: "cyberpuerta", n: "1" },
      site: new URL("https://precioreal.mx"),
    } as any);
    expect(resChunk.status).toBe(503);
  });

  it("unknown tienda -> 404. n = '0', 'abc', '-1', '01' -> 404", async () => {
    const chunkEndpoint = await import("../src/pages/sitemap/[tienda]/[n].xml");

    const resUnknownTienda = await chunkEndpoint.GET({
      params: { tienda: "tiendainventada", n: "1" },
    } as any);
    expect(resUnknownTienda.status).toBe(404);

    for (const badN of ["0", "abc", "-1", "01"]) {
      const resBadN = await chunkEndpoint.GET({
        params: { tienda: "cyberpuerta", n: badN },
      } as any);
      expect(resBadN.status).toBe(404);
    }
  });

  it("n greater than totalArchivos -> 404", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => sampleIndex,
    } as unknown as Response);

    const chunkEndpoint = await import("../src/pages/sitemap/[tienda]/[n].xml");
    const res = await chunkEndpoint.GET({
      params: { tienda: "cyberpuerta", n: "2" },
    } as any);
    expect(res.status).toBe(404);
  });

  it("/sitemap.xml with 25381 simulated indexables -> sitemapindex contains exactly 1 <sitemap> and loc is /sitemap/cyberpuerta/1.xml", async () => {
    const prods: CatalogIndexProduct[] = [];
    for (let i = 0; i < 25381; i++) {
      prods.push({
        sku: `SKU-${i}`,
        slug: `slug-${i}`,
        name: `Product ${i}`,
        url: `https://cyberpuerta.mx/p/${i}`,
        image_url: null,
        category: null,
        price: "100.00",
        obs: 1,
        since: "2026-09-01T00:00:00Z",
        available: true,
        is_from_price: false,
        status: "ok",
      });
    }

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ...sampleIndex,
        products: prods,
      }),
    } as unknown as Response);

    const indexEndpoint = await import("../src/pages/sitemap.xml");
    const res = await indexEndpoint.GET({
      site: new URL("https://precioreal.mx"),
    } as any);

    expect(res.status).toBe(200);
    const text = await res.text();
    const matches = text.match(/<sitemap>/g);
    expect(matches?.length).toBe(1);
    expect(text).toContain(
      "<loc>https://precioreal.mx/sitemap/cyberpuerta/1.xml</loc>",
    );
  });

  it("/sitemap.xml: el lastmod del chunk es el since máximo, no el primero ni el último", async () => {
    // 3 productos ok con since 2026-09-01, 2026-09-07 (máximo, en medio), 2026-09-03
    const prods: CatalogIndexProduct[] = [
      {
        sku: "SKU-1",
        slug: "slug-1",
        name: "P1",
        url: "https://cyberpuerta.mx/p/1",
        image_url: null,
        category: null,
        price: "100.00",
        obs: 1,
        since: "2026-09-01T00:00:00.000Z",
        available: true,
        is_from_price: false,
        status: "ok",
      },
      {
        sku: "SKU-2",
        slug: "slug-2",
        name: "P2",
        url: "https://cyberpuerta.mx/p/2",
        image_url: null,
        category: null,
        price: "200.00",
        obs: 1,
        since: "2026-09-07T00:00:00.000Z",
        available: true,
        is_from_price: false,
        status: "ok",
      },
      {
        sku: "SKU-3",
        slug: "slug-3",
        name: "P3",
        url: "https://cyberpuerta.mx/p/3",
        image_url: null,
        category: null,
        price: "300.00",
        obs: 1,
        since: "2026-09-03T00:00:00.000Z",
        available: true,
        is_from_price: false,
        status: "ok",
      },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ...sampleIndex,
        products: prods,
      }),
    } as unknown as Response);

    const indexEndpoint = await import("../src/pages/sitemap.xml");
    const res = await indexEndpoint.GET({
      site: new URL("https://precioreal.mx"),
    } as any);

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("<lastmod>2026-09-07T00:00:00.000Z</lastmod>");
    expect(text).not.toContain("2026-09-01T00:00:00.000Z");
    expect(text).not.toContain("2026-09-03T00:00:00.000Z");
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchProduct } from "../src/lib/catalog";
import type { CatalogProduct } from "../src/contracts/catalog";

describe("fetchProduct", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const sampleProduct: CatalogProduct = {
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

  it("returns { ok: true, product } when fetch succeeds with valid JSON", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => sampleProduct,
    } as unknown as Response);

    const result = await fetchProduct("cyberpuerta", "SKU123");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://feed.precioreal.mx/cyberpuerta/products/SKU123.json",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.product).toEqual(sampleProduct);
    }
  });

  it("returns { ok: false, reason: 'not_found' } when upstream returns 404", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    } as unknown as Response);

    const result = await fetchProduct("cyberpuerta", "NONEXISTENT");
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("returns { ok: false, reason: 'upstream_error' } when upstream returns 500", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as unknown as Response);

    const result = await fetchProduct("cyberpuerta", "SKU123");
    expect(result).toEqual({ ok: false, reason: "upstream_error" });
  });

  it("returns { ok: false, reason: 'upstream_error' } when fetch throws an error", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error("Network connection failed"));

    const result = await fetchProduct("cyberpuerta", "SKU123");
    expect(result).toEqual({ ok: false, reason: "upstream_error" });
  });

  it("returns { ok: false, reason: 'upstream_error' } when JSON parsing fails", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token in JSON");
      },
    } as unknown as Response);

    const result = await fetchProduct("cyberpuerta", "SKU123");
    expect(result).toEqual({ ok: false, reason: "upstream_error" });
  });

  it("returns invalid_route without calling fetch when the tienda is not in the allowlist", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const result = await fetchProduct("wp-admin", "x");

    expect(result).toEqual({ ok: false, reason: "invalid_route" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns invalid_route without calling fetch when the sku fails the charset guard", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const result = await fetchProduct("cyberpuerta", "a b/../x");

    expect(result).toEqual({ ok: false, reason: "invalid_route" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns upstream_error when a field the page renders is missing", async () => {
    const { max_90d: _omit, ...partial } = sampleProduct;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => partial,
    } as unknown as Response);

    const result = await fetchProduct("cyberpuerta", "SKU123");
    expect(result).toEqual({ ok: false, reason: "upstream_error" });
  });

  it("returns upstream_error when the JSON has an unexpected shape", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ hello: "world" }),
    } as unknown as Response);

    const result = await fetchProduct("cyberpuerta", "SKU123");
    expect(result).toEqual({ ok: false, reason: "upstream_error" });
  });

  it("accepts a payload without is_from_price, since older fichas predate it", async () => {
    const { is_from_price: _omit, ...withoutField } = {
      ...sampleProduct,
      is_from_price: true,
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => withoutField,
    } as unknown as Response);

    const result = await fetchProduct("cyberpuerta", "SKU123");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.product.is_from_price).toBeUndefined();
    }
  });

  it("passes is_from_price through when the producer sends it", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ...sampleProduct, is_from_price: true }),
    } as unknown as Response);

    const result = await fetchProduct("cyberpuerta", "SKU123");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.product.is_from_price).toBe(true);
    }
  });

  it("returns upstream_error when a field the header prints is missing", async () => {
    const { obs: _omit, ...partial } = sampleProduct;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => partial,
    } as unknown as Response);

    const result = await fetchProduct("cyberpuerta", "SKU123");
    expect(result).toEqual({ ok: false, reason: "upstream_error" });
  });

  it("returns upstream_error when is_from_price is present with the wrong type", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ...sampleProduct, is_from_price: "true" }),
    } as unknown as Response);

    const result = await fetchProduct("cyberpuerta", "SKU123");
    expect(result).toEqual({ ok: false, reason: "upstream_error" });
  });

  describe("status handling", () => {
    it("accepts a payload with status 'insufficient_history' without window statistics", async () => {
      const {
        typical_90d: _t,
        min_90d: _m,
        max_90d: _mx,
        ...insufficient
      } = {
        ...sampleProduct,
        status: "insufficient_history" as const,
        first_seen_at: "2026-09-01T00:00:00Z",
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => insufficient,
      } as unknown as Response);

      const result = await fetchProduct("cyberpuerta", "SKU123");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.product.status).toBe("insufficient_history");
        expect(result.product.typical_90d).toBeUndefined();
        expect(result.product.min_90d).toBeUndefined();
        expect(result.product.max_90d).toBeUndefined();
      }
    });

    it("returns upstream_error when status is 'ok' but missing max_90d", async () => {
      const { max_90d: _mx, ...missingMax } = {
        ...sampleProduct,
        status: "ok" as const,
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => missingMax,
      } as unknown as Response);

      const result = await fetchProduct("cyberpuerta", "SKU123");
      expect(result).toEqual({ ok: false, reason: "upstream_error" });
    });

    it("accepts a payload without status with the three window statistics", async () => {
      const withoutStatus = {
        ...sampleProduct,
      };
      delete (withoutStatus as any).status;

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => withoutStatus,
      } as unknown as Response);

      const result = await fetchProduct("cyberpuerta", "SKU123");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.product.status).toBeUndefined();
        expect(result.product.typical_90d).toBe("400.00");
      }
    });

    it("returns upstream_error when status has an unknown value", async () => {
      const withUnknownStatus = {
        ...sampleProduct,
        status: "unknown_status",
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => withUnknownStatus,
      } as unknown as Response);

      const result = await fetchProduct("cyberpuerta", "SKU123");
      expect(result).toEqual({ ok: false, reason: "upstream_error" });
    });

    it("rejects an insufficient_history payload whose stats are not strings", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          ...sampleProduct,
          status: "insufficient_history",
          typical_90d: 400,
        }),
      } as unknown as Response);

      const result = await fetchProduct("cyberpuerta", "SKU123");
      expect(result).toEqual({ ok: false, reason: "upstream_error" });
    });
  });

  describe("resolveProductUrl", () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      vi.resetModules();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    const sampleIndex = {
      generated_at: "2026-09-08T12:00:00Z",
      site: "cyberpuerta",
      window_days: 90,
      count: 2,
      products: [
        {
          sku: "SKU-001",
          slug: "SKU-001",
          name: "Producto Uno",
          url: "https://www.cyberpuerta.mx/Computadoras/Laptops/Laptop-1.html",
          image_url: null,
          category: "Laptops",
          price: "15000.00",
          obs: 30,
          since: "2026-09-01T00:00:00Z",
          available: true,
          is_from_price: false,
        },
        {
          sku: "SKU-002",
          slug: "SKU-002",
          name: "Producto Dos",
          url: "https://www.cyberpuerta.mx/Computadoras/Accesorios/Mouse-2.html",
          image_url: null,
          category: "Accesorios",
          price: "350.00",
          obs: 30,
          since: "2026-09-01T00:00:00Z",
          available: true,
          is_from_price: false,
        },
      ],
    };

    it("returns sku on exact match", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => sampleIndex,
      } as unknown as Response);

      const { resolveProductUrl } = await import("../src/lib/catalog");
      const result = await resolveProductUrl(
        "cyberpuerta",
        "cyberpuerta.mx/Computadoras/Laptops/Laptop-1.html",
      );

      expect(result).toEqual({ ok: true, sku: "SKU-001" });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://feed.precioreal.mx/cyberpuerta/products/index.json",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it("returns sku when user url had utm_source (normalizedUrl matches index url)", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => sampleIndex,
      } as unknown as Response);

      const { resolveProductUrl } = await import("../src/lib/catalog");
      const { normalizeProductUrl } = await import("../src/lib/product-url");
      const normalizedUserUrl = normalizeProductUrl(
        "https://www.cyberpuerta.mx/Computadoras/Accesorios/Mouse-2.html?utm_source=google&utm_campaign=sale",
      );
      expect(normalizedUserUrl).not.toBeNull();

      const result = await resolveProductUrl("cyberpuerta", normalizedUserUrl!);
      expect(result).toEqual({ ok: true, sku: "SKU-002" });
    });

    it("returns not_found when url is not in the index", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => sampleIndex,
      } as unknown as Response);

      const { resolveProductUrl } = await import("../src/lib/catalog");
      const result = await resolveProductUrl(
        "cyberpuerta",
        "cyberpuerta.mx/NoExiste/Producto.html",
      );
      expect(result).toEqual({ ok: false, reason: "not_found" });
    });

    it("returns upstream_error when fetch rejects", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const { resolveProductUrl } = await import("../src/lib/catalog");
      const result = await resolveProductUrl(
        "cyberpuerta",
        "cyberpuerta.mx/Computadoras/Laptops/Laptop-1.html",
      );
      expect(result).toEqual({ ok: false, reason: "upstream_error" });
    });

    it("returns not_found without calling fetch when tienda is not allowed", async () => {
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock;

      const { resolveProductUrl } = await import("../src/lib/catalog");
      const result = await resolveProductUrl("otra_tienda", "algo");
      expect(result).toEqual({ ok: false, reason: "not_found" });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("retries the index fetch after a failed attempt", async () => {
      // Regresión CR PR #11, H1: la versión anterior cacheaba la promesa resuelta a null, así
      // que un fallo transitorio dejaba la búsqueda rota durante toda la vida del isolate.
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new Error("timeout"))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => sampleIndex,
        } as unknown as Response);
      globalThis.fetch = fetchMock;

      const { resolveProductUrl } = await import("../src/lib/catalog");
      const url = "cyberpuerta.mx/Computadoras/Laptops/Laptop-1.html";

      expect(await resolveProductUrl("cyberpuerta", url)).toEqual({
        ok: false,
        reason: "upstream_error",
      });
      expect(await resolveProductUrl("cyberpuerta", url)).toEqual({
        ok: true,
        sku: "SKU-001",
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("reuses the index across calls once it loaded", async () => {
      // La única propiedad que justifica que el caché exista, y que ningún test cubría:
      // vi.resetModules() en beforeEach lo destruía antes de cada caso.
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => sampleIndex,
      } as unknown as Response);
      globalThis.fetch = fetchMock;

      const { resolveProductUrl } = await import("../src/lib/catalog");

      await resolveProductUrl(
        "cyberpuerta",
        "cyberpuerta.mx/Computadoras/Laptops/Laptop-1.html",
      );
      await resolveProductUrl(
        "cyberpuerta",
        "cyberpuerta.mx/Computadoras/Accesorios/Mouse-2.html",
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("skips malformed index entries instead of throwing", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          ...sampleIndex,
          products: [
            null,
            { url: 123, sku: "SKU-RARO" },
            { url: "https://www.cyberpuerta.mx/x/Bueno.html", sku: 42 },
            sampleIndex.products[0],
          ],
        }),
      } as unknown as Response);

      const { resolveProductUrl } = await import("../src/lib/catalog");
      const result = await resolveProductUrl(
        "cyberpuerta",
        "cyberpuerta.mx/Computadoras/Laptops/Laptop-1.html",
      );

      expect(result).toEqual({ ok: true, sku: "SKU-001" });
    });

    it("returns the slug, not the sku, when they differ", async () => {
      // Regresión #13: la ficha de un producto cuyo sku lleva espacios vive bajo su slug.
      // Devolver el sku producía /cyberpuerta/B840M%20GAMING%20WIFI6E, que da 404 —
      // verificado en producción antes de este cambio.
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          ...sampleIndex,
          products: [
            {
              ...sampleIndex.products[0],
              sku: "B840M GAMING WIFI6E",
              slug: "B840M-GAMING-WIFI6E",
              url: "https://www.cyberpuerta.mx/Tarjetas-Madre/MSI-B840M-Gaming.html",
            },
          ],
        }),
      } as unknown as Response);

      const { resolveProductUrl } = await import("../src/lib/catalog");
      const result = await resolveProductUrl(
        "cyberpuerta",
        "cyberpuerta.mx/Tarjetas-Madre/MSI-B840M-Gaming.html",
      );

      expect(result).toEqual({ ok: true, sku: "B840M-GAMING-WIFI6E" });
    });

    it("falls back to the sku when the entry predates the slug field", async () => {
      const { slug: _sinSlug, ...sinSlug } = sampleIndex.products[0];
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ...sampleIndex, products: [sinSlug] }),
      } as unknown as Response);

      const { resolveProductUrl } = await import("../src/lib/catalog");
      const result = await resolveProductUrl(
        "cyberpuerta",
        "cyberpuerta.mx/Computadoras/Laptops/Laptop-1.html",
      );

      expect(result).toEqual({ ok: true, sku: "SKU-001" });
    });

    it("reports not_found when the entry has no slug and its sku cannot go in a route", async () => {
      // Durante la propagación del backfill una ficha puede no traer slug todavía. Redirigir
      // con un sku que lleva espacios produce un 404 garantizado y el mensaje equivocado
      // (CR PR #14, H2).
      const { slug: _sin, ...sinSlug } = sampleIndex.products[0];
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          ...sampleIndex,
          products: [
            {
              ...sinSlug,
              sku: "B840M GAMING WIFI6E",
              url: "https://www.cyberpuerta.mx/Tarjetas-Madre/MSI-B840M-Gaming.html",
            },
          ],
        }),
      } as unknown as Response);

      const { resolveProductUrl } = await import("../src/lib/catalog");
      const result = await resolveProductUrl(
        "cyberpuerta",
        "cyberpuerta.mx/Tarjetas-Madre/MSI-B840M-Gaming.html",
      );

      expect(result).toEqual({ ok: false, reason: "not_found" });
    });

    it("falls back to the sku when slug is empty or not a string", async () => {
      // La condición tiene tres ramas y solo dos tenían test: un refactor a `p.slug ?? p.sku`
      // pasaba los 96 y redirigía a /cyberpuerta/ con slug: "" (CR PR #14, H3).
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          ...sampleIndex,
          products: [
            { ...sampleIndex.products[0], slug: "" },
            { ...sampleIndex.products[1], slug: 42 },
          ],
        }),
      } as unknown as Response);

      const { resolveProductUrl } = await import("../src/lib/catalog");

      expect(
        await resolveProductUrl(
          "cyberpuerta",
          "cyberpuerta.mx/Computadoras/Laptops/Laptop-1.html",
        ),
      ).toEqual({ ok: true, sku: "SKU-001" });
      expect(
        await resolveProductUrl(
          "cyberpuerta",
          "cyberpuerta.mx/Computadoras/Accesorios/Mouse-2.html",
        ),
      ).toEqual({ ok: true, sku: "SKU-002" });
    });

    it("re-lee el índice cuando el TTL de 4 h expiró", async () => {
      vi.useFakeTimers();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ products: [sampleIndex.products[0]] }),
      });
      globalThis.fetch = fetchMock;
      const { resolveProductUrl } = await import("../src/lib/catalog");
      const { normalizeProductUrl } = await import("../src/lib/product-url");
      const u = normalizeProductUrl(sampleIndex.products[0].url);

      await resolveProductUrl("cyberpuerta", u!);
      await resolveProductUrl("cyberpuerta", u!);
      expect(fetchMock).toHaveBeenCalledTimes(1); // dentro del TTL: caché

      vi.advanceTimersByTime(4 * 3600 * 1000 + 1);
      await resolveProductUrl("cyberpuerta", u!);
      expect(fetchMock).toHaveBeenCalledTimes(2); // expirado: re-lee

      vi.useRealTimers();
    });
  });
});

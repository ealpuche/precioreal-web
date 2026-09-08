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
});

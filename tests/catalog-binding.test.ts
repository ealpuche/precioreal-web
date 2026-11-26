import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ficha from "./fixtures/kpm-610b.json";

// #67: con el binding de R2 `CATALOG` el catálogo se lee del bucket y no por HTTP a
// feed.precioreal.mx, que Bot Fight Mode bloqueó del 5 al 26 de octubre de 2026. Sin el
// binding (se crea a mano en el dashboard de Pages) todo sigue leyendo por HTTP.

const CLAVE_FICHA = "cyberpuerta/products/KPM-610B.json";
const CLAVE_INDICE = "cyberpuerta/products/index.json";
const URL_KPM = "cyberpuerta.mx/x/Klip-Xtreme-Soporte-KPM-610B.html";

const indice = {
  generated_at: "2026-10-20T12:00:00Z",
  site: "cyberpuerta",
  window_days: 90,
  count: 1,
  products: [
    {
      sku: "KPM-610B",
      slug: "KPM-610B",
      name: "Soporte",
      url: `https://www.${URL_KPM}`,
      image_url: null,
      category: null,
      price: "100.00",
      obs: 10,
      since: "2026-09-01T00:00:00Z",
      available: true,
      is_from_price: false,
      status: "ok",
    },
  ],
};

/**
 * Doble del binding de R2: guarda el texto de cada objeto, `get` resuelve a null si la
 * clave no existe y `json()` parsea el texto, como el R2ObjectBody real.
 */
function bucketFalso(objetos: Record<string, string>) {
  const get = vi.fn(async (key: string) =>
    Object.prototype.hasOwnProperty.call(objetos, key)
      ? { json: async () => JSON.parse(objetos[key]) as unknown }
      : null,
  );
  return { get };
}

const conBinding = (bucket: { get: unknown }) => ({ env: { CATALOG: bucket } });

describe("catálogo por binding de R2 (#67)", () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // El caché del índice vive en el módulo: cada caso arranca con un isolate nuevo.
    vi.resetModules();
    fetchMock = vi.fn().mockRejectedValue(new Error("no debe usarse la red"));
    globalThis.fetch = fetchMock as never;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("fetchProduct", () => {
    it("lee la ficha por el binding, con la clave del productor, sin fetch al feed", async () => {
      const bucket = bucketFalso({ [CLAVE_FICHA]: JSON.stringify(ficha) });
      const { fetchProduct } = await import("../src/lib/catalog");

      const r = await fetchProduct(
        "cyberpuerta",
        "KPM-610B",
        conBinding(bucket),
      );

      expect(r).toEqual({ ok: true, product: ficha });
      expect(bucket.get).toHaveBeenCalledTimes(1);
      expect(bucket.get).toHaveBeenCalledWith(CLAVE_FICHA);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("objeto ausente en el bucket es not_found, sin caer a HTTP", async () => {
      const bucket = bucketFalso({});
      const { fetchProduct } = await import("../src/lib/catalog");

      const r = await fetchProduct(
        "cyberpuerta",
        "KPM-610B",
        conBinding(bucket),
      );

      expect(r).toEqual({ ok: false, reason: "not_found" });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("un error del binding es upstream_error, se registra y no cae a HTTP", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const bucket = {
        get: vi.fn().mockRejectedValue(new Error("R2 internal error")),
      };
      const { fetchProduct } = await import("../src/lib/catalog");

      const r = await fetchProduct(
        "cyberpuerta",
        "KPM-610B",
        conBinding(bucket),
      );

      expect(r).toEqual({ ok: false, reason: "upstream_error" });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        JSON.stringify({
          t: "catalog_error",
          via: "r2",
          error: "R2 internal error",
        }),
      );
    });

    it("un binding que lanza algo que no es Error también es upstream_error", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const bucket = {
        get: vi.fn(() => {
          throw "roto";
        }),
      };
      const { fetchProduct } = await import("../src/lib/catalog");

      const r = await fetchProduct(
        "cyberpuerta",
        "KPM-610B",
        conBinding(bucket),
      );

      expect(r).toEqual({ ok: false, reason: "upstream_error" });
      expect(errorSpy).toHaveBeenCalledWith(
        JSON.stringify({ t: "catalog_error", via: "r2", error: "roto" }),
      );
    });

    it("JSON inválido en el objeto es upstream_error", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const bucket = bucketFalso({ [CLAVE_FICHA]: "{esto no es json" });
      const { fetchProduct } = await import("../src/lib/catalog");

      const r = await fetchProduct(
        "cyberpuerta",
        "KPM-610B",
        conBinding(bucket),
      );

      expect(r).toEqual({ ok: false, reason: "upstream_error" });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("un objeto con forma inesperada es upstream_error, igual que por HTTP", async () => {
      const bucket = bucketFalso({ [CLAVE_FICHA]: '{"hola":"mundo"}' });
      const { fetchProduct } = await import("../src/lib/catalog");

      const r = await fetchProduct(
        "cyberpuerta",
        "KPM-610B",
        conBinding(bucket),
      );

      expect(r).toEqual({ ok: false, reason: "upstream_error" });
    });

    it("un binding que no responde corta a los 5 s con upstream_error", async () => {
      vi.useFakeTimers();
      vi.spyOn(console, "error").mockImplementation(() => {});
      const bucket = { get: vi.fn(() => new Promise<null>(() => {})) };
      const { fetchProduct } = await import("../src/lib/catalog");

      let resuelto: unknown = "pendiente";
      const pendiente = fetchProduct(
        "cyberpuerta",
        "KPM-610B",
        conBinding(bucket),
      ).then((r) => (resuelto = r));

      await vi.advanceTimersByTimeAsync(4999);
      expect(resuelto).toBe("pendiente");
      await vi.advanceTimersByTimeAsync(1);
      await pendiente;
      expect(resuelto).toEqual({ ok: false, reason: "upstream_error" });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("una ruta inválida no toca el bucket", async () => {
      const bucket = bucketFalso({});
      const { fetchProduct } = await import("../src/lib/catalog");

      expect(await fetchProduct("wp-admin", "x", conBinding(bucket))).toEqual({
        ok: false,
        reason: "invalid_route",
      });
      expect(
        await fetchProduct("cyberpuerta", "a b/../x", conBinding(bucket)),
      ).toEqual({ ok: false, reason: "invalid_route" });
      expect(bucket.get).not.toHaveBeenCalled();
    });
  });

  describe("sin binding se lee por HTTP, como antes", () => {
    const feedResponde = () =>
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify(ficha), { status: 200 }),
      );

    it.each([
      ["runtime ausente", undefined],
      ["runtime sin env", {}],
      ["env sin CATALOG", { env: {} }],
      [
        "CATALOG que no es un bucket",
        { env: { CATALOG: "precioreal-public" } },
      ],
    ])("%s", async (_caso, runtime) => {
      feedResponde();
      const { fetchProduct, catalogSource } =
        await import("../src/lib/catalog");

      const r = await fetchProduct("cyberpuerta", "KPM-610B", runtime as never);

      expect(r.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://feed.precioreal.mx/cyberpuerta/products/KPM-610B.json",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
      expect(catalogSource(runtime as never)).toBe("http");
    });

    it("catalogSource dice r2 cuando el binding existe", async () => {
      const { catalogSource } = await import("../src/lib/catalog");
      expect(catalogSource(conBinding(bucketFalso({})))).toBe("r2");
    });
  });

  describe("fetchIndex y resolveProductUrl", () => {
    it("lee el índice por el binding y lo reutiliza dentro del isolate", async () => {
      const bucket = bucketFalso({ [CLAVE_INDICE]: JSON.stringify(indice) });
      const { fetchIndex, resolveProductUrl } =
        await import("../src/lib/catalog");
      const runtime = conBinding(bucket);

      expect(await fetchIndex("cyberpuerta", runtime)).toEqual(indice);
      expect(await resolveProductUrl("cyberpuerta", URL_KPM, runtime)).toEqual({
        ok: true,
        sku: "KPM-610B",
      });

      expect(bucket.get).toHaveBeenCalledTimes(1);
      expect(bucket.get).toHaveBeenCalledWith(CLAVE_INDICE);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("dos lecturas simultáneas comparten una sola lectura del bucket", async () => {
      const bucket = bucketFalso({ [CLAVE_INDICE]: JSON.stringify(indice) });
      const { fetchIndex } = await import("../src/lib/catalog");
      const runtime = conBinding(bucket);

      await Promise.all([
        fetchIndex("cyberpuerta", runtime),
        fetchIndex("cyberpuerta", runtime),
      ]);

      expect(bucket.get).toHaveBeenCalledTimes(1);
    });

    it("no cachea un fallo del binding: el siguiente intento vuelve a leer", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const bueno = bucketFalso({ [CLAVE_INDICE]: JSON.stringify(indice) });
      const get = vi
        .fn()
        .mockRejectedValueOnce(new Error("R2 internal error"))
        .mockImplementation(bueno.get);
      const { resolveProductUrl } = await import("../src/lib/catalog");
      const runtime = conBinding({ get });

      expect(await resolveProductUrl("cyberpuerta", URL_KPM, runtime)).toEqual({
        ok: false,
        reason: "upstream_error",
      });
      expect(await resolveProductUrl("cyberpuerta", URL_KPM, runtime)).toEqual({
        ok: true,
        sku: "KPM-610B",
      });
      expect(get).toHaveBeenCalledTimes(2);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("índice ausente o sin `products` es null y no se cachea", async () => {
      const { fetchIndex } = await import("../src/lib/catalog");

      const vacio = bucketFalso({});
      expect(await fetchIndex("cyberpuerta", conBinding(vacio))).toBeNull();

      const sinProductos = bucketFalso({ [CLAVE_INDICE]: '{"count":0}' });
      expect(
        await fetchIndex("cyberpuerta", conBinding(sinProductos)),
      ).toBeNull();
      expect(
        await fetchIndex("cyberpuerta", conBinding(sinProductos)),
      ).toBeNull();
      expect(sinProductos.get).toHaveBeenCalledTimes(2);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("re-lee el índice del bucket cuando el TTL de 4 h expiró", async () => {
      vi.useFakeTimers();
      const bucket = bucketFalso({ [CLAVE_INDICE]: JSON.stringify(indice) });
      const { fetchIndex } = await import("../src/lib/catalog");
      const runtime = conBinding(bucket);

      await fetchIndex("cyberpuerta", runtime);
      vi.advanceTimersByTime(4 * 3600 * 1000 - 1);
      await fetchIndex("cyberpuerta", runtime);
      expect(bucket.get).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(2);
      await fetchIndex("cyberpuerta", runtime);
      expect(bucket.get).toHaveBeenCalledTimes(2);
    });
  });

  describe("rutas", () => {
    const pedirSitemaps = async (locals: unknown) => {
      const indexEndpoint = await import("../src/pages/sitemap.xml");
      const chunkEndpoint =
        await import("../src/pages/sitemap/[tienda]/[n].xml");
      const site = new URL("https://precioreal.mx");
      return {
        index: await indexEndpoint.GET({ site, locals } as never),
        chunk: await chunkEndpoint.GET({
          params: { tienda: "cyberpuerta", n: "1" },
          site,
          locals,
        } as never),
      };
    };

    it("los sitemaps leen el índice por el binding y lo dicen en la cabecera", async () => {
      const bucket = bucketFalso({ [CLAVE_INDICE]: JSON.stringify(indice) });

      const { index, chunk } = await pedirSitemaps({
        runtime: conBinding(bucket),
      });

      expect(index.status).toBe(200);
      expect(index.headers.get("X-Catalog-Source")).toBe("r2");
      expect(await index.text()).toContain(
        "<loc>https://precioreal.mx/sitemap/cyberpuerta/1.xml</loc>",
      );
      expect(chunk.status).toBe(200);
      expect(chunk.headers.get("X-Catalog-Source")).toBe("r2");
      expect(await chunk.text()).toContain(
        "<loc>https://precioreal.mx/cyberpuerta/KPM-610B</loc>",
      );
      // Una sola lectura para los dos endpoints: el caché es del isolate.
      expect(bucket.get).toHaveBeenCalledTimes(1);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("con el binding fallando los sitemaps responden 503, con la vía en la cabecera", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const bucket = { get: vi.fn().mockRejectedValue(new Error("caído")) };

      const { index, chunk } = await pedirSitemaps({
        runtime: conBinding(bucket),
      });

      for (const res of [index, chunk]) {
        expect(res.status).toBe(503);
        expect(res.headers.get("Retry-After")).toBe("300");
        expect(res.headers.get("X-Catalog-Source")).toBe("r2");
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("sin binding los sitemaps leen por HTTP y la cabecera dice http", async () => {
      fetchMock.mockImplementation(
        async () => new Response(JSON.stringify(indice), { status: 200 }),
      );

      const { index, chunk } = await pedirSitemaps(undefined);

      expect(index.status).toBe(200);
      expect(index.headers.get("X-Catalog-Source")).toBe("http");
      expect(chunk.status).toBe(200);
      expect(chunk.headers.get("X-Catalog-Source")).toBe("http");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://feed.precioreal.mx/cyberpuerta/products/index.json",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it("/ir/ lee la ficha por el binding en GET y en HEAD", async () => {
      const bucket = bucketFalso({ [CLAVE_FICHA]: JSON.stringify(ficha) });
      const { GET, HEAD } = await import("../src/pages/ir/[tienda]/[slug]");
      const url = new URL("https://precioreal.mx/ir/cyberpuerta/KPM-610B");
      const contexto = {
        params: { tienda: "cyberpuerta", slug: "KPM-610B" },
        url,
        // User agent de vista previa: se redirige sin contar el clic.
        request: new Request(url, { headers: { "user-agent": "TelegramBot" } }),
        locals: { runtime: conBinding(bucket) },
      } as never;

      const get = await GET(contexto);
      const head = await HEAD(contexto);

      expect(get.status).toBe(302);
      expect(get.headers.get("Location")).toBe(ficha.url);
      expect(head.headers.get("Location")).toBe(ficha.url);
      expect(bucket.get).toHaveBeenCalledTimes(2);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});

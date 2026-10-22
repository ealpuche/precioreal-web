import { describe, it, expect, vi, afterEach } from "vitest";
import ficha from "./fixtures/kpm-610b.json";
// Vite importa el texto con ?raw; evita depender de los tipos de Node en astro check.
import robots from "../public/robots.txt?raw";
import { GET, HEAD } from "../src/pages/ir/[tienda]/[slug]";
import { POST } from "../src/pages/api/event";

// web#60: los enlaces de las ofertas (Telegram y deals.json) pasan por precioreal.mx,
// se cuentan en D1 con su origen y redirigen a la tienda. Hoy no sabemos qué ofertas
// generan clics: la columna `origen` existe y siempre va en null.

function mockDb() {
  const calls: unknown[][] = [];
  return {
    calls,
    prepare() {
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              calls.push(args);
              return { success: true };
            },
          };
        },
      };
    },
  };
}

function llamar(path: string, db = mockDb(), ua = "Mozilla/5.0 (iPhone)") {
  const url = new URL(`https://precioreal.mx${path}`);
  const [, , tienda, slug] = url.pathname.split("/");
  return {
    db,
    res: GET({
      params: { tienda, slug: decodeURIComponent(slug) },
      url,
      request: new Request(url, { headers: { "user-agent": ua } }),
      locals: { runtime: { env: { EVENTS_DB: db } } },
      redirect: (to: string, status: number) =>
        new Response(null, { status, headers: { Location: to } }),
    } as never),
  };
}

function feedResponde(body: unknown, status = 200) {
  globalThis.fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(body), { status })) as never;
}

describe("/ir/{tienda}/{slug} (web#60)", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("cuenta el clic con su origen y redirige a la tienda", async () => {
    feedResponde(ficha);
    const { res, db } = llamar("/ir/cyberpuerta/KPM-610B?de=telegram");
    const r = await res;
    expect(r.status).toBe(302);
    expect(r.headers.get("Location")).toBe(ficha.url);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(db.calls).toHaveLength(1);
    // (ts, evento, tienda, slug, origen, props)
    expect(db.calls[0].slice(1, 5)).toEqual([
      "salida_tienda",
      "cyberpuerta",
      "KPM-610B",
      "telegram",
    ]);
  });

  it.each([
    ["?de=feed", "feed"],
    ["", "otro"],
    ["?de=<script>", "otro"],
  ])("origen %s se registra como %s", async (qs, origen) => {
    feedResponde(ficha);
    const { res, db } = llamar(`/ir/cyberpuerta/KPM-610B${qs}`);
    await res;
    expect(db.calls[0][4]).toBe(origen);
  });

  it("si la ficha no existe, manda a la ficha propia (404) sin contar", async () => {
    feedResponde({}, 404);
    const { res, db } = llamar("/ir/cyberpuerta/NO-EXISTE?de=telegram");
    const r = await res;
    expect(r.status).toBe(302);
    expect(r.headers.get("Location")).toBe("/cyberpuerta/NO-EXISTE");
    expect(db.calls).toHaveLength(0);
  });

  it("una tienda o slug imposibles van a la portada sin pedir nada a R2", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as never;
    for (const path of ["/ir/wp-admin/x", "/ir/cyberpuerta/a%20b"]) {
      const { res, db } = llamar(path);
      const r = await res;
      expect(r.headers.get("Location")).toBe("/");
      expect(db.calls).toHaveLength(0);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no redirige fuera del dominio de la tienda aunque la ficha lo diga", async () => {
    feedResponde({ ...ficha, url: "https://evil.example/phish" });
    const { res, db } = llamar("/ir/cyberpuerta/KPM-610B?de=telegram");
    const r = await res;
    expect(r.headers.get("Location")).toBe("/cyberpuerta/KPM-610B");
    expect(db.calls).toHaveLength(0);
  });

  it("una URL sin esquema en la ficha no se usa como destino (CR PR #63, H1)", async () => {
    feedResponde({ ...ficha, url: "www.cyberpuerta.mx/x.html" });
    const { res, db } = llamar("/ir/cyberpuerta/KPM-610B?de=telegram");
    const r = await res;
    expect(r.headers.get("Location")).toBe("/cyberpuerta/KPM-610B");
    expect(db.calls).toHaveLength(0);
  });

  it.each([
    "TelegramBot (like TwitterBot)",
    "WhatsApp/2.23.20.0",
    "Mozilla/5.0 (compatible; Googlebot/2.1)",
  ])("la vista previa de %s redirige pero no cuenta", async (ua) => {
    feedResponde(ficha);
    const { res, db } = llamar(
      "/ir/cyberpuerta/KPM-610B?de=telegram",
      mockDb(),
      ua,
    );
    const r = await res;
    expect(r.headers.get("Location")).toBe(ficha.url);
    expect(db.calls).toHaveLength(0);
  });

  it("HEAD redirige igual y no cuenta", async () => {
    feedResponde(ficha);
    const r = await HEAD({
      params: { tienda: "cyberpuerta", slug: "KPM-610B" },
    } as never);
    expect(r.status).toBe(302);
    expect(r.headers.get("Location")).toBe(ficha.url);
  });

  it("el navegador no puede inventar un origen en /api/event", async () => {
    const res = await POST({
      request: new Request("https://precioreal.mx/api/event", {
        method: "POST",
        body: JSON.stringify({
          evento: "salida_tienda",
          props: {
            tienda: "cyberpuerta",
            slug: "KPM-610B",
            origen: "telegram",
          },
        }),
      }),
    } as never);
    expect(res.status).toBe(400);
  });

  it("robots.txt aparta /ir/ de los rastreadores", () => {
    expect(robots).toMatch(/^Disallow: \/ir\/$/m);
  });
});

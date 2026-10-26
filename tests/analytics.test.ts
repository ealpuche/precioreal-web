import { describe, it, expect, vi, afterEach } from "vitest";
import {
  GA_CONFIG,
  enviarAGa,
  gaInitScript,
  gaMeasurementId,
} from "../src/lib/analytics";

describe("src/lib/analytics.ts (#64)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("acepta un ID de medición GA4 y lo recorta", () => {
    expect(gaMeasurementId("G-ABC123XYZ9")).toBe("G-ABC123XYZ9");
    expect(gaMeasurementId("  G-ABC123XYZ9 \n")).toBe("G-ABC123XYZ9");
  });

  it("rechaza lo que no es un ID GA4: no se inyecta gtag", () => {
    for (const raw of [
      undefined,
      null,
      "",
      "   ",
      "UA-12345-1",
      "G-",
      "g-abc123",
      'G-ABC"><script>alert(1)</script>',
      "G-ABC123 G-DEF456",
      42,
    ]) {
      expect(gaMeasurementId(raw), String(raw)).toBeNull();
    }
  });

  it("la configuración apaga Google Signals y la personalización de anuncios", () => {
    expect(GA_CONFIG).toEqual({
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
  });

  it("enviarAGa manda el evento a gtag si existe", () => {
    const gtag = vi.fn();
    vi.stubGlobal("gtag", gtag);
    enviarAGa("salida_tienda", { tienda: "cyberpuerta", slug: "KPM-610B" });
    expect(gtag).toHaveBeenCalledWith("event", "salida_tienda", {
      tienda: "cyberpuerta",
      slug: "KPM-610B",
    });
  });

  it("enviarAGa sin gtag o con gtag que lanza no lanza", () => {
    expect(() => enviarAGa("salida_tienda", { tienda: "x" })).not.toThrow();
    vi.stubGlobal(
      "gtag",
      vi.fn(() => {
        throw new Error("bloqueado");
      }),
    );
    expect(() => enviarAGa("salida_tienda", { tienda: "x" })).not.toThrow();
  });
});

describe("gaInitScript (#64)", () => {
  it("arranca gtag con el ID y la configuración sin señales", () => {
    const script = gaInitScript("G-ABC123XYZ9");
    expect(script).toContain('window.gtag("config","G-ABC123XYZ9",');
    expect(script).toContain('"allow_google_signals":false');
    expect(script).toContain('"allow_ad_personalization_signals":false');
  });

  it("el script define gtag y encola en dataLayer", () => {
    const ventana: Record<string, unknown> = {};
    new Function("window", gaInitScript("G-ABC123XYZ9"))(ventana);
    const capa = ventana.dataLayer as unknown[][];
    expect(typeof ventana.gtag).toBe("function");
    expect(capa).toHaveLength(2);
    expect(Array.from(capa[1] as ArrayLike<unknown>)).toEqual([
      "config",
      "G-ABC123XYZ9",
      { allow_google_signals: false, allow_ad_personalization_signals: false },
    ]);
  });
});

import { describe, it, expect, vi } from "vitest";
import { decidirBusqueda, type Resolver } from "../src/lib/buscar";
import {
  MODOS_BUSCAR,
  RESULTADOS_BUSCAR,
  validateEvent,
} from "../src/lib/event";

const KPM =
  "https://www.cyberpuerta.mx/Audio-y-Video/Proyeccion/Soportes-de-Proyectores/Klip-Xtreme-Soporte-KPM-610B.html";
const KPM_NORMALIZADA =
  "cyberpuerta.mx/Audio-y-Video/Proyeccion/Soportes-de-Proyectores/Klip-Xtreme-Soporte-KPM-610B.html";

const resuelveKpm: Resolver = async (_tienda, normalizedUrl) =>
  normalizedUrl === KPM_NORMALIZADA
    ? { ok: true, sku: "KPM-610B" }
    : { ok: false, reason: "not_found" };

describe("decidirBusqueda", () => {
  it("un código redirige sin consultar el catálogo", async () => {
    const resolver = vi.fn<Resolver>();
    const d = await decidirBusqueda("KPM-610B", resolver);
    expect(d).toEqual({
      modo: "sku",
      resultado: "redirigido",
      destino: "/cyberpuerta/KPM-610B",
    });
    expect(resolver).not.toHaveBeenCalled();
  });

  it("un enlace de producto redirige a la clave que devuelve el catálogo", async () => {
    const d = await decidirBusqueda(KPM + "?utm_source=share", resuelveKpm);
    expect(d).toEqual({
      modo: "url",
      resultado: "redirigido",
      destino: "/cyberpuerta/KPM-610B",
    });
  });

  it("el texto de una hoja de compartir (nombre + enlace) redirige (#42)", async () => {
    const d = await decidirBusqueda(
      `Klip Xtreme Soporte de Techo para Proyector KPM-610B ${KPM}`,
      resuelveKpm,
    );
    expect(d).toMatchObject({ modo: "url", resultado: "redirigido" });
  });

  it("un nombre tecleado es modo texto, no un enlace ilegible (#42)", async () => {
    const resolver = vi.fn<Resolver>();
    // "monitor" (una palabra) no está aquí: cumple SKU_RE y sigue el camino de código, que
    // redirige sin comprobar que la ficha exista (cuenta propuestas, no aciertos).
    for (const q of ["Monitor LG 27 pulg. curvo", "iphone 15 pro max"]) {
      const d = await decidirBusqueda(q, resolver);
      expect(d).toMatchObject({ modo: "texto", resultado: "ilegible" });
      if (d.resultado !== "redirigido") {
        expect(d.error).toContain("Todavía no buscamos por nombre");
      }
    }
    expect(resolver).not.toHaveBeenCalled();
  });

  it("un enlace que no se puede leer es modo url con su propio mensaje (#42)", async () => {
    const d = await decidirBusqueda(
      "https://[cyberpuerta.mx/Laptops/x.html",
      vi.fn<Resolver>(),
    );
    expect(d).toMatchObject({ modo: "url", resultado: "ilegible" });
    if (d.resultado !== "redirigido") {
      expect(d.error).toContain("No pudimos leer ese enlace");
    }
  });

  it("clasifica tienda no publicada, desconocida y portada sin ruta", async () => {
    const resolver = vi.fn<Resolver>();
    expect(
      await decidirBusqueda(
        "https://www.liverpool.com.mx/tienda/pdp/x",
        resolver,
      ),
    ).toMatchObject({ modo: "url", resultado: "tienda_no_publicada" });
    expect(
      await decidirBusqueda("https://www.amazon.com.mx/dp/B0X", resolver),
    ).toMatchObject({ modo: "url", resultado: "tienda_desconocida" });
    expect(
      await decidirBusqueda("https://www.cyberpuerta.mx/", resolver),
    ).toMatchObject({ modo: "url", resultado: "sin_ruta" });
    expect(resolver).not.toHaveBeenCalled();
  });

  it("distingue no encontrado de error del catálogo", async () => {
    expect(
      await decidirBusqueda(
        "https://www.cyberpuerta.mx/No/Existe.html",
        resuelveKpm,
      ),
    ).toMatchObject({ modo: "url", resultado: "no_encontrado" });
    expect(
      await decidirBusqueda(KPM, async () => ({
        ok: false,
        reason: "upstream_error",
      })),
    ).toMatchObject({ modo: "url", resultado: "error_upstream" });
  });

  it("todo modo y resultado que emite pasa el esquema del evento buscar", async () => {
    // Si un literal de buscar.ts se desincroniza de event.ts, la fila de D1 se pierde con un
    // `evt_invalid` en el log (CR PR #31, H5). Aquí se comprueba antes de desplegar.
    const consultas = [
      "KPM-610B",
      KPM,
      "nombre tecleado",
      "https://[cyberpuerta.mx/x.html",
      "https://www.liverpool.com.mx/x",
      "https://www.amazon.com.mx/x",
      "https://www.cyberpuerta.mx",
      "https://www.cyberpuerta.mx/No/Existe.html",
    ];
    for (const q of consultas) {
      const d = await decidirBusqueda(q, resuelveKpm);
      expect(MODOS_BUSCAR).toContain(d.modo);
      expect(RESULTADOS_BUSCAR).toContain(d.resultado);
      expect(
        validateEvent({
          evento: "buscar",
          props: {
            modo: d.modo,
            resultados: d.resultado === "redirigido" ? 1 : 0,
            resultado: d.resultado,
            ms: 1,
          },
        }),
      ).not.toBeNull();
    }
  });
});

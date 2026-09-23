import { describe, it, expect, vi, afterEach } from "vitest";
import {
  validateEvent,
  logEvent,
  handleEvent,
  type EventPayload,
} from "../src/lib/event";

describe("src/lib/event.ts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validateEvent", () => {
    it("passes for valid events of all three types", () => {
      const e1 = validateEvent({
        evento: "buscar",
        props: {
          modo: "sku",
          resultados: 1,
          resultado: "redirigido",
          ms: 15,
        },
      });
      expect(e1).toEqual({
        evento: "buscar",
        props: {
          modo: "sku",
          resultados: 1,
          resultado: "redirigido",
          ms: 15,
        },
      });

      const e2 = validateEvent({
        evento: "salida_tienda",
        props: {
          tienda: "cyberpuerta",
          slug: "100-100001488BOX",
        },
      });
      expect(e2).toEqual({
        evento: "salida_tienda",
        props: {
          tienda: "cyberpuerta",
          slug: "100-100001488BOX",
        },
      });

      const e3 = validateEvent({
        evento: "alerta_alta",
        props: {
          tienda: "cyberpuerta",
        },
      });
      expect(e3).toEqual({
        evento: "alerta_alta",
        props: {
          tienda: "cyberpuerta",
        },
      });
    });

    it("rechaza nombres heredados del prototipo", () => {
      for (const evento of [
        "constructor",
        "toString",
        "__proto__",
        "hasOwnProperty",
      ]) {
        expect(validateEvent({ evento, props: {} })).toBeNull();
      }
    });

    it("returns null for invalid inputs", () => {
      // Clave extra
      expect(
        validateEvent({
          evento: "salida_tienda",
          props: {
            tienda: "cyberpuerta",
            slug: "100-100001488BOX",
            extra: "no",
          },
        }),
      ).toBeNull();

      // buscar con q: "rtx 4070" (el texto tecleado)
      expect(
        validateEvent({
          evento: "buscar",
          props: {
            modo: "sku",
            resultados: 1,
            resultado: "redirigido",
            ms: 15,
            q: "rtx 4070",
          },
        }),
      ).toBeNull();

      // Clave faltante
      expect(
        validateEvent({
          evento: "buscar",
          props: {
            modo: "sku",
            resultados: 1,
            resultado: "redirigido",
          },
        }),
      ).toBeNull();

      // String de 65 caracteres
      expect(
        validateEvent({
          evento: "salida_tienda",
          props: {
            tienda: "cyberpuerta",
            slug: "a".repeat(65),
          },
        }),
      ).toBeNull();

      // Evento desconocido
      expect(
        validateEvent({
          evento: "desconocido",
          props: {},
        }),
      ).toBeNull();

      // Input null, array o string
      expect(validateEvent(null)).toBeNull();
      expect(validateEvent(["buscar"])).toBeNull();
      expect(validateEvent("string")).toBeNull();

      // Props array o primitivo
      expect(
        validateEvent({
          evento: "alerta_alta",
          props: ["cyberpuerta"],
        }),
      ).toBeNull();
      expect(
        validateEvent({
          evento: "alerta_alta",
          props: "cyberpuerta",
        }),
      ).toBeNull();

      // modo fuera de la lista
      expect(
        validateEvent({
          evento: "buscar",
          props: {
            modo: "invalido",
            resultados: 1,
            resultado: "redirigido",
            ms: 15,
          },
        }),
      ).toBeNull();

      // resultado fuera de la lista
      expect(
        validateEvent({
          evento: "buscar",
          props: {
            modo: "sku",
            resultados: 1,
            resultado: "invalido",
            ms: 15,
          },
        }),
      ).toBeNull();

      // ms negativo, NaN, Infinity y 300001
      expect(
        validateEvent({
          evento: "buscar",
          props: {
            modo: "sku",
            resultados: 1,
            resultado: "redirigido",
            ms: -1,
          },
        }),
      ).toBeNull();
      expect(
        validateEvent({
          evento: "buscar",
          props: {
            modo: "sku",
            resultados: 1,
            resultado: "redirigido",
            ms: Number.NaN,
          },
        }),
      ).toBeNull();
      expect(
        validateEvent({
          evento: "buscar",
          props: {
            modo: "sku",
            resultados: 1,
            resultado: "redirigido",
            ms: Number.POSITIVE_INFINITY,
          },
        }),
      ).toBeNull();
      expect(
        validateEvent({
          evento: "buscar",
          props: {
            modo: "sku",
            resultados: 1,
            resultado: "redirigido",
            ms: 300001,
          },
        }),
      ).toBeNull();

      // resultados 1.5
      expect(
        validateEvent({
          evento: "buscar",
          props: {
            modo: "sku",
            resultados: 1.5,
            resultado: "redirigido",
            ms: 15,
          },
        }),
      ).toBeNull();

      // slug que no cumple SKU_RE
      expect(
        validateEvent({
          evento: "salida_tienda",
          props: {
            tienda: "cyberpuerta",
            slug: "sku/con/slash",
          },
        }),
      ).toBeNull();

      // tienda con mayúsculas
      expect(
        validateEvent({
          evento: "salida_tienda",
          props: {
            tienda: "Cyberpuerta",
            slug: "100-100001488BOX",
          },
        }),
      ).toBeNull();
    });
  });

  describe("logEvent", () => {
    it("logs single line with { t: 'evt', evento, props, ts } and ISO date", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const now = 1716380000000;
      const payload: EventPayload = {
        evento: "salida_tienda",
        props: {
          tienda: "cyberpuerta",
          slug: "100-100001488BOX",
        },
      };

      logEvent(payload, now);

      expect(spy).toHaveBeenCalledTimes(1);
      const logged = JSON.parse(spy.mock.calls[0][0]);
      expect(logged).toEqual({
        t: "evt",
        evento: "salida_tienda",
        props: {
          tienda: "cyberpuerta",
          slug: "100-100001488BOX",
        },
        ts: new Date(now).toISOString(),
      });
    });
  });

  describe("handleEvent", () => {
    it("returns 204 and logs event once on valid request", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const now = 1716380000000;
      const body = JSON.stringify({
        evento: "salida_tienda",
        props: {
          tienda: "cyberpuerta",
          slug: "100-100001488BOX",
        },
      });
      const req = new Request("https://precioreal.mx/api/event", {
        method: "POST",
        body,
        headers: { "content-length": String(body.length) },
      });

      const res = await handleEvent(req, now);
      expect(res.status).toBe(204);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("returns 400 and zero calls on invalid JSON", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const req = new Request("https://precioreal.mx/api/event", {
        method: "POST",
        body: "{not-json",
      });

      const res = await handleEvent(req);
      expect(res.status).toBe(400);
      expect(spy).not.toHaveBeenCalled();
    });

    it("returns 400 and zero calls on invalid payload format", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const req = new Request("https://precioreal.mx/api/event", {
        method: "POST",
        body: JSON.stringify({ evento: "buscar", props: { modo: "invalid" } }),
      });

      const res = await handleEvent(req);
      expect(res.status).toBe(400);
      expect(spy).not.toHaveBeenCalled();
    });

    it("returns 400 on body of 1025 bytes without content-length header", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const validPayload = JSON.stringify({
        evento: "salida_tienda",
        props: {
          tienda: "cyberpuerta",
          slug: "100-100001488BOX",
        },
      });
      // Exact 1025 bytes of valid JSON (padded with spaces)
      const largeStr = validPayload + " ".repeat(1025 - validPayload.length);
      const req = new Request("https://precioreal.mx/api/event", {
        method: "POST",
        body: largeStr,
      });
      // Ensure content-length is not set on Request headers
      req.headers.delete("content-length");

      const res = await handleEvent(req);
      expect(res.status).toBe(400);
      expect(spy).not.toHaveBeenCalled();
    });

    it("returns 400 when content-length header is 5000", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const req = new Request("https://precioreal.mx/api/event", {
        method: "POST",
        body: "{}",
        headers: { "content-length": "5000" },
      });

      const res = await handleEvent(req);
      expect(res.status).toBe(400);
      expect(spy).not.toHaveBeenCalled();
    });

    it("does not log IP or user-agent headers from request", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const body = JSON.stringify({
        evento: "salida_tienda",
        props: {
          tienda: "cyberpuerta",
          slug: "100-100001488BOX",
        },
      });
      const req = new Request("https://precioreal.mx/api/event", {
        method: "POST",
        body,
        headers: {
          "cf-connecting-ip": "203.0.113.9",
          "user-agent": "Probe/1.0",
        },
      });

      const res = await handleEvent(req);
      expect(res.status).toBe(204);
      expect(spy).toHaveBeenCalledTimes(1);

      const loggedLine = spy.mock.calls[0][0];
      expect(loggedLine).not.toContain("203.0.113.9");
      expect(loggedLine).not.toContain("Probe");
    });

    it("acepta un cuerpo válido partido en tres trozos", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const validPayload = JSON.stringify({
        evento: "salida_tienda",
        props: {
          tienda: "cyberpuerta",
          slug: "100-100001488BOX",
        },
      });
      const encoded = new TextEncoder().encode(validPayload);
      const p1 = Math.floor(encoded.length / 4);
      const p2 = Math.floor(encoded.length / 2);
      const chunk1 = encoded.slice(0, p1);
      const chunk2 = encoded.slice(p1, p2);
      const chunk3 = encoded.slice(p2);

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(chunk1);
          controller.enqueue(chunk2);
          controller.enqueue(chunk3);
          controller.close();
        },
      });

      const req = new Request("https://precioreal.mx/api/event", {
        method: "POST",
        body: stream,
        duplex: "half",
      } as RequestInit);

      const res = await handleEvent(req);
      expect(res.status).toBe(204);
      expect(spy).toHaveBeenCalledTimes(1);

      const logged = JSON.parse(spy.mock.calls[0][0]);
      expect(logged.props.slug).toBe("100-100001488BOX");
    });

    it("corta un cuerpo en stream que pasa de 1 KB sin leerlo entero", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const validObj = {
        evento: "salida_tienda",
        props: {
          tienda: "cyberpuerta",
          slug: "100-100001488BOX",
        },
      };
      const validJson = JSON.stringify(validObj);
      const largeStr = validJson + " ".repeat(3000 - validJson.length);
      const encoded = new TextEncoder().encode(largeStr);

      let offset = 0;
      let cancelCalled = false;
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (offset >= encoded.length) {
            controller.close();
            return;
          }
          const nextOffset = Math.min(offset + 400, encoded.length);
          controller.enqueue(encoded.slice(offset, nextOffset));
          offset = nextOffset;
        },
        cancel() {
          cancelCalled = true;
        },
      });

      const req = new Request("https://precioreal.mx/api/event", {
        method: "POST",
        body: stream,
        duplex: "half",
      } as RequestInit);

      const res = await handleEvent(req);
      expect(res.status).toBe(400);
      expect(spy).not.toHaveBeenCalled();
      expect(cancelCalled).toBe(true);
    });

    it("POST sin cuerpo -> 400 sin registrar", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const req = new Request("https://precioreal.mx/api/event", {
        method: "POST",
      });

      const res = await handleEvent(req);
      expect(res.status).toBe(400);
      expect(spy).not.toHaveBeenCalled();
    });

    it("un stream que falla al leer -> 400 sin lanzar", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.error(new Error("red cortada"));
        },
      });

      const req = new Request("https://precioreal.mx/api/event", {
        method: "POST",
        body: stream,
        duplex: "half",
      } as RequestInit);

      await expect(handleEvent(req)).resolves.toHaveProperty("status", 400);
      expect(spy).not.toHaveBeenCalled();
    });
  });
});

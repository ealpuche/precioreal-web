import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { track } from "../src/lib/track";

describe("src/lib/track.ts", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("inválido -> false y sendBeacon no se llama", () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", { sendBeacon });

    const result = track("salida_tienda", {
      tienda: "cyberpuerta",
      // falta slug
    });

    expect(result).toBe(false);
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it("válido -> sendBeacon llamado con /api/event y un string que parsea al payload", () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", { sendBeacon });

    const result = track("salida_tienda", {
      tienda: "cyberpuerta",
      slug: "100-100001488BOX",
    });

    expect(result).toBe(true);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon).toHaveBeenCalledWith("/api/event", expect.any(String));

    const payloadSent = JSON.parse(sendBeacon.mock.calls[0][1]);
    expect(payloadSent).toEqual({
      evento: "salida_tienda",
      props: {
        tienda: "cyberpuerta",
        slug: "100-100001488BOX",
      },
    });
  });

  it("sendBeacon devuelve false -> se llama fetch con keepalive: true", () => {
    const sendBeacon = vi.fn().mockReturnValue(false);
    vi.stubGlobal("navigator", { sendBeacon });

    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    globalThis.fetch = mockFetch;

    const result = track("salida_tienda", {
      tienda: "cyberpuerta",
      slug: "100-100001488BOX",
    });

    expect(result).toBe(true);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/event",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
        headers: {
          "Content-Type": "text/plain;charset=UTF-8",
        },
      }),
    );
  });

  it("sin sendBeacon -> se llama fetch", () => {
    vi.stubGlobal("navigator", {});

    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    globalThis.fetch = mockFetch;

    const result = track("salida_tienda", {
      tienda: "cyberpuerta",
      slug: "100-100001488BOX",
    });

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/event",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
        headers: {
          "Content-Type": "text/plain;charset=UTF-8",
        },
      }),
    );
  });

  it("válido y con gtag -> el mismo evento va a D1 y a GA4 (#64)", () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    const gtag = vi.fn();
    vi.stubGlobal("navigator", { sendBeacon });
    vi.stubGlobal("gtag", gtag);

    const result = track("salida_tienda", {
      tienda: "cyberpuerta",
      slug: "100-100001488BOX",
    });

    expect(result).toBe(true);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith("event", "salida_tienda", {
      tienda: "cyberpuerta",
      slug: "100-100001488BOX",
    });
  });

  it("inválido -> tampoco va a GA4 (#64)", () => {
    const gtag = vi.fn();
    vi.stubGlobal("navigator", { sendBeacon: vi.fn() });
    vi.stubGlobal("gtag", gtag);

    expect(track("salida_tienda", { tienda: "cyberpuerta" })).toBe(false);
    expect(gtag).not.toHaveBeenCalled();
  });

  it("gtag que lanza no impide el envío a D1 (#64)", () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", { sendBeacon });
    vi.stubGlobal(
      "gtag",
      vi.fn(() => {
        throw new Error("bloqueado por el navegador");
      }),
    );

    const result = track("salida_tienda", {
      tienda: "cyberpuerta",
      slug: "100-100001488BOX",
    });

    expect(result).toBe(true);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });

  it("sendBeacon que lanza -> track no lanza", () => {
    const sendBeacon = vi.fn().mockImplementation(() => {
      throw new Error("sendBeacon error");
    });
    vi.stubGlobal("navigator", { sendBeacon });

    expect(() => {
      const res = track("salida_tienda", {
        tienda: "cyberpuerta",
        slug: "100-100001488BOX",
      });
      expect(res).toBe(false);
    }).not.toThrow();
  });
});

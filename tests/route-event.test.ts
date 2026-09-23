import { describe, it, expect, vi, afterEach } from "vitest";
import { POST, ALL } from "../src/pages/api/event";

describe("src/pages/api/event.ts (ruta)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POST válido -> 204", async () => {
    const request = new Request("https://precioreal.mx/api/event", {
      method: "POST",
      body: JSON.stringify({
        evento: "salida_tienda",
        props: {
          tienda: "cyberpuerta",
          slug: "100-100001488BOX",
        },
      }),
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
    });

    const res = await POST({ request } as never);
    expect(res.status).toBe(204);
  });

  it("POST inválido -> 400", async () => {
    const request = new Request("https://precioreal.mx/api/event", {
      method: "POST",
      body: "{invalid-json",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
    });

    const res = await POST({ request } as never);
    expect(res.status).toBe(400);
  });

  it("POST > 1 KB -> 400", async () => {
    const validPayload = JSON.stringify({
      evento: "salida_tienda",
      props: {
        tienda: "cyberpuerta",
        slug: "100-100001488BOX",
      },
    });
    const request = new Request("https://precioreal.mx/api/event", {
      method: "POST",
      body: validPayload + " ".repeat(1025 - validPayload.length),
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
    });

    const res = await POST({ request } as never);
    expect(res.status).toBe(400);
  });

  it("ALL -> 405 con Allow: POST", async () => {
    const res = await ALL({} as never);
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST");
  });
});

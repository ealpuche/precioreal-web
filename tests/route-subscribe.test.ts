import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "../src/pages/api/subscribe";

describe("src/pages/api/subscribe.ts (ruta)", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    // Sin esto, el fetch mockeado sobrevive al archivo y vuelve flaky a los demás tests que
    // corran en el mismo worker de vitest (CR #4 ronda 2, Copilot).
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("passes locals.runtime.env through to the handler", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ success: true }),
    } as unknown as Response);
    const put = vi.fn().mockResolvedValue(undefined);
    const request = {
      json: async () => ({ email: "a@b.com", turnstileToken: "t" }),
    } as unknown as Request;
    const locals = {
      runtime: { env: { TURNSTILE_SECRET: "s", SUBSCRIBERS: { put } } },
    };

    const res = await POST({ request, locals } as never);

    expect(res.status).toBe(200);
    expect(put).toHaveBeenCalledWith("a@b.com", expect.any(String));
  });

  it("returns 500 instead of throwing when the runtime is missing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const request = {
      json: async () => ({ email: "a@b.com", turnstileToken: "t" }),
    } as unknown as Request;

    const res = await POST({ request, locals: {} } as never);

    expect(res.status).toBe(500);
  });
});

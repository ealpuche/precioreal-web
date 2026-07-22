import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { onRequestPost } from "../functions/api/subscribe.js";

describe("functions/api/subscribe.js", () => {
  let originalFetch;
  let mockEnv;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockEnv = {
      TURNSTILE_SECRET: "test-secret",
      SUBSCRIBERS: {
        put: vi.fn().mockResolvedValue(undefined),
      },
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function createRequest(body, isJson = true) {
    return {
      json: isJson
        ? async () => (typeof body === "string" ? JSON.parse(body) : body)
        : async () => {
            throw new SyntaxError("Unexpected token");
          },
    };
  }

  it("returns 400 when body is not valid JSON", async () => {
    const request = createRequest("{bad-json", false);
    const res = await onRequestPost({ request, env: mockEnv });
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe("invalid_json");
    expect(mockEnv.SUBSCRIBERS.put).not.toHaveBeenCalled();
  });

  it("returns 400 and does not call put when email is invalid", async () => {
    const request = createRequest({
      email: "not-an-email",
      turnstileToken: "valid-token",
    });
    const res = await onRequestPost({ request, env: mockEnv });
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe("invalid_email");
    expect(mockEnv.SUBSCRIBERS.put).not.toHaveBeenCalled();
  });

  it("returns 400 when turnstileToken is empty or missing", async () => {
    const request = createRequest({
      email: "user@example.com",
      turnstileToken: "",
    });
    const res = await onRequestPost({ request, env: mockEnv });
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe("missing_token");
    expect(mockEnv.SUBSCRIBERS.put).not.toHaveBeenCalled();
  });

  it("returns 400 captcha_failed when siteverify returns success: false", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: async () => ({
        success: false,
        "error-codes": ["invalid-input-response"],
      }),
    });

    const request = createRequest({
      email: "user@example.com",
      turnstileToken: "bad-token",
    });
    const res = await onRequestPost({ request, env: mockEnv });
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe("captcha_failed");
    expect(mockEnv.SUBSCRIBERS.put).not.toHaveBeenCalled();
  });

  it("returns 200 and calls put with lowercased email key when siteverify succeeds", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ success: true }),
    });

    const request = createRequest({
      email: "User.Name@Example.COM",
      turnstileToken: "good-token",
    });
    const res = await onRequestPost({ request, env: mockEnv });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.ok).toBe(true);

    expect(mockEnv.SUBSCRIBERS.put).toHaveBeenCalledTimes(1);
    const [key, valueStr] = mockEnv.SUBSCRIBERS.put.mock.calls[0];
    expect(key).toBe("user.name@example.com");

    const value = JSON.parse(valueStr);
    expect(value).toHaveProperty("subscribed_at");
    expect(new Date(value.subscribed_at).getTime()).not.toBeNaN();
    expect(value.source).toBe("landing");
  });

  it("returns 500 upstream_error and does not call put when siteverify fetch rejects", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network down"));

    const request = createRequest({
      email: "user@example.com",
      turnstileToken: "good-token",
    });
    const res = await onRequestPost({ request, env: mockEnv });
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe("upstream_error");
    expect(mockEnv.SUBSCRIBERS.put).not.toHaveBeenCalled();
  });

  it("returns 400 missing_token when token is whitespace-only", async () => {
    globalThis.fetch = vi.fn();
    const request = createRequest({
      email: "user@example.com",
      turnstileToken: "   ",
    });
    const res = await onRequestPost({ request, env: mockEnv });
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe("missing_token");
    expect(mockEnv.SUBSCRIBERS.put).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("returns 500 server_misconfigured when TURNSTILE_SECRET is missing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.fetch = vi.fn();
    const envNoSecret = {
      SUBSCRIBERS: {
        put: vi.fn().mockResolvedValue(undefined),
      },
    };
    const request = createRequest({
      email: "user@example.com",
      turnstileToken: "valid-token",
    });
    const res = await onRequestPost({ request, env: envNoSecret });
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe("server_misconfigured");
    expect(envNoSecret.SUBSCRIBERS.put).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

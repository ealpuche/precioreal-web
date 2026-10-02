import { describe, it, expect, vi, afterEach } from "vitest";
import { handleEvent } from "../src/lib/event";
import { POST } from "../src/pages/api/event";
import type { EventStoreRuntime } from "../src/lib/event-store";

function createMockDb() {
  const calls: { sql: string; args: unknown[] }[] = [];
  let runHandler: () => Promise<unknown> = async () => ({ success: true });

  const db = {
    calls,
    setRunHandler(fn: () => Promise<unknown>) {
      runHandler = fn;
    },
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              calls.push({ sql, args });
              return await runHandler();
            },
          };
        },
      };
    },
  };
  return db;
}

function makeValidRequest() {
  return new Request("https://precioreal.mx/api/event", {
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
}

function makeInvalidRequest() {
  return new Request("https://precioreal.mx/api/event", {
    method: "POST",
    body: "{invalid-json",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
  });
}

describe("event-store-route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("8. handleEvent(request, now, runtime) con payload válido -> 204 y un run()", async () => {
    const db = createMockDb();
    const runtime: EventStoreRuntime = {
      env: { EVENTS_DB: db as unknown as D1Database },
    };
    const request = makeValidRequest();

    const res = await handleEvent(request, 1700000000000, runtime);
    expect(res.status).toBe(204);
    expect(db.calls).toHaveLength(1);
  });

  it("9. con payload inválido -> 400 y cero run()", async () => {
    const db = createMockDb();
    const runtime: EventStoreRuntime = {
      env: { EVENTS_DB: db as unknown as D1Database },
    };
    const request = makeInvalidRequest();

    const res = await handleEvent(request, 1700000000000, runtime);
    expect(res.status).toBe(400);
    expect(db.calls).toHaveLength(0);
  });

  it("10. con una base cuyo run() rechaza -> sigue respondiendo 204", async () => {
    const db = createMockDb();
    db.setRunHandler(() => Promise.reject(new Error("D1 fatal error")));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const runtime: EventStoreRuntime = {
      env: { EVENTS_DB: db as unknown as D1Database },
    };
    const request = makeValidRequest();

    const res = await handleEvent(request, 1700000000000, runtime);
    expect(res.status).toBe(204);
    expect(db.calls).toHaveLength(1);
  });

  it("11. POST({ request, locals: { runtime } }) de src/pages/api/event.ts -> 204 y un run()", async () => {
    const db = createMockDb();
    const runtime: EventStoreRuntime = {
      env: { EVENTS_DB: db as unknown as D1Database },
    };
    const request = makeValidRequest();

    const res = await POST({ request, locals: { runtime } } as never);
    expect(res.status).toBe(204);
    expect(db.calls).toHaveLength(1);
  });

  it("12. POST({ request }) sin locals -> 204 (no lanza)", async () => {
    const request = makeValidRequest();

    const res = await POST({ request } as never);
    expect(res.status).toBe(204);
  });
});

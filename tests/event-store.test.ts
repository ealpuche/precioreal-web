import { describe, it, expect, vi, afterEach } from "vitest";
import { storeEvent, type EventStoreRuntime } from "../src/lib/event-store";
import type { EventPayload } from "../src/lib/event";

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

describe("storeEvent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. runtime undefined -> no lanza y no llama a nada", async () => {
    const payload: EventPayload = {
      evento: "salida_tienda",
      props: { tienda: "cyberpuerta", slug: "cpu-1" },
    };
    await expect(storeEvent(undefined, payload)).resolves.toBeUndefined();
  });

  it("2. runtime sin EVENTS_DB -> no llama a nada", async () => {
    const payload: EventPayload = {
      evento: "salida_tienda",
      props: { tienda: "cyberpuerta", slug: "cpu-1" },
    };
    const runtime: EventStoreRuntime = { env: {} };
    await expect(storeEvent(runtime, payload)).resolves.toBeUndefined();
  });

  it("3. salida_tienda con base y sin ctx -> exactamente un run(); los argumentos de bind son, en orden: el ISO de un now inyectado, 'salida_tienda', la tienda, el slug, null y el JSON de las props", async () => {
    const db = createMockDb();
    const runtime: EventStoreRuntime = {
      env: { EVENTS_DB: db },
    };
    const payload: EventPayload = {
      evento: "salida_tienda",
      props: { tienda: "cyberpuerta", slug: "cpu-1" },
    };
    const fixedNow = 1700000000000;
    const expectedIso = new Date(fixedNow).toISOString();

    await storeEvent(runtime, payload, fixedNow);

    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].sql).toBe(
      "INSERT INTO events (ts, evento, tienda, slug, origen, props) VALUES (?, ?, ?, ?, ?, ?)",
    );
    expect(db.calls[0].args).toEqual([
      expectedIso,
      "salida_tienda",
      "cyberpuerta",
      "cpu-1",
      null,
      JSON.stringify({ tienda: "cyberpuerta", slug: "cpu-1" }),
    ]);
  });

  it("4. buscar -> tienda y slug van como null", async () => {
    const db = createMockDb();
    const runtime: EventStoreRuntime = {
      env: { EVENTS_DB: db },
    };
    const payload: EventPayload = {
      evento: "buscar",
      props: { modo: "sku", resultados: 1, resultado: "redirigido", ms: 42 },
    };
    const fixedNow = 1700000000000;
    const expectedIso = new Date(fixedNow).toISOString();

    await storeEvent(runtime, payload, fixedNow);

    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].args).toEqual([
      expectedIso,
      "buscar",
      null,
      null,
      null,
      JSON.stringify(payload.props),
    ]);
  });

  it("5. con ctx.waitUntil -> se llama una vez con una promesa, y storeEvent resuelve ANTES de que termine run()", async () => {
    const db = createMockDb();
    let resolveRun!: () => void;
    let runFinished = false;

    db.setRunHandler(
      () =>
        new Promise<unknown>((res) => {
          resolveRun = () => {
            runFinished = true;
            res({ success: true });
          };
        }),
    );

    const waited: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: vi.fn((promise: Promise<unknown>) => {
        waited.push(promise);
      }),
    };
    const runtime: EventStoreRuntime = {
      env: { EVENTS_DB: db },
      ctx,
    };

    const payload: EventPayload = {
      evento: "salida_tienda",
      props: { tienda: "cyberpuerta", slug: "cpu-1" },
    };

    const storePromise = storeEvent(runtime, payload);
    await expect(storePromise).resolves.toBeUndefined();

    // storeEvent resolvió antes de que termine run()
    expect(runFinished).toBe(false);
    expect(ctx.waitUntil).toHaveBeenCalledTimes(1);
    expect(waited).toHaveLength(1);

    // Ahora terminamos run()
    resolveRun();
    await waited[0];
    expect(runFinished).toBe(true);
    expect(db.calls).toHaveLength(1);
  });

  it("6. run() rechaza -> storeEvent no rechaza y hay un console.error cuyo JSON tiene t: 'evt_store_error' y no contiene las props", async () => {
    const db = createMockDb();
    db.setRunHandler(() => Promise.reject(new Error("D1 write failed")));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const runtime: EventStoreRuntime = {
      env: { EVENTS_DB: db },
    };
    const payload: EventPayload = {
      evento: "salida_tienda",
      props: { tienda: "cyberpuerta", slug: "secreto-123" },
    };

    await expect(storeEvent(runtime, payload)).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledTimes(1);

    const loggedStr = consoleSpy.mock.calls[0][0];
    const loggedObj = JSON.parse(loggedStr);
    expect(loggedObj.t).toBe("evt_store_error");
    expect(loggedObj.evento).toBe("salida_tienda");
    expect(loggedObj.error).toBe("D1 write failed");
    expect(loggedStr).not.toContain("secreto-123");
    expect(loggedStr).not.toContain("props");
  });

  it("7. prepare lanza de forma síncrona -> storeEvent no lanza y registra evt_store_error", async () => {
    const db = {
      prepare() {
        throw new Error("Prepare sync failure");
      },
    };
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const runtime: EventStoreRuntime = {
      env: { EVENTS_DB: db },
    };
    const payload: EventPayload = {
      evento: "salida_tienda",
      props: { tienda: "cyberpuerta", slug: "cpu-sync" },
    };

    await expect(storeEvent(runtime, payload)).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledTimes(1);

    const loggedStr = consoleSpy.mock.calls[0][0];
    const loggedObj = JSON.parse(loggedStr);
    expect(loggedObj.t).toBe("evt_store_error");
    expect(loggedObj.evento).toBe("salida_tienda");
    expect(loggedObj.error).toBe("Prepare sync failure");
    expect(loggedStr).not.toContain("cpu-sync");
  });
});

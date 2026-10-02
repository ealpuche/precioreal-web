import type { EventPayload } from "./event";

// Forma mínima del binding de D1 que este módulo usa. El proyecto no depende de
// @cloudflare/workers-types y `D1Database` no existe como tipo global para astro check.
export type EventsDb = {
  prepare(sql: string): {
    bind(...values: unknown[]): { run(): Promise<unknown> };
  };
};

// Subconjunto estructural de `locals.runtime` (adaptador de Cloudflare). Todo es
// opcional: en tests y en un preview sin configurar el binding no existe, y la
// escritura se omite en silencio en vez de romper la respuesta (#32). En `astro dev`
// el binding sí existe (wrangler.jsonc) y apunta a una base local.
export type EventStoreRuntime =
  | {
      env?: { EVENTS_DB?: EventsDb };
      ctx?: { waitUntil(promise: Promise<unknown>): void };
    }
  | undefined;

const INSERT_SQL =
  "INSERT INTO events (ts, evento, tienda, slug, origen, props) VALUES (?, ?, ?, ?, ?, ?)";

const textOrNull = (v: unknown): string | null =>
  typeof v === "string" ? v : null;

// Solo nombre del evento y mensaje del error: nunca las props ni la petición.
function logStoreError(evento: string, err: unknown): void {
  console.error(
    JSON.stringify({
      t: "evt_store_error",
      evento,
      error: err instanceof Error ? err.message : String(err),
    }),
  );
}

/**
 * Guarda un evento ya validado como una fila en D1. Nunca lanza y nunca rechaza:
 * la medición no puede romper ni retrasar la respuesta al usuario.
 * Con `ctx.waitUntil` la escritura continúa después de responder; sin él, o si
 * `waitUntil` lanza, se espera.
 */
export async function storeEvent(
  runtime: EventStoreRuntime,
  payload: EventPayload,
  now: number = Date.now(),
): Promise<void> {
  const db = runtime?.env?.EVENTS_DB;
  if (!db) return;

  const { evento, props } = payload;
  let pending: Promise<void>;
  try {
    pending = db
      .prepare(INSERT_SQL)
      .bind(
        new Date(now).toISOString(),
        evento,
        textOrNull(props.tienda),
        textOrNull(props.slug),
        null,
        JSON.stringify(props),
      )
      .run()
      .then(() => undefined)
      .catch((err: unknown) => logStoreError(evento, err));
  } catch (err) {
    logStoreError(evento, err);
    return;
  }

  const ctx = runtime?.ctx;
  if (ctx) {
    try {
      ctx.waitUntil(pending);
      return;
    } catch (err) {
      // waitUntil lanzó: se espera la escritura en vez de perderla.
      logStoreError(evento, err);
    }
  }
  await pending;
}

import type { EventPayload } from "./event";

// Subconjunto estructural de `locals.runtime` (adaptador de Cloudflare). Todo es opcional:
// en tests, en local sin binding y en un preview sin configurar no existe, y la escritura
// se omite en silencio en vez de romper la respuesta (#32).
export type EventStoreRuntime =
  | {
      env?: { EVENTS_DB?: D1Database };
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
 * Con `ctx.waitUntil` la escritura continúa después de responder; sin él se espera.
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
    ctx.waitUntil(pending);
    return;
  }
  await pending;
}

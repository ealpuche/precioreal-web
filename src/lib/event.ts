import { SKU_RE } from "./sku";

export type Evento = "buscar" | "salida_tienda" | "alerta_alta";

export type EventPayload = {
  evento: Evento;
  props: Record<string, string | number>;
};

export const MAX_BODY_BYTES = 1024;

export const MODOS_BUSCAR = ["sku", "url", "texto"] as const;
export const RESULTADOS_BUSCAR = [
  "redirigido",
  "ilegible",
  "tienda_no_publicada",
  "tienda_desconocida",
  "sin_ruta",
  "no_encontrado",
  "error_upstream",
] as const;

type Validator = (val: unknown) => boolean;

const isPlainObject = (val: unknown): val is Record<string, unknown> =>
  typeof val === "object" && val !== null && !Array.isArray(val);

function hasExactKeys(
  props: Record<string, unknown>,
  schema: Record<string, Validator>,
): boolean {
  const propKeys = Object.keys(props);
  const schemaKeys = Object.keys(schema);
  if (propKeys.length !== schemaKeys.length) return false;
  return schemaKeys.every((key) =>
    Object.prototype.hasOwnProperty.call(props, key),
  );
}

// Cada validador es la única regla de su campo: debe comprobar el tipo y
// acotar la longitud de los strings (charset cerrado o enumeración). Un
// validador laxo como `(v) => typeof v === "string"` dejaría pasar
// cualquier cosa al log (CR PR #31, H4).
const SCHEMAS: Record<Evento, Record<string, Validator>> = {
  buscar: {
    modo: (v) =>
      typeof v === "string" && (MODOS_BUSCAR as readonly string[]).includes(v),
    resultados: (v) =>
      typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 10000,
    resultado: (v) =>
      typeof v === "string" &&
      (RESULTADOS_BUSCAR as readonly string[]).includes(v),
    ms: (v) =>
      typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 300000,
  },
  salida_tienda: {
    tienda: (v) => typeof v === "string" && /^[a-z]{1,32}$/.test(v),
    slug: (v) => typeof v === "string" && SKU_RE.test(v),
  },
  alerta_alta: {
    tienda: (v) => typeof v === "string" && /^[a-z]{1,32}$/.test(v),
  },
};

// `in` recorre el prototipo: `"constructor" in SCHEMAS` es true y
// `validateEvent` aceptaba cualquier nombre heredado de Object con
// `props: {}` (CR PR #31, H1).
const esEvento = (v: unknown): v is Evento =>
  typeof v === "string" && Object.prototype.hasOwnProperty.call(SCHEMAS, v);

export function validateEvent(input: unknown): EventPayload | null {
  if (!isPlainObject(input)) return null;

  const { evento, props } = input;
  if (!esEvento(evento)) return null;
  if (!isPlainObject(props)) return null;

  const schema = SCHEMAS[evento];
  if (!hasExactKeys(props, schema)) return null;

  for (const [key, val] of Object.entries(props)) {
    const validator = schema[key];
    if (!validator || !validator(val)) return null;
  }

  return {
    evento,
    props: props as Record<string, string | number>,
  };
}

export function logEvent(
  payload: EventPayload,
  now: number = Date.now(),
): void {
  const { evento, props } = payload;
  console.log(
    JSON.stringify({
      t: "evt",
      evento,
      props,
      ts: new Date(now).toISOString(),
    }),
  );
}

function vacio(status: number): Response {
  return new Response(null, { status });
}

// Servidor. `handleEvent` y `leerCuerpo` viven aquí mientras event.ts no
// importe nada que solo exista en servidor: `track.ts` importa este módulo y
// el tree-shaking deja esto fuera del bundle del cliente (medido en el PR #31).
// El día que se necesite un import de servidor, ambos se mudan a
// src/lib/event-route.ts para no arrastrarlo al navegador (CR PR #31, H6).
// Sin `content-length` (chunked, o cabecera omitida), `request.text()`
// cargaría el cuerpo entero antes de poder rechazarlo: aquí se corta al
// pasar el límite (CR PR #31, H2).
async function leerCuerpo(request: Request): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(bytes);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder().decode(out);
}

export async function handleEvent(
  request: Request,
  now?: number,
): Promise<Response> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const len = Number(contentLength);
    if (Number.isFinite(len) && len > MAX_BODY_BYTES) {
      return vacio(400);
    }
  }

  let text: string | null;
  try {
    text = await leerCuerpo(request);
  } catch {
    return vacio(400);
  }
  if (text === null) return vacio(400);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return vacio(400);
  }

  const payload = validateEvent(parsed);
  if (!payload) return vacio(400);

  logEvent(payload, now);
  return new Response(null, { status: 204 });
}

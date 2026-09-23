import { SKU_RE } from "./sku";

export type Evento = "buscar" | "salida_tienda" | "alerta_alta";

export type EventPayload = {
  evento: Evento;
  props: Record<string, string | number>;
};

export const MAX_BODY_BYTES = 1024;
export const MAX_STR = 64;

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

export function validateEvent(input: unknown): EventPayload | null {
  if (!isPlainObject(input)) return null;

  const { evento, props } = input;
  if (typeof evento !== "string" || !(evento in SCHEMAS)) return null;
  if (!isPlainObject(props)) return null;

  const schema = SCHEMAS[evento as Evento];
  if (!hasExactKeys(props, schema)) return null;

  for (const [key, val] of Object.entries(props)) {
    if (typeof val === "string") {
      if (val.length > MAX_STR) return null;
    } else if (typeof val === "number") {
      if (!Number.isFinite(val)) return null;
    } else {
      return null;
    }

    const validator = schema[key];
    if (!validator || !validator(val)) return null;
  }

  return {
    evento: evento as Evento,
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

  let text: string;
  try {
    text = await request.text();
  } catch {
    return vacio(400);
  }

  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return vacio(400);

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

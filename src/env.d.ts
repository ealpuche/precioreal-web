/// <reference types="astro/client" />

// Sin imports de nivel superior a propósito: eso convertiría este archivo en módulo y ENV
// dejaría de ser un tipo global, rompiendo src/lib/subscribe.ts sin mensaje claro. Si hace
// falta importar algo aquí, mueve ENV a src/lib/env.ts y actualiza a quien lo consuma.
type ENV = {
  SUBSCRIBERS: KVNamespace;
  TURNSTILE_SECRET: string;
  // Opcional: no existe en tests ni en un preview sin configurar. En `astro dev` sí
  // existe (wrangler.jsonc) y apunta a una base local (#32).
  EVENTS_DB?: import("./lib/event-store").EventsDb;
};
type Runtime = import("@astrojs/cloudflare").Runtime<ENV>;
declare namespace App {
  interface Locals extends Runtime {}
}

// Variables públicas de build. `PUBLIC_CF_BEACON_TOKEN` se define solo en el
// entorno Production de Pages: previews y local no inyectan Web Analytics (#24).
interface ImportMetaEnv {
  readonly PUBLIC_CF_BEACON_TOKEN?: string;
}

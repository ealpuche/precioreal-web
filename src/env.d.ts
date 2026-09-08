/// <reference types="astro/client" />

// Sin imports de nivel superior a propósito: eso convertiría este archivo en módulo y ENV
// dejaría de ser un tipo global, rompiendo src/lib/subscribe.ts sin mensaje claro. Si hace
// falta importar algo aquí, mueve ENV a src/lib/env.ts y actualiza a quien lo consuma.
type ENV = { SUBSCRIBERS: KVNamespace; TURNSTILE_SECRET: string };
type Runtime = import("@astrojs/cloudflare").Runtime<ENV>;
declare namespace App {
  interface Locals extends Runtime {}
}

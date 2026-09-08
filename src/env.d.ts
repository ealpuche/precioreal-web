/// <reference types="astro/client" />
type ENV = { SUBSCRIBERS: KVNamespace; TURNSTILE_SECRET: string };
type Runtime = import("@astrojs/cloudflare").Runtime<ENV>;
declare namespace App {
  interface Locals extends Runtime {}
}

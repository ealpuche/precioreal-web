import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

// ADR-001: estático por defecto; las rutas que necesiten SSR declaran `prerender = false`.
export default defineConfig({
  site: "https://precioreal.mx",
  adapter: cloudflare({ platformProxy: { enabled: true } }),
});

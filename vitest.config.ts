import { defineConfig } from "vitest/config";

// `include` deja fuera los `.astro` a propósito: el coverage de v8 solo mide el
// JS que ejecuta el runner, y la landing (1,100+ líneas con estilos inline) no
// tiene tests ni puede tenerlos sin un runner de DOM. Lo que se mide es la lógica
// pura de `lib/` y `contracts/`, más los endpoints `.ts` de `pages/`, que sí
// tienen tests: 7 para los del sitemap y 2 para `api/subscribe` (#6). Los otros 6
// casos de tests/sitemap.test.ts están en `describe("sitemap pure helpers")` y
// prueban `src/lib/sitemap.ts`, no los endpoints (CR PR #23, H3).
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: [
        "src/lib/**/*.ts",
        "src/contracts/**/*.ts",
        "src/pages/**/*.ts",
      ],
      exclude: ["**/*.d.ts"],
      thresholds: { lines: 90 },
    },
  },
});

# ADR-002: Rediseño v1 — identidad PrecioReal.mx sobre Astro, sin migrar de framework

## Estado

Aceptado

## Fecha

2026-10-21

## Contexto

El desarrollador pidió un rediseño completo y planteó migrar de Astro a otro framework "si
por escalabilidad vamos a tener que hacerlo más adelante". El diseño se hace en V0
(https://v0.app/chat/o78DE9T2SmW), que entrega React + Tailwind.

Hechos que pesan en la decisión (verificados el 2026-10-21):

- El sitio vive en el plan gratuito de Cloudflare Pages. Cada ruta SSR es una invocación de
  worker (100,000/día) y el worker tiene límite de CPU y de tamaño.
- Lo que hace escalar al producto en los próximos meses es: más fichas indexadas (#16, #28),
  alertas por producto (#17), búsqueda por nombre (#15) y una puerta B2B (#30). Ninguna de
  esas capacidades depende del framework de UI: son datos que publica el productor, endpoints
  en el worker y almacenamiento en D1/KV, que Astro ya expone (`locals.runtime.env`).
- La ficha, que es la página de adquisición, debe llegar a Google con todo el historial en el
  HTML del servidor. Astro lo hace por defecto y sin hidratar nada.
- El repo tiene 16 archivos de tests, guardas de contrato y un CI que verifica el 404
  prerenderizado; una migración los reescribe sin mejorar ninguna métrica de producto.

## Decisión

1. **Se queda Astro 5 con `@astrojs/cloudflare`.** No se migra a Next.js ni a otro framework.
   Next en Cloudflare exige un adaptador adicional (OpenNext), empaqueta más JS por ruta y
   no aporta nada a las cuatro capacidades de arriba.
2. **Sin framework de UI** (se mantiene ADR-001). El código de V0 es la especificación visual:
   se porta a componentes `.astro` con `<style>` scoped y tokens. El único JS de cliente
   sigue siendo el tooltip de la gráfica y el evento `salida_tienda`.
3. **Identidad clara por defecto**: tokens nuevos en `src/styles/tokens.css` (papel, tinta,
   azul firma; Archivo + IBM Plex Mono), decididos en Notion → Branding y en el repo
   `ealpuche/precioreal-brand`. El modo oscuro queda fuera de v1.
4. **Nav y footer únicos** en `Base.astro` para todas las páginas.

## Cuándo se revisa

Se reabre si aparece una capacidad que exija estado de aplicación en el cliente (por
ejemplo, listas de seguimiento editables con muchas interacciones por página). En ese caso
la primera opción es una isla (`@astrojs/react` o Preact) en la ruta que la necesite, no una
migración del sitio.

## Consecuencias

- `src/pages/index.astro` deja de ser la excepción de estilos inline de ADR-001: se reescribe
  con tokens y componentes. La política del revisor (`.github/claude-review.md`) aún la
  menciona; se actualiza en un PR aparte, como exige el flujo.
- Desaparecen `src/scripts/landing.ts`, `src/lib/logic.ts` y su test: la portada ya no
  consume `public/deals.json` (el feed mezcla tiendas sin ficha). `/api/subscribe` sigue
  desplegado y sin cambios, pero la portada ya no lo enlaza.
- `/datos` se prerenderiza: el adaptador lo añade al `exclude` de `_routes.json` y no cuesta
  invocaciones. Igual `favicon.svg` y `apple-touch-icon.png`.
- `<meta name="theme-color">` lleva el color de fondo literal: las variables CSS no aplican
  en metadatos.

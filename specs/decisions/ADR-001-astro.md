# ADR-001: Adopción de Astro + TypeScript para la web de PrecioReal

## Estado

Aceptado

## Fecha

2026-09-07

## Contexto

PrecioReal.mx inició con una landing page estática en HTML/CSS/JS y una Cloudflare Pages Function para la captura de correos. Para la Fase 1 (UI de hardware: buscador y ficha con historial de Cyberpuerta, Refs #3) se requiere una base técnica escalable con tipado estricto pero sin el peso ni la sobrecarga de hidratación de un framework tradicional de SPA.

## Decisión

Adoptar **Astro** con el adaptador de Cloudflare (`@astrojs/cloudflare`) y TypeScript:

1. **Sin framework de UI** en esta fase inicial: Astro genera HTML puro por defecto (zero-JS overhead salvo interactividad puntual requerida).
2. **Estático por defecto**: las rutas se prerenderizan como estáticas a menos que declaren `export const prerender = false;` (como los endpoints de API que interactúan con Cloudflare KV y validación Turnstile).
3. **Bindings de Cloudflare Pages**: las variables de entorno y KV namespaces se acceden mediante `locals.runtime.env`.
4. **TypeScript**: configuración estricta (`astro/tsconfigs/strict`) para garantizar seguridad de tipos en la lógica de cliente y endpoints.

## Consecuencias

- Migración 1:1 de la landing existente sin cambios visuales ni de funcionalidad observables.
- Compatibilidad nativa con Cloudflare Pages y compatibilidad local mediante `wrangler` / Astro dev server.
- Toolchain unificado de linting, formateo y pruebas con Prettier, Astro check y Vitest.
- Tercera desviación del "1:1": `setupChips` ignora chips con `data-store` vacío en lugar de
  vaciar la rejilla. Lo exige `strictNullChecks`; sin efecto observable con el HTML actual,
  donde ningún chip tiene el atributo vacío.

## Configuración de Cloudflare Pages (2026-09-08)

`wrangler.jsonc` existe **solo para desarrollo local** (bindings vía `platformProxy`) y
deliberadamente NO lleva `pages_build_output_dir`. La documentación de Pages advierte que
añadir esa clave hace que el despliegue tome la configuración del archivo — pensada para
local — en lugar de la del dashboard, donde viven el secreto `TURNSTILE_SECRET` y el binding
`SUBSCRIBERS` de producción.

Consecuencia: en el log de build de Pages aparece "A Wrangler configuration file was found
but it does not appear to be valid". Es el aviso esperado de que el archivo se ignora para
producción, no un error.

La configuración de build vive en el dashboard: build command `npm run build`, output
directory `dist`, `NODE_VERSION=22`. Se migrará al archivo el día que los bindings de
producción se declaren ahí y se verifique que la suscripción sigue funcionando.

## Sesiones del adaptador de Cloudflare (2026-09-08)

Cada build imprime:

    [@astrojs/cloudflare] Enabling sessions with Cloudflare KV with the "SESSION" KV binding.
    [@astrojs/cloudflare] If you see the error "Invalid binding `SESSION`" ...

Se intentó desactivarlas y no es posible con `@astrojs/cloudflare` v12: el aviso se emite de
forma incondicional mientras `config.session?.driver` esté ausente
(`dist/index.js`, comprobación `if (!session?.driver)`), el esquema de Astro rechaza
`session: false` porque espera un objeto, y la única opción del adaptador es
`sessionKVBindingName`, que renombra el binding sin desactivar nada.

Se descartó fijar `session: { driver: "memory" }` solo para silenciar el log: cambiaría un
aviso visible por un almacén de sesiones que no persiste entre requests en el edge — un fallo
más sutil que el que se quería evitar. El aviso existe precisamente para que la ausencia del
binding no sorprenda después.

Decisión: se acepta el aviso. Ninguna ruta usa sesiones hoy. **Condición: la primera ruta que
las use debe crear el binding KV `SESSION` en el proyecto de Pages antes de desplegarse**, o
fallará en producción con "Invalid binding `SESSION`". Se revisa si el adaptador expone una
forma de desactivarlas en una versión posterior (ver el issue de migración a Astro 7).

## Rutas del worker y coste (2026-09-08)

Con el adaptador, el despliegue pasa a modo avanzado (`dist/_worker.js`). El `_routes.json`
generado determina si cada visita a la landing invoca el worker o se sirve como asset estático.
Contenido verificado en este PR:

    {
      "version": 1,
      "include": [
        "/*"
      ],
      "exclude": [
        "/",
        "/_astro/*"
      ]
    }

Lectura del resultado: **solo `/` y `/_astro/*` se sirven como estáticos**; cualquier otra ruta
—incluidos los 404 y las páginas que llegan en los PRs 2 y 3 (`/hardware`,
`/hardware/{categoria}`, `/{tienda}/{sku}`)— pasa por el worker. La frase "estático por
defecto" de este ADR describe el modo de renderizado de Astro (`prerender` activo salvo
declaración contraria), no cómo Pages sirve las rutas.

Sin impacto hoy: el plan gratuito cubre 100.000 invocaciones de worker al día y el tráfico
actual está muy por debajo. Se revisa cuando el hub de hardware esté publicado y haya cifras
de tráfico reales; si hiciera falta, las páginas prerenderizadas pueden añadirse al `exclude`.

## Estilos: sin inline en código nuevo (2026-09-08)

Regla que se venía aplicando desde el scaffold (tokens.css, componentes con `<style>` scoped)
pero que nunca quedó escrita aquí — un PR la citó como si ya estuviera en este ADR y no lo
estaba (CR PR #7, H9). Queda formalizada: código nuevo no usa el atributo `style=` inline; usa
variables CSS de `src/styles/tokens.css` y bloques `<style>` scoped por componente. La landing
heredada (`src/pages/index.astro`) es la única excepción, y es deliberada: migrarla es
refactor, no parte de ningún PR de feature (ver la sección de Consecuencias arriba).

## Corrección: JS de cliente en gráficas (2026-09-08)

El PR de la ficha de producto (#7) prohibió "JavaScript de cliente ni hidratación" en
`PriceChart`. Esa prohibición era demasiado amplia: el objetivo real nunca fue "cero JS", fue
evitar frameworks e hidratación de componentes.

Regla corregida: **sin frameworks de UI ni hidratación de componentes; JavaScript vainilla
permitido cuando aporta interactividad real**, con dos condiciones: (1) el servidor calcula
todo lo que pueda calcularse en build/request time — el cliente solo lee y reacciona, nunca
recalcula lógica de negocio ni escalas; (2) la lógica pura (sin DOM) se extrae a un módulo
`.ts` normal con su propio test, igual que `format.ts` y `catalog.ts`; solo el pegamento de
eventos/DOM se queda dentro del `<script>` del componente, porque eso sí requiere navegador
para probarse (issue #6 — Playwright pendiente).

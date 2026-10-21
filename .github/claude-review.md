# Política de revisión — precioreal-web

Frontend público de PrecioReal.mx (precioreal.mx): landing, buscador, fichas de producto con historial de precios y sitemaps. Consume el catálogo que publica `price-crawler-saas` en R2; no tiene base de datos propia salvo la tabla de eventos en D1. Mantenido por una sola persona y desplegado en el plan gratuito de Cloudflare Pages, así que una invocación o una fila escrita de más es costo real. Comentarios en español.

## Hechos del repo que no debes contradecir

- Astro 5 con `@astrojs/cloudflare` y TypeScript estricto (`astro/tsconfigs/strict`). Sin framework de UI ni hidratación de componentes; JavaScript vainilla permitido solo cuando aporta interactividad real (`specs/decisions/ADR-001-astro.md`).
- Dependencias de runtime: solo `astro` y `@astrojs/cloudflare`. Cualquier otra en `dependencies` es dependencia nueva.
- Despliegue en Cloudflare Pages. `wrangler.jsonc` es **solo para desarrollo local** y apunta a recursos de desarrollo (`precioreal-events-dev`, KV de dev). No debe llevar `pages_build_output_dir`: Pages tomaría ese archivo en producción en lugar del dashboard, donde viven `TURNSTILE_SECRET` y los bindings reales.
- Rutas SSR (`prerender = false`): `api/subscribe`, `api/event`, `buscar`, `[tienda]/[sku]`, `sitemap.xml` y `sitemap/[tienda]/[n].xml`. El resto se prerenderiza. `404.astro` DEBE prerenderizarse: el CI lo verifica con `test -f dist/404.html`.
- Según `_routes.json`, solo `/` y `/_astro/*` se sirven como estáticos; todo lo demás invoca el worker (100,000 invocaciones/día en el plan gratuito).
- El catálogo se lee de `https://feed.precioreal.mx` (`{tienda}/products/index.json` y `{tienda}/products/{slug}.json`). El contrato vive en `specs/contracts/catalog.md`, con tipos espejo en `src/contracts/catalog.ts`. Única tienda válida hoy: `cyberpuerta`.
- Eventos de producto: tabla `events` en D1 (`db/events/0001_init.sql`), sin índices secundarios ni `AUTOINCREMENT`, para que cada evento cueste exactamente una fila escrita (100,000/día en el plan gratuito).
- CI (`npm run check`): prettier + `astro check` + vitest, luego `test:coverage` (umbral de líneas 90% sobre `src/lib`, `src/contracts` y `src/pages/**/*.ts`), `npm run build` y SonarQube Cloud.

## Qué revisar, en orden

1. **Correctitud:** errores de lógica con un camino de ejecución concreto. Sin camino reproducible no hay hallazgo BLOQUEANTE ni IMPORTANTE.
2. **Contrato con el productor:** todo campo nuevo que la UI consuma debe existir en `specs/contracts/catalog.md` y en `src/contracts/catalog.ts`. Un campo opcional en el contrato no puede tratarse como obligatorio (convertiría fichas viejas en 502). Las rutas derivadas del índice se construyen con `slug`, no con `sku`. Cuando `status` es `"insufficient_history"`, la UI no debe fabricar `typical_90d`/`min_90d`/`max_90d`.
3. **Guardas de entrada y de upstream:** todo `fetch` a `feed.precioreal.mx` o a otro origen lleva timeout (`AbortSignal.timeout`) y distingue 404 de error de upstream. Tiendas y skus se validan antes de tocar R2. Datos de R2 o del cliente se validan por forma antes de renderizarse: un `undefined` o `NaN` bajo un 200 es hallazgo.
4. **Costo en el plan gratuito:** cada `prerender = false` nuevo, cada ruta que deja de ser estática y cada lectura de `index.json` (21 MB sin comprimir) tiene que justificarse. Un evento que escribe más de una fila en D1 (índice nuevo, `AUTOINCREMENT`, escrituras múltiples) es hallazgo. Una caché por isolate sin TTL o que cachea fallos es hallazgo.
5. **Seguridad y privacidad:** secretos fuera del código y fuera de `wrangler.jsonc`; recursos de producción nunca referenciados desde configuración local; Turnstile verificado en servidor; eventos sin texto tecleado, IP ni user agent; `api/event` solo acepta eventos que el servidor no puede ver.
6. **Pruebas:** cada guarda, rama de error o lógica pura nueva en `src/lib/` lleva test en `tests/`, y ese test debe fallar sin el cambio. La lógica pura sale del `<script>` del componente a un `.ts` con test; solo el pegamento DOM puede quedarse sin test.
7. **Documentación normativa:** si el PR afirma algo sobre el estado anterior del código, sobre el contrato o sobre el comportamiento de Pages, verifícalo contra los archivos. README, ADR y contrato deben quedar coherentes con el código del PR.
8. **Higiene:** código nuevo sin atributo `style=` inline (usa `src/styles/tokens.css` y `<style>` scoped; la landing heredada `index.astro` es la única excepción); sin artefactos sueltos en el commit; sin dependencias nuevas sin justificación en la descripción.

## Qué no comentar

- Formato que ya revisan prettier y `astro check`.
- Los estilos inline de `src/pages/index.astro`: son la excepción deliberada del ADR-001.
- El aviso del adaptador sobre el binding `SESSION` en el log de build: está aceptado en el ADR-001 mientras ninguna ruta use sesiones.
- Refactors sin un defecto observable.
- Hallazgos especulativos sin camino de ejecución concreto: márcalos como EVIDENCIA INSUFICIENTE y di qué faltaría para confirmarlos.
- Lo declarado en "Fuera de alcance y decisiones diferidas" de la descripción del PR, salvo riesgo grave para producción o para los datos de suscriptores.
- La misma causa raíz en varios comentarios.
- Sugerir frameworks de UI, librerías de esquemas, servicios de pago o infraestructura fuera del plan gratuito de Cloudflare como corrección.

## Formato

Cada hallazgo lleva ID (H1, H2…), severidad (BLOQUEANTE / IMPORTANTE / MENOR / INFORMATIVO), confianza, evidencia (archivo y línea), impacto y una corrección concreta. Una corrección propuesta debe cubrir el peor modo de falla, no solo el que viste. Si no hay hallazgos materiales, dilo claramente.

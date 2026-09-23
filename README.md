# precioreal-web

Frontend de PrecioReal.mx — estático en Cloudflare Pages + Pages Functions.

## Contratos

- Feed: GET https://feed.precioreal.mx/public/deals.json
  { generated_at: ISO8601, deals: [{ product, store, url, current_price(str),
  reference_price(str), discount_pct(float), detected_at }] } (máx 50)
- Captura: POST /api/subscribe { email, turnstileToken } → 200 {ok:true} | 400 | 500

## Bindings requeridos en Pages

- KV: SUBSCRIBERS → precioreal-subscribers (d5841532f55d4718a5ab3c16845a83b3)
- Secret: TURNSTILE_SECRET

## Local

```bash
npm ci && npm run dev
```

Nota: crear `.dev.vars` con `TURNSTILE_SECRET=...` para probar suscripción localmente.

## Despliegue (Pages)

> **Precondición de merge.** Actualizar la configuración del proyecto en el dashboard de Pages
> ANTES de fusionar a `main`. La configuración anterior (output directory `public`, sin build
> command) publica un directorio que ya no existe: la landing queda caída. Ocurrió en el primer
> deploy de esta rama.

- Build command: `npm run build`
- Build output directory: `dist`
- Variable de entorno: `NODE_VERSION=22`
- Bindings (sin cambios): KV `SUBSCRIBERS` → `precioreal-subscribers`; secreto `TURNSTILE_SECRET`
- El entorno **Preview** tiene su propia configuración: sin `TURNSTILE_SECRET` ahí, la
  suscripción responde `server_misconfigured` en los previews de PR.

## Métricas

Dos fuentes, con retención distinta.

**Cloudflare Web Analytics** — visitas y páginas vistas, sin cookies ni banner
de consentimiento. Dashboard de Cloudflare → Analytics & Logs → Web Analytics →
precioreal.mx. Solo cuenta cuando el build se hace con `PUBLIC_CF_BEACON_TOKEN`,
que se define únicamente en el entorno Production de Pages: previews y local no
cuentan. El sitio usa el snippet manual, no la inyección automática de
Cloudflare: con las dos activas, cada página cargaría dos beacons y las visitas
se contarían doble. Los bloqueadores de anuncios pueden impedir la carga del
beacon; es una métrica de referencia, no un conteo exacto.

**Eventos de producto** — Workers Logs, una línea JSON por evento con la forma
`{"t":"evt","evento":…,"props":{…},"ts":…}`. Workers & Pages → precioreal-web →
Logs, filtrando por `t = evt`.

Regla de ubicación: un evento se emite en servidor si el servidor ya ve la
acción (búsquedas, altas de alerta) y en cliente solo si nunca la ve (un clic
hacia otro sitio).

| Evento          | Dónde se emite                                                          | Props                                   |
| --------------- | ----------------------------------------------------------------------- | --------------------------------------- |
| `buscar`        | Servidor, en `/buscar`, una vez por búsqueda, también las que redirigen | `modo`, `resultados`, `resultado`, `ms` |
| `salida_tienda` | Cliente, clic en "Ver en {tienda}" de la ficha                          | `tienda`, `slug`                        |
| `alerta_alta`   | Servidor, desde el endpoint de #17 (aún no se emite)                    | `tienda`                                |

Cómo leer `buscar`:

- `modo`: `sku` o `url`. `texto` está reservado para la búsqueda por nombre de #15.
- `resultados`: en `sku` y `url` vale 1 si la búsqueda redirige a una ficha y 0 si
  no. En `sku` el redirect no comprueba que la ficha exista: cuenta propuestas,
  no aciertos.
- `ms`: espera de red, no tiempo de proceso. En Workers, `Date.now()` solo avanza
  tras una operación de entrada/salida, así que suele valer 0 salvo cuando se
  consulta el índice.
- Una búsqueda cuyo evento no valida se registra aparte como
  `{"t":"evt_invalid",…}`. Si aparece, `RESULTADOS_BUSCAR` y `buscar.astro` se
  desincronizaron.

Los eventos nunca incluyen el texto tecleado, la IP ni el user agent. El registro
de invocación que Workers genera por su cuenta puede guardar la URL de cada
petición; se revisa en #32.

**Límites:** `/api/event` acepta cualquier POST same-origin válido y no tiene
límite de tasa en el código. Los eventos son una señal orientativa y se
contrastan con Web Analytics. Antes de que una decisión dependa del volumen
absoluto hace falta la regla de borde descrita en #32.

**Retención:** Workers Logs guarda 3 días en el plan Free y 7 en el Paid. El
destino persistente se sigue en #32.

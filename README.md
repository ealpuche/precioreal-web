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
cuentan. Los bloqueadores de anuncios pueden impedir la carga del beacon; es una
métrica de referencia, no un conteo exacto.

**Eventos de producto** — Workers Logs, una línea JSON por evento con la forma
`{"t":"evt","evento":…,"props":{…},"ts":…}`. Workers & Pages → precioreal-web →
Logs, filtrando por `t = evt`.

| Evento          | Dónde se emite                                                          | Props                                   |
| --------------- | ----------------------------------------------------------------------- | --------------------------------------- |
| `buscar`        | Servidor, en `/buscar`, una vez por búsqueda, también las que redirigen | `modo`, `resultados`, `resultado`, `ms` |
| `salida_tienda` | Cliente, clic en "Ver en {tienda}" de la ficha                          | `tienda`, `slug`                        |
| `alerta_alta`   | Reservado para #17                                                      | `tienda`                                |

Nunca se registra el texto que el usuario teclea, la IP ni el user agent.

**Retención:** Workers Logs guarda 3 días en el plan Free y 7 en el Paid. Para
series más largas hace falta un destino persistente (pendiente, ver #24).

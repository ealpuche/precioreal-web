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

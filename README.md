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
npm ci && npm run dev   # http://localhost:8788

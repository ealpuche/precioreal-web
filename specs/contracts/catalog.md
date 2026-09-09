# Contrato: catálogo por tienda (JSON estático en R2)

Productor: ealpuche/price-crawler-saas#128 · Consumidor: esta web (#3)
Base: https://feed.precioreal.mx · Bucket: precioreal-public

Nombres de recurso al estilo Richardson nivel 1: si un día hay API (nivel 2), las URIs no cambian.

## Recursos

`{tienda}/products/index.json`

- `generated_at`, `site`, `window_days` (int), `count`
- `products[]`: `sku`, `name`, `url`, `image_url` (null|string), `category` (null|string),
  `price`, `obs` (int), `since` (ISO), `available` (bool), `is_from_price` (bool),
  `status` (opcional, mismo dominio que en `{sku}.json`), `first_seen_at` (ISO, opcional)
  - `typical_90d`, `min_90d` — **solo cuando `status` es `"ok"`**

`{tienda}/products/{sku}.json`

- `sku`, `name`, `url`, `image_url`, `category`, `site`, `generated_at`, `window_days` (int)
- `current`: `{ price, since, available }`
- `status`: `"ok"` | `"insufficient_history"` (opcional; ausente equivale a `"ok"`)
- `obs`, `first_seen_at` (ISO, opcional — las fichas anteriores a #131 no lo traen),
  `is_from_price` (bool, opcional)
- `typical_90d`, `min_90d`, `max_90d` — **solo cuando `status` es `"ok"`**
- `series[]`: `[first_seen_at, price, available]` — solo `is_available=true`, historial
  COMPLETO, orden ascendente

## Reglas

- Precios: string decimal con 2 decimales. Fechas: ISO-8601 UTC.
- `{tienda}` es el slug del nombre del sitio (`cyberpuerta` hoy; `ddtech`, `pcel` después).
- `window_days` documenta la ventana real usada para `typical_90d`/`min_90d`/`max_90d`; no
  asumir 90 fijo pese al nombre de los campos.
- `series` es el historial completo; la UI deriva otras ventanas (30 d, todo) de `series`,
  sin re-exportar.
- `typical_90d` se calcula con la misma función que usa el detector del canal
  (`load_price_levels` + `compute_typical_price`). Un número distinto en la UI y en Telegram
  es un bug.
- Campos nuevos se agregan; nunca se renombran ni se quitan sin issue en ambos repos.
- `series` no está paginada. Si un SKU supera ~2000 puntos, el productor emite `series`
  diezmada más `series_full_url`; issue coordinado en ambos repos antes de rebasar el umbral.
- Tipos espejo en `src/contracts/catalog.ts`. Pendiente: test que valide un fixture real
  producido por el crawler — hoy los tests usan literales escritos a mano (`sampleProduct`,
  `makeProduct()`); el contrato sigue sin verificarse contra la forma real que emite el
  productor (CR PR #7, H1).
- `is_from_price` en `{sku}.json` es **opcional para el consumidor**: lo agrega
  price-crawler-saas#132, pero las fichas publicadas antes de ese cambio no lo traen hasta que
  el backfill diario las reescriba. La UI trata su ausencia como `false`, nunca como un error
  de forma: exigirlo convertiría cada ficha vieja en un 502 por un campo que solo antepone una
  palabra al precio.
- `status` es **opcional para el consumidor**: lo agrega price-crawler-saas#131, y las fichas
  publicadas antes no lo traen hasta que el backfill las reescriba. Ausente equivale a `"ok"`,
  que es lo que esas fichas son: solo se publicaban productos con historial suficiente.
- Cuando `status` es `"insufficient_history"` el productor **no** emite `typical_90d`,
  `min_90d` ni `max_90d`. Fabricar una estadística de ventana para un producto con dos
  observaciones es justo lo que el productor evita; el consumidor no debe derivarla del precio
  actual para rellenar el hueco.

## Recurso ausente (producto sin ficha en R2)

Con price-crawler-saas#131 desplegado, un 404 en `{sku}.json` solo significa que el producto no
existe en el catálogo o no está activo en la tienda. Los productos activos con historial
insuficiente ahora se publican con `status: "insufficient_history"`.

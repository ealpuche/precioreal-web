# Contrato: catálogo por tienda (JSON estático en R2)

Productor: ealpuche/price-crawler-saas#128 · Consumidor: esta web (#3)
Base: https://feed.precioreal.mx · Bucket: precioreal-public

Nombres de recurso al estilo Richardson nivel 1: si un día hay API (nivel 2), las URIs no cambian.

## Recursos

`{tienda}/products/index.json`

- `generated_at`, `site`, `count`
- `products[]`: `sku`, `name`, `url`, `image_url` (null|string), `category`, `price`,
  `typical_90d`, `min_90d`, `obs` (int), `since` (ISO), `is_from_price` (bool)

`{tienda}/products/{sku}.json`

- `sku`, `name`, `url`, `image_url`, `category`, `site`, `generated_at`
- `current`: `{ price, since, available }`
- `typical_90d`, `min_90d`, `max_90d`, `obs`
- `series[]`: `[first_seen_at, price, available]` — solo `is_available=true`, historial
  COMPLETO, orden ascendente

## Reglas

- Precios: string decimal con 2 decimales. Fechas: ISO-8601 UTC.
- `{tienda}` es el slug del nombre del sitio (`cyberpuerta` hoy; `ddtech`, `pcel` después).
- `typical_90d`, `min_90d` y `max_90d` son estadísticas de ventana de 90 días; `series` es el
  historial completo. La UI deriva otras ventanas (30 d, todo) de `series`, sin re-exportar.
- `typical_90d` se calcula con la misma función que usa el detector del canal
  (`load_price_levels` + `compute_typical_price`). Un número distinto en la UI y en Telegram
  es un bug.
- Campos nuevos se agregan; nunca se renombran ni se quitan sin issue en ambos repos.
- Tipos espejo en `src/contracts/catalog.ts`; un test valida un fixture producido por el
  crawler.

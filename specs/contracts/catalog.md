# Contrato: catálogo por tienda (JSON estático en R2)

Productor: ealpuche/price-crawler-saas#128 · Consumidor: esta web (#3)
Base: https://feed.precioreal.mx · Bucket: precioreal-public

Nombres de recurso al estilo Richardson nivel 1: si un día hay API (nivel 2), las URIs no cambian.

## Recursos

`{tienda}/products/index.json`

- `generated_at`, `site`, `window_days` (int), `count`
- `products[]`: `sku`, `name`, `url`, `image_url` (null|string), `category` (null|string),
  `price`, `typical_90d`, `min_90d`, `obs` (int), `since` (ISO), `available` (bool),
  `is_from_price` (bool)

`{tienda}/products/{sku}.json`

- `sku`, `name`, `url`, `image_url`, `category`, `site`, `generated_at`, `window_days` (int)
- `current`: `{ price, since, available }`
- `typical_90d`, `min_90d`, `max_90d`, `obs`
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

## Recurso ausente (producto activo sin ficha en R2)

Medido en Cyberpuerta (2026-09-08, 32,151 productos activos): un producto puede no tener
`{sku}.json` en R2 por dos razones y merecen mensajes distintos en la UI:

1. **Historial insuficiente** (menos de 5 observaciones, o menos de 14 días desde la
   primera): ~6,758 productos (21%). Mensaje: "Aún no hay suficiente historial para
   mostrar — llevamos poco tiempo rastreándolo."
2. **Sin actividad reciente dentro de la ventana**: cumple antigüedad y volumen mínimo, pero
   ninguna observación cae en los últimos `window_days` días. ~2,751 productos (12% de los
   elegibles). Mensaje: "Sin cambios de precio recientes."

El contrato hoy NO distingue estos dos casos para un producto sin recurso: ambos dan 404 en
R2. Diferenciarlos en la UI requiere que el productor exponga una señal adicional (issue
futuro en #128); mientras tanto, esta ficha usa un mensaje genérico honesto para el 404, sin
inventar cuál de los dos casos aplica.

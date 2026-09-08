# Contrato de Catálogo e Historial de Precios (UI Fase 1)

Productor: `price-crawler-saas#128`
Consumidor: `precioreal-web#3`

Bucket: `precioreal-public`
Prefijo: `cp/`
Convención: todos los precios como string decimal con 2 decimales; todas las fechas ISO-8601 UTC.

## Archivos

### 1. `cp/index.json`

Índice de productos para búsqueda y filtrado inicial.

- `generated_at`: ISO-8601 UTC string
- `site`: string ("Cyberpuerta")
- `count`: entero
- `products[]`: lista de objetos:
  - `sku`: string
  - `name`: string
  - `url`: string
  - `image_url`: string | null
  - `category`: string
  - `price`: string (ej. "15999.90")
  - `typical_90d`: string
  - `min_90d`: string
  - `obs`: int
  - `since`: ISO-8601 UTC string
  - `is_from_price`: boolean

### 2. `cp/p/{sku}.json`

Detalle de producto y serie temporal histórica de 90 días.

- `sku`: string
- `name`: string
- `url`: string
- `image_url`: string | null
- `category`: string
- `site`: string
- `generated_at`: ISO-8601 UTC string
- `current`: objeto `{ price: string, since: string, available: boolean }`
- `typical_90d`: string
- `min_90d`: string
- `max_90d`: string
- `obs`: int
- `series[]`: lista de tuplas/arrays `[first_seen_at: string, price: string, available: boolean]`
  - Solo observaciones con `is_available = true`
  - Ventana móvil de 90 días
  - Orden cronológico ascendente

## Reglas de Evolución

- Los campos nuevos se agregan; nunca se renombran ni se eliminan sin issue coordinado en ambos repositorios.

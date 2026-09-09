/**
 * Charset de sku que el productor publica como clave en R2 (safe_sku del exportador).
 * Vive aparte para que `buscar.astro` y `catalog.ts` compartan el charset sin que la página
 * arrastre el módulo de fetch. Hasta el PR #11 lo importaba además un script de cliente de
 * /buscar; ese script ya no existe, la búsqueda se resuelve en el servidor (CR PR #11, H3).
 * Cuando price-crawler-saas#131 cambie el charset publicado, este es el único punto a tocar.
 */
export const SKU_RE = /^[A-Za-z0-9._-]{1,64}$/;

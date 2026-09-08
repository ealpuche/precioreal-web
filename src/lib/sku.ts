/**
 * Charset de sku que el productor publica como clave en R2 (safe_sku del exportador).
 * Vive aquí y no en catalog.ts porque el script de cliente de /buscar también lo necesita, e
 * importar catalog.ts arrastraría fetchProduct al bundle del navegador (CR PR #7, H8).
 * Cuando price-crawler-saas#131 cambie el charset publicado, este es el único punto a tocar.
 */
export const SKU_RE = /^[A-Za-z0-9._-]{1,64}$/;

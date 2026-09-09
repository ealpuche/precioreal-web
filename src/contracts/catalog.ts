/** Espejo de specs/contracts/catalog.md. Cambios de campo van en ambos a la vez. */

export type CatalogStatus = "ok" | "insufficient_history";

export interface CatalogIndexProduct {
  sku: string;
  /** Clave de R2 de la ficha. Opcional: las entradas anteriores a #137 no lo traen. */
  slug?: string;
  name: string;
  url: string;
  image_url: string | null;
  category: string | null;
  price: string;
  typical_90d?: string;
  min_90d?: string;
  obs: number;
  since: string;
  available: boolean;
  is_from_price: boolean;
  status?: CatalogStatus;
  first_seen_at?: string;
}

export interface CatalogIndex {
  generated_at: string;
  site: string;
  window_days: number;
  count: number;
  products: CatalogIndexProduct[];
}

export interface CatalogProductCurrent {
  price: string;
  since: string;
  available: boolean;
}

/** [first_seen_at, price, available] — historial completo, is_available=true, asc. */
export type CatalogSeriesPoint = [string, string, boolean];

export interface CatalogProduct {
  sku: string;
  /** Clave de R2 de la ficha. Opcional: las entradas anteriores a #137 no lo traen. */
  slug?: string;
  name: string;
  url: string;
  image_url: string | null;
  category: string | null;
  site: string;
  generated_at: string;
  window_days: number;
  current: CatalogProductCurrent;
  obs: number;
  /** Opcional: las fichas publicadas antes de price-crawler-saas#131 no lo traen. */
  status?: CatalogStatus;
  /** Opcional por la misma razón que `status`. */
  first_seen_at?: string;
  /** Ausentes cuando `status` es "insufficient_history". */
  typical_90d?: string;
  min_90d?: string;
  max_90d?: string;
  /** Opcional: las fichas publicadas antes de price-crawler-saas#132 no lo traen. */
  is_from_price?: boolean;
  series: CatalogSeriesPoint[];
}

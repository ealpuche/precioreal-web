export const FEED_URL = "https://feed.precioreal.mx/public/deals.json";

export const STORES: string[] = [
  "Todas",
  "Cyberpuerta",
  "Innovasport",
  "Liverpool",
  "MercadoLibre",
];

export const COUNTERS: { value: string; label: string }[] = [
  { value: "200,000+", label: "Productos monitoreados" },
  { value: "5.6M+", label: "Observaciones de precio" },
  { value: "4", label: "Tiendas" },
  { value: "marzo 2026", label: "Rastreando desde" },
];

const fmtMXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

export function isValidEmail(email: unknown): boolean {
  if (typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function relTime(
  generatedAtIso: string | null | undefined,
  nowMs: number = Date.now(),
): string {
  if (!generatedAtIso) return "";
  const date = new Date(generatedAtIso);
  if (isNaN(date.getTime())) return "";
  const mins = Math.max(0, Math.round((nowMs - date.getTime()) / 60000));
  if (mins < 60) return "actualizado hace " + mins + " min";
  const h = Math.round(mins / 60);
  return "actualizado hace " + h + (h === 1 ? " hora" : " horas");
}

export interface RawDeal {
  product?: unknown;
  store?: unknown;
  url?: unknown;
  current_price?: unknown;
  reference_price?: unknown;
  discount_pct?: unknown;
  [key: string]: unknown;
}

export interface FormattedDeal {
  product: string;
  store: string;
  url: string;
  priceNow: string;
  priceRef: string;
  badge: string;
}

export function buildDeals(
  rawDeals: unknown,
  filter: string = "Todas",
): FormattedDeal[] {
  if (!Array.isArray(rawDeals)) return [];

  return (rawDeals as RawDeal[])
    .filter((d) => {
      if (!d || typeof d !== "object") return false;
      if (!d.url || typeof d.url !== "string") return false;
      const u = d.url.trim();
      if (!/^https?:\/\//i.test(u)) return false;
      if (d.product == null || d.store == null) return false;

      const priceNowNum = parseFloat(String(d.current_price));
      const priceRefNum = parseFloat(String(d.reference_price));
      const discountPctNum = parseFloat(String(d.discount_pct));

      if (isNaN(priceNowNum) || isNaN(priceRefNum) || isNaN(discountPctNum)) {
        return false;
      }

      return true;
    })
    .filter((d) => filter === "Todas" || d.store === filter)
    .sort(
      (a, b) =>
        parseFloat(String(b.discount_pct)) - parseFloat(String(a.discount_pct)),
    )
    .map((d) => {
      const priceNowNum = parseFloat(String(d.current_price));
      const priceRefNum = parseFloat(String(d.reference_price));
      const discountPctNum = parseFloat(String(d.discount_pct));

      return {
        product: String(d.product),
        store: String(d.store),
        url: String(d.url).trim(),
        priceNow: fmtMXN.format(priceNowNum),
        priceRef: fmtMXN.format(priceRefNum),
        badge: "-" + Math.round(discountPctNum) + "%",
      };
    });
}

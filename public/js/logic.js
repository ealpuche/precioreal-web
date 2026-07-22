export const FEED_URL = "https://feed.precioreal.mx/public/deals.json";

export const STORES = [
  "Todas",
  "Cyberpuerta",
  "Innovasport",
  "Liverpool",
  "MercadoLibre",
];

export const COUNTERS = [
  { value: "200,000+", label: "Productos monitoreados" },
  { value: "5.6M+", label: "Observaciones de precio" },
  { value: "4", label: "Tiendas" },
  { value: "marzo 2026", label: "Rastreando desde" },
];

const fmtMXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

export function isValidEmail(email) {
  if (typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function relTime(generatedAtIso, nowMs = Date.now()) {
  if (!generatedAtIso) return "";
  const date = new Date(generatedAtIso);
  if (isNaN(date.getTime())) return "";
  const mins = Math.max(0, Math.round((nowMs - date.getTime()) / 60000));
  if (mins < 60) return "actualizado hace " + mins + " min";
  const h = Math.round(mins / 60);
  return "actualizado hace " + h + (h === 1 ? " hora" : " horas");
}

export function buildDeals(rawDeals, filter = "Todas") {
  if (!Array.isArray(rawDeals)) return [];

  return rawDeals
    .filter((d) => {
      if (!d || typeof d !== "object") return false;
      if (!d.url || typeof d.url !== "string") return false;
      const u = d.url.trim();
      if (!/^https?:\/\//i.test(u)) return false;
      if (d.product == null || d.store == null) return false;

      const priceNowNum = parseFloat(d.current_price);
      const priceRefNum = parseFloat(d.reference_price);
      const discountPctNum = parseFloat(d.discount_pct);

      if (isNaN(priceNowNum) || isNaN(priceRefNum) || isNaN(discountPctNum)) {
        return false;
      }

      return true;
    })
    .filter((d) => filter === "Todas" || d.store === filter)
    .sort((a, b) => parseFloat(b.discount_pct) - parseFloat(a.discount_pct))
    .map((d) => {
      const priceNowNum = parseFloat(d.current_price);
      const priceRefNum = parseFloat(d.reference_price);
      const discountPctNum = parseFloat(d.discount_pct);

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

import { track } from "../lib/track";

// Delegado en document: el enlace existe solo cuando la ficha resolvió.
document.addEventListener("click", (e) => {
  const el =
    e.target instanceof Element ? e.target.closest("a[data-track]") : null;
  if (!(el instanceof HTMLAnchorElement)) return;
  if (el.dataset.track !== "salida_tienda") return;
  track("salida_tienda", {
    tienda: el.dataset.tienda ?? "",
    slug: el.dataset.slug ?? "",
  });
});

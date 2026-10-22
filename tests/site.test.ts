import { describe, expect, it } from "vitest";
import {
  CONTACT_EMAIL,
  COBERTURA,
  FICHA_EJEMPLO,
  TELEGRAM_URL,
} from "../src/lib/site";
import { SKU_RE } from "../src/lib/sku";

describe("datos del sitio", () => {
  it("la ficha de ejemplo de la portada tiene una ruta que /cyberpuerta/[sku] acepta", () => {
    expect(FICHA_EJEMPLO.tienda).toBe("cyberpuerta");
    expect(SKU_RE.test(FICHA_EJEMPLO.slug)).toBe(true);
  });

  it("los enlaces externos son https o mailto válidos", () => {
    expect(TELEGRAM_URL.startsWith("https://t.me/")).toBe(true);
    expect(CONTACT_EMAIL).toMatch(/^[^\s@]+@precioreal\.mx$/);
  });

  it("la cobertura publicada nombra una sola tienda y una fecha de medición legible", () => {
    expect(COBERTURA.tienda).toBe("Cyberpuerta");
    expect(Number.isFinite(Date.parse(COBERTURA.medidoEl))).toBe(true);
  });
});

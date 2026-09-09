import { describe, it, expect } from "vitest";
import {
  normalizeProductUrl,
  looksLikeUrl,
  tiendaNoPublicada,
} from "../src/lib/product-url";

describe("normalizeProductUrl", () => {
  it("normalizes canonical URL", () => {
    expect(
      normalizeProductUrl(
        "https://www.cyberpuerta.mx/Computadoras/Laptops/Laptop-Dell.html",
      ),
    ).toBe("cyberpuerta.mx/Computadoras/Laptops/Laptop-Dell.html");
  });

  it("normalizes URL without www", () => {
    expect(
      normalizeProductUrl(
        "https://cyberpuerta.mx/Computadoras/Laptops/Laptop-Dell.html",
      ),
    ).toBe("cyberpuerta.mx/Computadoras/Laptops/Laptop-Dell.html");
  });

  it("normalizes URL with http", () => {
    expect(
      normalizeProductUrl(
        "http://www.cyberpuerta.mx/Computadoras/Laptops/Laptop-Dell.html",
      ),
    ).toBe("cyberpuerta.mx/Computadoras/Laptops/Laptop-Dell.html");
  });

  it("normalizes URL with trailing slash", () => {
    expect(
      normalizeProductUrl(
        "https://www.cyberpuerta.mx/Computadoras/Laptops/Laptop-Dell.html/",
      ),
    ).toBe("cyberpuerta.mx/Computadoras/Laptops/Laptop-Dell.html");
  });

  it("normalizes URL with campaign query string (removes query string from normalized key)", () => {
    expect(
      normalizeProductUrl(
        "https://www.cyberpuerta.mx/Computadoras/Laptops/Laptop-Dell.html?utm_source=google&utm_medium=cpc",
      ),
    ).toBe("cyberpuerta.mx/Computadoras/Laptops/Laptop-Dell.html");
  });

  it("normalizes URL with uppercase in host and lowers host", () => {
    expect(
      normalizeProductUrl(
        "https://WWW.CYBERPUERTA.MX/Computadoras/Laptops/Laptop-Dell.html",
      ),
    ).toBe("cyberpuerta.mx/Computadoras/Laptops/Laptop-Dell.html");
  });

  it("normalizes URL without scheme", () => {
    expect(
      normalizeProductUrl(
        "cyberpuerta.mx/Computadoras/Laptops/Laptop-Dell.html",
      ),
    ).toBe("cyberpuerta.mx/Computadoras/Laptops/Laptop-Dell.html");
  });

  it("preserves uppercase in path (case-sensitive RFC 3986)", () => {
    const result = normalizeProductUrl(
      "https://cyberpuerta.mx/PathWithUpperCase/PROD-123.html",
    );
    expect(result).toBe("cyberpuerta.mx/PathWithUpperCase/PROD-123.html");
  });

  it("handles string without scheme or dot like 'hola'", () => {
    // new URL('https://hola') succeeds with hostname 'hola' and pathname '/'
    // path.replace(/\/+$/, "") yields "" so host+path is "hola"
    expect(normalizeProductUrl("hola")).toBe("hola");
  });

  it("returns null for empty string or invalid schemes", () => {
    expect(normalizeProductUrl("")).toBeNull();
    expect(normalizeProductUrl("   ")).toBeNull();
    expect(normalizeProductUrl("ftp://cyberpuerta.mx/prod.html")).toBeNull();
  });
});

describe("looksLikeUrl", () => {
  it("detects schemes", () => {
    expect(looksLikeUrl("https://cyberpuerta.mx")).toBe(true);
    expect(looksLikeUrl("http://foo")).toBe(true);
  });

  it("detects dot with slash", () => {
    expect(looksLikeUrl("cyberpuerta.mx/p/123")).toBe(true);
  });

  it("returns false for plain skus or text without dot and slash", () => {
    expect(looksLikeUrl("010-02551-01")).toBe(false);
    expect(looksLikeUrl("hola")).toBe(false);
  });
});

describe("tiendaNoPublicada", () => {
  it("identifies Liverpool", () => {
    expect(tiendaNoPublicada("liverpool.com.mx/tienda/pdp/algo")).toBe(
      "Liverpool",
    );
    expect(tiendaNoPublicada("www.liverpool.com.mx/algo")).toBe("Liverpool");
    // El corchete de un enlace markdown pegado por error hacía pasar este caso por accidente:
    // endsWith(".liverpool.com.mx") acierta aunque el host empiece por "[".
    expect(tiendaNoPublicada("tienda.liverpool.com.mx/algo")).toBe("Liverpool");
    expect(tiendaNoPublicada("liverpool.com.mx.attacker.test/algo")).toBeNull();
  });

  it("identifies MercadoLibre", () => {
    expect(tiendaNoPublicada("mercadolibre.com.mx/articulo/algo")).toBe(
      "MercadoLibre",
    );
    expect(tiendaNoPublicada("articulo.mercadolibre.com.mx/algo")).toBe(
      "MercadoLibre",
    );
  });

  it("identifies Innovasport", () => {
    expect(tiendaNoPublicada("innovasport.com/producto/123")).toBe(
      "Innovasport",
    );
  });

  it("returns null for Cyberpuerta and unknown stores", () => {
    expect(tiendaNoPublicada("cyberpuerta.mx/prod")).toBeNull();
    expect(tiendaNoPublicada("amazon.com.mx/dp/123")).toBeNull();
  });
});

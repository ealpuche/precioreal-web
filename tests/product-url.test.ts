import { describe, it, expect } from "vitest";
import {
  normalizeProductUrl,
  normalizePastedUrl,
  looksLikeUrl,
  tiendaNoPublicada,
  hostPertenece,
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
});

describe("normalizePastedUrl", () => {
  it("extracts the URL from text pasted from a share sheet (#42)", () => {
    // Compartir desde el navegador del teléfono pega "nombre + enlace", y a veces el enlace
    // llega en su propia línea. Antes, `new URL("https://Klip Xtreme ... https://...")`
    // lanzaba y la búsqueda terminaba en "ilegible" aunque el enlace fuera correcto.
    expect(
      normalizePastedUrl(
        "Klip Xtreme Soporte de Techo KPM-610B https://www.cyberpuerta.mx/Audio-y-Video/Soportes/KPM-610B.html",
      ),
    ).toBe("cyberpuerta.mx/Audio-y-Video/Soportes/KPM-610B.html");
    expect(
      normalizePastedUrl(
        "Mira este producto:\nhttps://www.cyberpuerta.mx/Computadoras/Laptops/Laptop-Dell.html\nen Cyberpuerta",
      ),
    ).toBe("cyberpuerta.mx/Computadoras/Laptops/Laptop-Dell.html");
  });

  it("drops punctuation that a sentence attaches to the end of a URL (#42)", () => {
    expect(
      normalizePastedUrl(
        "(https://www.cyberpuerta.mx/Computadoras/Laptops/Laptop-Dell.html).",
      ),
    ).toBe("cyberpuerta.mx/Computadoras/Laptops/Laptop-Dell.html");
  });

  it("returns null for text with spaces and no URL in it (#42)", () => {
    // Un nombre tecleado no es un enlace. Con `new URL` directo, "Monitor LG 27" lanzaba
    // (null por accidente) pero "cyberpuerta.mx/x.html Dell" pasaba con el espacio
    // codificado como %20 (CR PR #62, H3): la regla explícita cubre los dos.
    expect(normalizePastedUrl("Monitor LG 27 pulgadas")).toBeNull();
    expect(normalizePastedUrl("cyberpuerta.mx/Laptops/x.html Dell")).toBeNull();
  });

  it("drops quotes and guillemets around the link (CR PR #62, H2)", () => {
    expect(
      normalizePastedUrl(
        "Mira «https://www.cyberpuerta.mx/Computadoras/Laptops/Laptop-Dell.html»!",
      ),
    ).toBe("cyberpuerta.mx/Computadoras/Laptops/Laptop-Dell.html");
    expect(
      normalizePastedUrl(
        '"https://www.cyberpuerta.mx/Computadoras/Laptops/Laptop-Dell.html"',
      ),
    ).toBe("cyberpuerta.mx/Computadoras/Laptops/Laptop-Dell.html");
  });

  it("drops typographic quotes and WhatsApp marks (CR PR #62 ronda 2, H1)", () => {
    for (const texto of [
      "“https://www.cyberpuerta.mx/Computadoras/Laptops/Laptop-Dell.html”",
      "*https://www.cyberpuerta.mx/Computadoras/Laptops/Laptop-Dell.html*",
      "_https://www.cyberpuerta.mx/Computadoras/Laptops/Laptop-Dell.html_…",
    ]) {
      expect(normalizePastedUrl(texto)).toBe(
        "cyberpuerta.mx/Computadoras/Laptops/Laptop-Dell.html",
      );
    }
  });

  it("stays linear on a long run of trailing dots (CR PR #62 ronda 2)", () => {
    // Con `/[…]+$/` esto tardaba ~350 ms por llamada; el recorrido desde el final, ~0 ms.
    // Lo que devuelva no importa (el parser acepta un host de puntos): importa que no
    // bloquee al worker.
    const t0 = performance.now();
    normalizePastedUrl("https://" + ".".repeat(16000) + "a");
    normalizePastedUrl("https://x.html" + ".".repeat(16000));
    expect(performance.now() - t0).toBeLessThan(100);
  });

  it("keeps the canonical normalizer cheap for the index: no link extraction", () => {
    // `resolveProductUrl` llama a normalizeProductUrl 31,903 veces por búsqueda.
    expect(
      normalizeProductUrl("Mira https://www.cyberpuerta.mx/Laptops/x.html"),
    ).toBeNull();
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

  it("tells a typed name from a pasted link (#42)", () => {
    // Un nombre con espacios no es un enlace aunque lleve un punto ("27 pulg."); un dominio
    // sin ruta sí lo es, y el texto de una hoja de compartir lo es si trae un enlace dentro.
    expect(looksLikeUrl("Monitor LG 27 pulg. curvo")).toBe(false);
    expect(looksLikeUrl("cyberpuerta.mx")).toBe(true);
    expect(looksLikeUrl("www.cyberpuerta.mx")).toBe(true);
    expect(
      looksLikeUrl(
        "Mira esto https://www.cyberpuerta.mx/Laptops/Laptop-1.html",
      ),
    ).toBe(true);
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

describe("hostPertenece", () => {
  it("accepts the root domain and its subdomains", () => {
    expect(
      hostPertenece("cyberpuerta.mx/algo/producto.html", "cyberpuerta.mx"),
    ).toBe(true);
    expect(hostPertenece("cyberpuerta.mx", "cyberpuerta.mx")).toBe(true);
    expect(
      hostPertenece("m.cyberpuerta.mx/producto.html", "cyberpuerta.mx"),
    ).toBe(true);
  });

  it("rejects a lookalike domain that merely contains the name", () => {
    expect(
      hostPertenece("cyberpuerta.mx.attacker.test/x", "cyberpuerta.mx"),
    ).toBe(false);
    expect(hostPertenece("nocyberpuerta.mx/x", "cyberpuerta.mx")).toBe(false);
  });
});

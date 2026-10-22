import { describe, expect, it } from "vitest";
import type { CatalogProduct } from "../src/contracts/catalog";
import {
  buildAnchor,
  historySentences,
  formatDayYear,
  levelsFromSeries,
  recentChanges,
  verdictBadge,
} from "../src/lib/history";
import fixture from "./fixtures/kpm-610b.json";

// Ficha real publicada por el productor (feed.precioreal.mx, generated_at 2026-10-20).
// Es el primer test del repo contra la forma que emite el crawler y no contra literales
// escritos a mano (pendiente en specs/contracts/catalog.md).
const real = fixture as CatalogProduct;

function make(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    sku: "ABC-1",
    name: "Producto",
    url: "https://www.cyberpuerta.mx/x.html",
    image_url: null,
    category: null,
    site: "Cyberpuerta",
    generated_at: "2026-10-10T00:00:00Z",
    window_days: 90,
    current: {
      price: "100.00",
      since: "2026-10-01T00:00:00Z",
      available: true,
    },
    obs: 3,
    status: "ok",
    first_seen_at: "2026-09-01T00:00:00Z",
    typical_90d: "120.00",
    min_90d: "100.00",
    max_90d: "150.00",
    series: [
      ["2026-09-01T00:00:00Z", "120.00", true],
      ["2026-09-15T00:00:00Z", "150.00", true],
      ["2026-10-01T00:00:00Z", "100.00", true],
    ],
    ...overrides,
  };
}

describe("levelsFromSeries", () => {
  it("colapsa precios repetidos consecutivos (hueco de disponibilidad, no cambio)", () => {
    const levels = levelsFromSeries([
      ["2026-09-01T00:00:00Z", "100.00", true],
      ["2026-09-02T00:00:00Z", "100.00", true],
      ["2026-09-03T00:00:00Z", "90.00", true],
    ]);
    expect(levels.map((l) => l.price)).toEqual([100, 90]);
  });

  it("descarta fechas ilegibles, precios no numéricos y puntos fuera de orden", () => {
    const levels = levelsFromSeries([
      ["2026-09-05T00:00:00Z", "100.00", true],
      ["no-es-fecha", "90.00", true],
      ["2026-09-06T00:00:00Z", "abc", true],
      ["2026-09-01T00:00:00Z", "80.00", true],
      ["2026-09-07T00:00:00Z", "70.00", true],
    ]);
    expect(levels.map((l) => l.price)).toEqual([100, 70]);
  });

  it("ignora elementos que no son tuplas", () => {
    expect(
      levelsFromSeries([null as never, ["2026-09-01T00:00:00Z", "5.00", true]]),
    ).toHaveLength(1);
  });
});

describe("recentChanges", () => {
  it("devuelve los últimos cambios del más reciente al más antiguo con su diferencia", () => {
    const rows = recentChanges(real.series, 3);
    expect(rows).toEqual([
      { iso: "2026-10-20T01:14:41.283Z", price: 559, delta: -890 },
      { iso: "2026-10-19T19:16:04.860Z", price: 1449, delta: -10 },
      { iso: "2026-10-19T13:14:46.543Z", price: 1459, delta: 10 },
    ]);
  });

  it("el primer nivel de la serie no tiene diferencia", () => {
    const rows = recentChanges(make().series, 10);
    expect(rows).toHaveLength(3);
    expect(rows[2].delta).toBeNull();
  });

  it("serie vacía no produce filas", () => {
    expect(recentChanges([], 8)).toEqual([]);
  });
});

describe("historySentences", () => {
  it("cuenta el historial real del KPM-610B sin inventar datos", () => {
    expect(historySentences(real)).toEqual([
      "Lo rastreamos en Cyberpuerta desde el 20 ago 2026; desde entonces su precio cambió 36 veces.",
      "Su precio más alto en 90 días fue $1,459, el 19 oct.",
      "Su mínimo de 90 días, $559, empezó el 19 oct y es el precio de hoy.",
      "La mayor subida en un solo cambio fue el 1 oct: de $1,269 a $1,429.",
      "La mayor bajada en un solo cambio fue el 19 oct: de $1,449 a $559.",
    ]);
  });

  it("cuando el mínimo no es el precio de hoy, dice cuánto duró y cuántos días lleva el actual", () => {
    const p = make({
      current: {
        price: "130.00",
        since: "2026-10-01T00:00:00Z",
        available: true,
      },
      min_90d: "100.00",
      series: [
        ["2026-09-01T00:00:00Z", "120.00", true],
        ["2026-09-11T00:00:00Z", "100.00", true],
        ["2026-09-15T00:00:00Z", "150.00", true],
        ["2026-10-01T00:00:00Z", "130.00", true],
      ],
    });
    const s = historySentences(p);
    expect(s).toContain("Su mínimo de 90 días fue $100, el 10 sep.");
    expect(s[s.length - 1]).toBe("Lleva 9 días en $130, desde el 30 sep.");
  });

  it("separa los cambios de la ventana cuando hay historial más viejo", () => {
    const p = make({
      first_seen_at: "2026-05-01T00:00:00Z",
      series: [
        ["2026-05-01T00:00:00Z", "110.00", true],
        ["2026-06-01T00:00:00Z", "115.00", true],
        ["2026-09-01T00:00:00Z", "120.00", true],
        ["2026-09-15T00:00:00Z", "150.00", true],
        ["2026-10-01T00:00:00Z", "100.00", true],
      ],
    });
    const s = historySentences(p);
    expect(s[0]).toContain("cambió 4 veces");
    expect(s[1]).toBe("En los últimos 90 días cambió 3 veces.");
  });

  it("con insufficient_history no emite frases que dependan de estadísticas de ventana", () => {
    const p = make({
      status: "insufficient_history",
      typical_90d: undefined,
      min_90d: undefined,
      max_90d: undefined,
    });
    const s = historySentences(p);
    expect(s.join(" ")).not.toMatch(
      /mínimo|más alto|mayor subida|mayor bajada/,
    );
    expect(s[0]).toContain("Lo rastreamos en Cyberpuerta");
    expect(s[s.length - 1]).toContain("Lleva 9 días en $100");
  });

  it("omite la fecha del mínimo si la serie no contiene el número del productor", () => {
    const s = historySentences(make({ min_90d: "95.00" }));
    expect(s.join(" ")).not.toContain("mínimo");
  });

  it("usa el singular para un solo cambio y un solo día", () => {
    const p = make({
      generated_at: "2026-09-02T12:00:00Z",
      current: {
        price: "90.00",
        since: "2026-09-01T00:00:00Z",
        available: true,
      },
      min_90d: "80.00",
      max_90d: "100.00",
      series: [
        ["2026-08-31T00:00:00Z", "100.00", true],
        ["2026-09-01T00:00:00Z", "90.00", true],
      ],
    });
    const s = historySentences(p);
    expect(s[0]).toContain("cambió 1 vez");
    expect(s[s.length - 1]).toBe("Lleva 1 día en $90, desde el 31 ago.");
  });

  it("el día en que aparece el precio actual no dice 'lleva 0 días'", () => {
    const p = make({ generated_at: "2026-10-01T05:00:00Z", min_90d: "50.00" });
    const s = historySentences(p);
    expect(s[s.length - 1]).toBe("El precio actual, $100, apareció el 30 sep.");
  });

  it("serie vacía o ilegible no produce frases", () => {
    expect(historySentences(make({ series: [] }))).toEqual([]);
    expect(historySentences(make({ series: [["x", "y", true]] }))).toEqual([]);
  });

  it("sin referencia legible no produce frases", () => {
    // generated_at ilegible y una serie cuyo único punto también es ilegible.
    expect(
      historySentences(make({ generated_at: "x", series: [["x", "1", true]] })),
    ).toEqual([]);
  });
});

describe("buildAnchor", () => {
  it("por debajo del habitual: el ahorro con el mismo redondeo que el veredicto", () => {
    expect(buildAnchor(real)).toEqual({
      typical: "$1,199",
      current: "$559",
      diff: 640,
      tone: "good",
      text: "$640 menos que su precio habitual",
    });
  });

  it("por encima del habitual: la diferencia se escribe como pérdida", () => {
    const a = buildAnchor(
      make({
        current: {
          price: "150.40",
          since: "2026-10-01T00:00:00Z",
          available: true,
        },
      }),
    );
    expect(a?.tone).toBe("warn");
    expect(a?.text).toBe("Pagarías $30 de más");
  });

  it("igual al habitual tras redondear", () => {
    const a = buildAnchor(
      make({
        current: {
          price: "120.40",
          since: "2026-10-01T00:00:00Z",
          available: true,
        },
      }),
    );
    expect(a?.tone).toBe("neutral");
    expect(a?.text).toBe("Igual a su precio habitual");
  });

  it("no hay ancla sin precio vigente, sin habitual o con historial insuficiente", () => {
    expect(
      buildAnchor(
        make({
          current: {
            price: "100.00",
            since: "2026-10-01T00:00:00Z",
            available: false,
          },
        }),
      ),
    ).toBeNull();
    expect(buildAnchor(make({ typical_90d: undefined }))).toBeNull();
    expect(buildAnchor(make({ status: "insufficient_history" }))).toBeNull();
    expect(buildAnchor(make({ typical_90d: "abc" }))).toBeNull();
  });
});

describe("verdictBadge", () => {
  const at = (price: string, available = true) =>
    make({ current: { price, since: "2026-10-01T00:00:00Z", available } });

  it("mínimo de la ventana cuando el actual no supera el mínimo publicado", () => {
    expect(verdictBadge(real)).toEqual({
      label: "Mínimo de 90 días",
      tone: "good",
    });
  });

  it("debajo, arriba e igual al habitual con el mismo redondeo que el veredicto", () => {
    expect(verdictBadge(at("110.00")).label).toBe(
      "Debajo de su precio habitual",
    );
    expect(verdictBadge(at("130.00"))).toEqual({
      label: "Arriba de su precio habitual",
      tone: "warn",
    });
    expect(verdictBadge(at("120.40")).label).toBe("En su precio habitual");
  });

  it("no disponible y sin historial suficiente son neutrales", () => {
    expect(verdictBadge(at("100.00", false)).label).toBe("No disponible");
    expect(verdictBadge(make({ status: "insufficient_history" })).label).toBe(
      "Historial en construcción",
    );
  });

  it("sin mínimo publicado no afirma que sea el mínimo", () => {
    expect(verdictBadge(make({ min_90d: undefined })).label).toBe(
      "Debajo de su precio habitual",
    );
  });
});

describe("formatDayYear", () => {
  it("formatea en la zona de México, no en UTC", () => {
    // 01:14 UTC del 20 de octubre son las 19:14 del 19 en Ciudad de México.
    expect(formatDayYear(Date.parse("2026-10-20T01:14:41Z"))).toBe(
      "19 oct 2026",
    );
  });
});

describe("historySentences: regresiones de la revisión del PR #41", () => {
  it("H1: con el producto agotado no afirma un precio de hoy ni días vigente", () => {
    const p = make({
      current: {
        price: "100.00",
        since: "2026-10-01T00:00:00Z",
        available: false,
      },
    });
    const text = historySentences(p).join(" ");
    expect(text).not.toMatch(/precio de hoy|Lleva|precio actual/);
    expect(text).toContain("último precio visto");
  });

  it("no afirma cuánto duró un nivel pasado: la serie no publica los periodos sin stock", () => {
    // build_levels del productor termina un nivel en el siguiente estado de CUALQUIER tipo,
    // pero el contrato solo publica los disponibles: la distancia al siguiente punto puede
    // incluir días agotado.
    const p = make({
      current: {
        price: "130.00",
        since: "2026-10-01T00:00:00Z",
        available: true,
      },
      series: [
        ["2026-09-01T00:00:00Z", "120.00", true],
        ["2026-09-11T00:00:00Z", "100.00", true],
        ["2026-09-15T00:00:00Z", "150.00", true],
        ["2026-10-01T00:00:00Z", "130.00", true],
      ],
    });
    expect(historySentences(p).join(" ")).not.toContain("duró");
  });
});

describe("historySentences: precio vigente y agotado", () => {
  it("agotado con el mínimo como último nivel: dice 'último precio visto', no 'de hoy'", () => {
    const p = {
      ...real,
      current: { ...real.current, available: false },
    } as CatalogProduct;
    const s = historySentences(p);
    expect(s).toContain(
      "Su mínimo de 90 días, $559, empezó el 19 oct y es el último precio visto.",
    );
  });

  it("los días al precio actual cuentan desde current.since, no desde el nivel colapsado", () => {
    // Mismo precio antes y después de un hueco sin stock: la serie colapsa ambos puntos,
    // pero el estado vigente empezó en current.since.
    const p = make({
      current: {
        price: "130.00",
        since: "2026-10-08T00:00:00Z",
        available: true,
      },
      min_90d: "50.00",
      series: [
        ["2026-09-01T00:00:00Z", "120.00", true],
        ["2026-09-20T00:00:00Z", "130.00", true],
        ["2026-10-08T00:00:00Z", "130.00", true],
      ],
    });
    const s = historySentences(p);
    expect(s[s.length - 1]).toBe("Lleva 2 días en $130, desde el 7 oct.");
  });
});

describe("historySentences: regresiones de la segunda revisión del PR #41", () => {
  it("H1: agotado no repite el último precio con otra fecha (el veredicto ya lo dice)", () => {
    const p = make({
      current: {
        price: "130.00",
        since: "2026-10-05T00:00:00Z",
        available: false,
      },
      series: [
        ["2026-09-01T00:00:00Z", "120.00", true],
        ["2026-09-11T00:00:00Z", "100.00", true],
        ["2026-09-15T00:00:00Z", "150.00", true],
        ["2026-10-01T00:00:00Z", "130.00", true],
      ],
    });
    const text = historySentences(p).join(" ");
    expect(text).not.toMatch(/último precio visto|registrado el|Lleva/);
  });

  it("H2: con is_from_price el precio vigente lleva 'desde', como la grilla y el veredicto", () => {
    const p = make({
      is_from_price: true,
      min_90d: "50.00",
      current: {
        price: "100.00",
        since: "2026-10-01T00:00:00Z",
        available: true,
      },
    });
    const s = historySentences(p);
    expect(s[s.length - 1]).toBe(
      "Lleva 9 días con precio desde $100, desde el 30 sep.",
    );
  });

  it("H2: el mínimo vigente con is_from_price también lleva 'desde'", () => {
    const p = { ...real, is_from_price: true } as CatalogProduct;
    expect(historySentences(p)).toContain(
      "Su mínimo de 90 días, desde $559, empezó el 19 oct y es el precio de hoy.",
    );
  });
});

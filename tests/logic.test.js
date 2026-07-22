import { describe, it, expect } from "vitest";
import { isValidEmail, relTime, buildDeals } from "../public/js/logic.js";

describe("logic.js", () => {
  describe("isValidEmail", () => {
    it("validates correct email addresses", () => {
      expect(isValidEmail("test@example.com")).toBe(true);
      expect(isValidEmail("user.name+tag@sub.domain.org")).toBe(true);
    });

    it("rejects invalid email addresses", () => {
      expect(isValidEmail("")).toBe(false);
      expect(isValidEmail("invalid")).toBe(false);
      expect(isValidEmail("invalid@")).toBe(false);
      expect(isValidEmail("@domain.com")).toBe(false);
      expect(isValidEmail("invalid@domain")).toBe(false);
      expect(isValidEmail(null)).toBe(false);
    });

    it("handles spaces gracefully", () => {
      expect(isValidEmail("  user@domain.com  ")).toBe(true);
      expect(isValidEmail("user @domain.com")).toBe(false);
    });
  });

  describe("relTime", () => {
    const nowMs = 1700000000000;

    it("returns formatted minutes for less than 60 mins", () => {
      const past = new Date(nowMs - 12 * 60000).toISOString();
      expect(relTime(past, nowMs)).toBe("actualizado hace 12 min");
    });

    it("returns singular hour for ~60 mins", () => {
      const past = new Date(nowMs - 60 * 60000).toISOString();
      expect(relTime(past, nowMs)).toBe("actualizado hace 1 hora");
    });

    it("returns plural hours for >1 hour", () => {
      const past = new Date(nowMs - 180 * 60000).toISOString();
      expect(relTime(past, nowMs)).toBe("actualizado hace 3 horas");
    });

    it("returns empty string for null, undefined or invalid date", () => {
      expect(relTime(null, nowMs)).toBe("");
      expect(relTime(undefined, nowMs)).toBe("");
      expect(relTime("invalid-date", nowMs)).toBe("");
    });
  });

  describe("buildDeals", () => {
    const sampleDeals = [
      {
        product: "Prod A",
        store: "Cyberpuerta",
        url: "https://cyberpuerta.mx/a",
        current_price: "15999.90",
        reference_price: "20000.00",
        discount_pct: 20.0,
      },
      {
        product: "Prod B",
        store: "Liverpool",
        url: "https://liverpool.com.mx/b",
        current_price: "500.00",
        reference_price: "1000.00",
        discount_pct: 50.0,
      },
      {
        product: "Prod C",
        store: "Cyberpuerta",
        url: "https://cyberpuerta.mx/c",
        current_price: "300.00",
        reference_price: "450.00",
        discount_pct: 33.3,
      },
    ];

    it("sorts deals descending by discount_pct", () => {
      const result = buildDeals(sampleDeals, "Todas");
      expect(result.length).toBe(3);
      expect(result[0].product).toBe("Prod B"); // 50%
      expect(result[1].product).toBe("Prod C"); // 33.3%
      expect(result[2].product).toBe("Prod A"); // 20%
    });

    it("filters deals by store when filter is specified", () => {
      const result = buildDeals(sampleDeals, "Cyberpuerta");
      expect(result.length).toBe(2);
      expect(result.every((d) => d.store === "Cyberpuerta")).toBe(true);
    });

    it('passes all deals when filter is "Todas"', () => {
      const result = buildDeals(sampleDeals, "Todas");
      expect(result.length).toBe(3);
    });

    it("formats MXN prices correctly and rounds badges", () => {
      const result = buildDeals([sampleDeals[0]], "Todas");
      expect(result[0].priceNow).toMatch(/15,?999\.90/);
      expect(result[0].badge).toBe("-20%");
    });

    it("discards corrupt or incomplete entries without throwing", () => {
      const corruptDeals = [
        ...sampleDeals,
        null,
        {},
        {
          product: "No URL",
          store: "Cyberpuerta",
          current_price: "100",
          reference_price: "200",
          discount_pct: 50,
        },
        {
          product: "Bad Price",
          store: "Cyberpuerta",
          url: "https://x.com",
          current_price: "abc",
          reference_price: "200",
          discount_pct: 50,
        },
      ];
      expect(() => buildDeals(corruptDeals, "Todas")).not.toThrow();
      const result = buildDeals(corruptDeals, "Todas");
      expect(result.length).toBe(3);
    });

    it("rejects non-http(s) URLs from the feed", () => {
      const mixedDeals = [
        {
          product: "JS",
          store: "Cyberpuerta",
          url: "javascript:alert(1)",
          current_price: "100",
          reference_price: "200",
          discount_pct: 50,
        },
        {
          product: "Data",
          store: "Liverpool",
          url: "data:text/html,x",
          current_price: "100",
          reference_price: "200",
          discount_pct: 50,
        },
        {
          product: "FTP",
          store: "Cyberpuerta",
          url: "ftp://x.com/a",
          current_price: "100",
          reference_price: "200",
          discount_pct: 50,
        },
        {
          product: "Valid",
          store: "Cyberpuerta",
          url: "https://valid.com",
          current_price: "100",
          reference_price: "200",
          discount_pct: 50,
        },
        {
          product: "Padded",
          store: "Liverpool",
          url: "  https://ok.com/x  ",
          current_price: "100",
          reference_price: "200",
          discount_pct: 50,
        },
      ];

      expect(() => buildDeals(mixedDeals, "Todas")).not.toThrow();
      const result = buildDeals(mixedDeals, "Todas");
      expect(result.length).toBe(2);
      expect(result.map((d) => d.url)).toEqual([
        "https://valid.com",
        "https://ok.com/x",
      ]);
    });
  });
});

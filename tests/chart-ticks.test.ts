import { describe, it, expect } from "vitest";
import { monthTicks } from "../src/lib/chart-ticks";

const ms = (iso: string) => new Date(iso).getTime();

describe("monthTicks", () => {
  it("labels each boundary with its own month, not the previous one", () => {
    // Regresión CR PR #7 ronda final, H1: calcular la frontera en UTC y etiquetarla en CDMX
    // corría el eje entero un mes ("ago" sobre la línea de septiembre).
    const ticks = monthTicks(
      ms("2026-06-15T00:00:00Z"),
      ms("2026-09-20T00:00:00Z"),
    );
    expect(ticks.map((t) => t.label)).toEqual(["jul", "ago", "sep"]);
  });

  it("puts each tick on the first day of the month it labels", () => {
    const ticks = monthTicks(
      ms("2026-06-15T00:00:00Z"),
      ms("2026-08-20T00:00:00Z"),
    );
    for (const tick of ticks) {
      expect(new Date(tick.t).getUTCDate()).toBe(1);
    }
  });

  it("crosses a year boundary", () => {
    const ticks = monthTicks(
      ms("2026-11-10T00:00:00Z"),
      ms("2027-02-05T00:00:00Z"),
    );
    expect(ticks.map((t) => t.label)).toEqual(["dic", "ene", "feb"]);
  });

  it("returns nothing when the range spans less than one boundary", () => {
    expect(
      monthTicks(ms("2026-06-02T00:00:00Z"), ms("2026-06-28T00:00:00Z")),
    ).toEqual([]);
  });

  it("returns nothing for an inverted or empty range", () => {
    expect(
      monthTicks(ms("2026-09-01T00:00:00Z"), ms("2026-06-01T00:00:00Z")),
    ).toEqual([]);
    expect(
      monthTicks(ms("2026-06-01T00:00:00Z"), ms("2026-06-01T00:00:00Z")),
    ).toEqual([]);
  });
});

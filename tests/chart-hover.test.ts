import { describe, it, expect } from "vitest";
import { nearestPointIndex, type ChartPoint } from "../src/lib/chart-hover";

function pt(px: number): ChartPoint {
  return { px, py: 0, date: "", price: "" };
}

describe("nearestPointIndex", () => {
  it("finds the exact point when the cursor sits on it", () => {
    expect(nearestPointIndex([pt(10), pt(50), pt(90)], 50)).toBe(1);
  });

  it("picks the closer of two neighbors when the cursor is between points", () => {
    const points = [pt(10), pt(50), pt(90)];
    expect(nearestPointIndex(points, 45)).toBe(1);
    expect(nearestPointIndex(points, 15)).toBe(0);
  });

  it("clamps to the first point when the cursor is before the series", () => {
    expect(nearestPointIndex([pt(10), pt(50), pt(90)], -100)).toBe(0);
  });

  it("clamps to the last point when the cursor is after the series", () => {
    expect(nearestPointIndex([pt(10), pt(50), pt(90)], 1000)).toBe(2);
  });

  it("handles a single-point series", () => {
    expect(nearestPointIndex([pt(50)], 0)).toBe(0);
    expect(nearestPointIndex([pt(50)], 1000)).toBe(0);
  });

  it("throws on an empty series instead of returning a bogus index", () => {
    expect(() => nearestPointIndex([], 0)).toThrow();
  });
});

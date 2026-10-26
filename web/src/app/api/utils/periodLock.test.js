import { describe, it, expect } from "vitest";
import { isPeriodLocked, diffFields } from "./periodLock.js";

describe("isPeriodLocked", () => {
  it("locks documents dated on/before the lock date", () => {
    expect(isPeriodLocked("2026-05-31", "2026-05-31")).toBe(true);
    expect(isPeriodLocked("2026-04-15", "2026-05-31")).toBe(true);
  });
  it("allows documents after the lock date", () => {
    expect(isPeriodLocked("2026-06-01", "2026-05-31")).toBe(false);
  });
  it("no lock set => never locked", () => {
    expect(isPeriodLocked("2020-01-01", null)).toBe(false);
    expect(isPeriodLocked("2020-01-01", "")).toBe(false);
  });
  it("missing doc date => not locked", () => {
    expect(isPeriodLocked(null, "2026-05-31")).toBe(false);
  });
});

describe("diffFields", () => {
  it("returns only changed fields with [old, new]", () => {
    expect(diffFields({ a: 1, b: "x" }, { a: 2, b: "x" })).toEqual({ a: [1, 2] });
  });
  it("treats numeric/string equality loosely", () => {
    expect(diffFields({ amount: 100 }, { amount: "100" })).toEqual({});
  });
  it("captures added/removed (null) values", () => {
    expect(diffFields({ note: null }, { note: "hi" })).toEqual({ note: [null, "hi"] });
  });
  it("respects an explicit key list", () => {
    expect(diffFields({ a: 1, b: 1 }, { a: 2, b: 2 }, ["a"])).toEqual({ a: [1, 2] });
  });
});

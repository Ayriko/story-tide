import { describe, expect, it } from "vitest";
import {
  brightnessTier,
  isBrightnessTier,
  neighbourCounts,
  STAR_TIERS,
  TIER_MIN_NEIGHBOURS,
} from "./star-brightness";

describe("brightnessTier", () => {
  it("entree isolee : palier 0", () => {
    expect(brightnessTier(0)).toBe(0);
    expect(brightnessTier(-1)).toBe(0);
    expect(brightnessTier(Number.NaN)).toBe(0);
  });

  it.each([
    [1, 1],
    [4, 1],
    [5, 2],
    [11, 2],
    [12, 3],
    [30, 3],
    [500, 3],
  ])("%i voisins -> palier %i", (count, tier) => {
    expect(brightnessTier(count)).toBe(tier);
  });

  it("monotone : plus de voisins ne fait jamais baisser le palier", () => {
    let previous = 0;
    for (let count = 0; count <= 200; count += 1) {
      const tier = brightnessTier(count);
      expect(tier).toBeGreaterThanOrEqual(previous);
      previous = tier;
    }
  });

  it("bornes en progression geometrique, 30 liens plafonnes au dernier palier", () => {
    expect(TIER_MIN_NEIGHBOURS[3] / TIER_MIN_NEIGHBOURS[2]).toBeGreaterThan(2);
    expect(TIER_MIN_NEIGHBOURS[2] / TIER_MIN_NEIGHBOURS[1]).toBeGreaterThan(2);
    expect(STAR_TIERS[brightnessTier(30)].size).toBe(STAR_TIERS[3].size);
    expect(STAR_TIERS[3].size / STAR_TIERS[1].size).toBeLessThan(2);
  });
});

describe("STAR_TIERS", () => {
  it("taille, halo et intensite croissent avec le palier", () => {
    const tiers = [STAR_TIERS[0], STAR_TIERS[1], STAR_TIERS[2], STAR_TIERS[3]];
    for (let i = 1; i < tiers.length; i += 1) {
      expect(tiers[i]?.size).toBeGreaterThan(tiers[i - 1]?.size ?? Infinity);
      expect(tiers[i]?.haloPadding).toBeGreaterThan(tiers[i - 1]?.haloPadding ?? Infinity);
      expect(tiers[i]?.haloShare).toBeGreaterThan(tiers[i - 1]?.haloShare ?? Infinity);
    }
    expect(STAR_TIERS[3].haloShare).toBe(1);
  });
});

describe("neighbourCounts", () => {
  it("compte les voisins distincts, dans les deux sens, sans boucle", () => {
    const counts = neighbourCounts([
      { source: "a", target: "b" },
      { source: "b", target: "a" },
      { source: "a", target: "c" },
      { source: "d", target: "d" },
    ]);
    expect(counts.get("a")).toBe(2);
    expect(counts.get("b")).toBe(1);
    expect(counts.get("c")).toBe(1);
    expect(counts.has("d")).toBe(false);
  });
});

describe("isBrightnessTier", () => {
  it("n'accepte que 0 a 3", () => {
    expect([0, 1, 2, 3].every(isBrightnessTier)).toBe(true);
    expect([4, -1, "1", undefined].some(isBrightnessTier)).toBe(false);
  });
});

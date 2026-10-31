import { describe, expect, it } from "vitest";
import type { BrightnessTier } from "./star-brightness";
import {
  DENSE_EDGE_LIMIT,
  edgeLabelsFollowZoom,
  isNameVisible,
  minNamedTier,
  relativeZoom,
  SMALL_WORLD_STARS,
} from "./sky-detail";

describe("relativeZoom", () => {
  it("rapport au zoom « ajuster »", () => {
    expect(relativeZoom(0.6, 0.3)).toBe(2);
    expect(relativeZoom(0.3, 0.3)).toBe(1);
  });

  it("valeurs absurdes : zoom relatif neutre (1)", () => {
    expect(relativeZoom(1, 0)).toBe(1);
    expect(relativeZoom(1, -2)).toBe(1);
    expect(relativeZoom(Number.NaN, 1)).toBe(1);
    expect(relativeZoom(1, Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe("minNamedTier", () => {
  it.each([
    [0.5, 3],
    [1, 3],
    [1.39, 3],
    [1.4, 2],
    [1.99, 2],
    [2, 1],
    [2.8, 0],
    [10, 0],
  ])("zoom relatif %s : paliers nommes a partir de %i", (rel, tier) => {
    expect(minNamedTier(rel)).toBe(tier);
  });

  it("monotone : zoomer ne retire jamais un nom", () => {
    let previous = 3;
    for (let rel = 0.2; rel <= 5; rel += 0.05) {
      const tier = minNamedTier(rel);
      expect(tier).toBeLessThanOrEqual(previous);
      previous = tier;
    }
  });
});

describe("isNameVisible", () => {
  const big = SMALL_WORLD_STARS + 1;

  it("vue d'ensemble d'un grand monde : seul le palier le plus brillant est nomme", () => {
    expect(isNameVisible(3, 1, big)).toBe(true);
    expect(isNameVisible(2, 1, big)).toBe(false);
    expect(isNameVisible(0, 1, big)).toBe(false);
  });

  it("en zoomant, les paliers apparaissent un par un", () => {
    const tiers: BrightnessTier[] = [3, 2, 1, 0];
    expect(tiers.map((tier) => isNameVisible(tier, 1.5, big))).toEqual([true, true, false, false]);
    expect(isNameVisible(1, 2.1, big)).toBe(true);
    expect(isNameVisible(0, 3, big)).toBe(true);
  });

  it("petit monde : tous les noms, meme dezoome", () => {
    expect(isNameVisible(0, 0.5, SMALL_WORLD_STARS)).toBe(true);
    expect(isNameVisible(0, 0.5, 3)).toBe(true);
  });
});

describe("edgeLabelsFollowZoom", () => {
  it("seuil de zoom des libelles seulement si peu de lignes visibles", () => {
    expect(edgeLabelsFollowZoom(0)).toBe(true);
    expect(edgeLabelsFollowZoom(DENSE_EDGE_LIMIT)).toBe(true);
    expect(edgeLabelsFollowZoom(DENSE_EDGE_LIMIT + 1)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import type { Match } from "./aho-corasick";
import { resolveLinks } from "./resolve-links";

function makeMatch(overrides: Partial<Match> = {}): Match {
  return { entityId: "e1", term: "Aeliana", start: 0, end: 7, ...overrides };
}

describe("resolveLinks", () => {
  it("retourne un ensemble vide sans match", () => {
    const result = resolveLinks([], { selfEntityId: "src1", ignoredTargetIds: new Set() });

    expect(result.targetIds).toEqual(new Set());
    expect(result.occurrences).toEqual([]);
  });

  it("retient une occurrence valide (une seule entite sur ces bornes)", () => {
    const matches = [makeMatch({ entityId: "e1", start: 3, end: 10 })];

    const result = resolveLinks(matches, { selfEntityId: "src1", ignoredTargetIds: new Set() });

    expect(result.targetIds).toEqual(new Set(["e1"]));
    expect(result.occurrences).toEqual([{ targetId: "e1", start: 3, end: 10 }]);
  });

  it("occurrence ambigue (deux entites sur les memes bornes) : aucune cible, aucune occurrence", () => {
    const matches = [
      makeMatch({ entityId: "e1", start: 3, end: 10 }),
      makeMatch({ entityId: "e2", start: 3, end: 10 }),
    ];

    const result = resolveLinks(matches, { selfEntityId: "src1", ignoredTargetIds: new Set() });

    expect(result.targetIds).toEqual(new Set());
    expect(result.occurrences).toEqual([]);
  });

  it("exclut l'auto-mention (targetId === selfEntityId)", () => {
    const matches = [makeMatch({ entityId: "src1", start: 0, end: 5 })];

    const result = resolveLinks(matches, { selfEntityId: "src1", ignoredTargetIds: new Set() });

    expect(result.targetIds).toEqual(new Set());
    expect(result.occurrences).toEqual([]);
  });

  it("respecte les cibles ignorees (LinkIgnore)", () => {
    const matches = [makeMatch({ entityId: "e1", start: 0, end: 5 })];

    const result = resolveLinks(matches, {
      selfEntityId: "src1",
      ignoredTargetIds: new Set(["e1"]),
    });

    expect(result.targetIds).toEqual(new Set());
    expect(result.occurrences).toEqual([]);
  });

  it("deduplique targetIds mais conserve une occurrence par mention distincte", () => {
    const matches = [
      makeMatch({ entityId: "e1", start: 0, end: 5 }),
      makeMatch({ entityId: "e1", start: 20, end: 25 }),
    ];

    const result = resolveLinks(matches, { selfEntityId: "src1", ignoredTargetIds: new Set() });

    expect(result.targetIds).toEqual(new Set(["e1"]));
    expect(result.occurrences).toEqual([
      { targetId: "e1", start: 0, end: 5 },
      { targetId: "e1", start: 20, end: 25 },
    ]);
  });

  it("garde les occurrences valides meme quand une autre occurrence du meme scan est ambigue", () => {
    const matches = [
      makeMatch({ entityId: "e1", start: 0, end: 5 }), // valide
      makeMatch({ entityId: "e2", start: 20, end: 25 }), // ambigue
      makeMatch({ entityId: "e3", start: 20, end: 25 }), // ambigue (memes bornes que e2)
    ];

    const result = resolveLinks(matches, { selfEntityId: "src1", ignoredTargetIds: new Set() });

    expect(result.targetIds).toEqual(new Set(["e1"]));
    expect(result.occurrences).toEqual([{ targetId: "e1", start: 0, end: 5 }]);
  });
});

import { describe, expect, it } from "vitest";
import { RelationOrigin } from "@/generated/prisma/client";
import { buildAccessibleGraphEntries, buildGraphElements } from "./graph-elements";

describe("buildGraphElements", () => {
  it("retourne des tableaux vides sans entite ni relation", () => {
    expect(buildGraphElements([], [])).toEqual({ nodes: [], edges: [] });
  });

  it("convertit chaque entite en node avec id/label/type", () => {
    const result = buildGraphElements(
      [
        { id: "e1", name: "Aeliana", type: "character" },
        { id: "e2", name: "Valombre", type: "place" },
      ],
      [],
    );

    expect(result.nodes).toEqual([
      { data: { id: "e1", label: "Aeliana", type: "character" } },
      { data: { id: "e2", label: "Valombre", type: "place" } },
    ]);
  });

  it("convertit chaque relation en arete avec source/target/origin", () => {
    const result = buildGraphElements(
      [
        { id: "e1", name: "Aeliana", type: "character" },
        { id: "e2", name: "Valombre", type: "place" },
      ],
      [{ sourceId: "e1", targetId: "e2", origin: RelationOrigin.AUTO }],
    );

    expect(result.edges).toEqual([
      {
        data: { id: "e1->e2:AUTO", source: "e1", target: "e2", origin: RelationOrigin.AUTO },
      },
    ]);
  });

  it("distingue une arete AUTO et une arete MANUAL pour le meme couple (id different)", () => {
    const result = buildGraphElements(
      [
        { id: "e1", name: "Aeliana", type: "character" },
        { id: "e2", name: "Valombre", type: "place" },
      ],
      [
        { sourceId: "e1", targetId: "e2", origin: RelationOrigin.AUTO },
        { sourceId: "e1", targetId: "e2", origin: RelationOrigin.MANUAL },
      ],
    );

    expect(result.edges).toHaveLength(2);
    expect(result.edges.map((edge) => edge.data.id)).toEqual(["e1->e2:AUTO", "e1->e2:MANUAL"]);
  });

  it("omet silencieusement une arete dont une extremite n'est plus dans la liste d'entites", () => {
    const result = buildGraphElements(
      [{ id: "e1", name: "Aeliana", type: "character" }],
      [{ sourceId: "e1", targetId: "e2-supprime", origin: RelationOrigin.AUTO }],
    );

    expect(result.edges).toEqual([]);
  });
});

describe("buildAccessibleGraphEntries", () => {
  const ENTITIES = [
    { id: "e1", name: "Aeliana", type: "character" },
    { id: "e2", name: "Valombre", type: "place" },
    { id: "e3", name: "Robert", type: "character" },
  ];

  it("retourne un tableau vide sans entite ni relation", () => {
    expect(buildAccessibleGraphEntries([], [])).toEqual([]);
  });

  it("regroupe les relations sortantes par entite source, triees par nom", () => {
    const result = buildAccessibleGraphEntries(ENTITIES, [
      { sourceId: "e1", targetId: "e2", origin: RelationOrigin.AUTO },
      { sourceId: "e1", targetId: "e3", origin: RelationOrigin.MANUAL },
    ]);

    expect(result).toEqual([
      {
        id: "e1",
        name: "Aeliana",
        outgoing: [
          { id: "e3", name: "Robert", mutual: false },
          { id: "e2", name: "Valombre", mutual: false },
        ],
      },
    ]);
  });

  it("dedoublonne une meme cible relee par AUTO et MANUAL (meme sens)", () => {
    const result = buildAccessibleGraphEntries(ENTITIES, [
      { sourceId: "e1", targetId: "e2", origin: RelationOrigin.AUTO },
      { sourceId: "e1", targetId: "e2", origin: RelationOrigin.MANUAL },
    ]);

    expect(result).toEqual([
      { id: "e1", name: "Aeliana", outgoing: [{ id: "e2", name: "Valombre", mutual: false }] },
    ]);
  });

  it("ne liste qu'une seule fois une paire qui se mentionne mutuellement (A->B et B->A)", () => {
    const result = buildAccessibleGraphEntries(ENTITIES, [
      { sourceId: "e1", targetId: "e3", origin: RelationOrigin.MANUAL },
      { sourceId: "e3", targetId: "e1", origin: RelationOrigin.MANUAL },
    ]);

    // "Aeliana" < "Robert" alphabetiquement - la paire est rangee sous
    // Aeliana (proprietaire canonique), jamais sous les deux.
    expect(result).toEqual([
      { id: "e1", name: "Aeliana", outgoing: [{ id: "e3", name: "Robert", mutual: true }] },
    ]);
  });

  it("depuis le nom a egalite, departage par id (deterministe) - paire mutuelle jamais dupliquee", () => {
    const sameNameEntities = [
      { id: "e1", name: "Homonyme", type: "character" },
      { id: "e2", name: "Homonyme", type: "character" },
    ];
    const result = buildAccessibleGraphEntries(sameNameEntities, [
      { sourceId: "e1", targetId: "e2", origin: RelationOrigin.MANUAL },
      { sourceId: "e2", targetId: "e1", origin: RelationOrigin.MANUAL },
    ]);

    // "e1" < "e2" - departage par id puisque les noms sont identiques.
    expect(result).toEqual([
      { id: "e1", name: "Homonyme", outgoing: [{ id: "e2", name: "Homonyme", mutual: true }] },
    ]);
  });

  it("n'inclut pas une entite sans relation sortante (reste atteignable comme cible)", () => {
    const result = buildAccessibleGraphEntries(ENTITIES, [
      { sourceId: "e1", targetId: "e2", origin: RelationOrigin.AUTO },
    ]);

    expect(result.map((entry) => entry.id)).toEqual(["e1"]);
  });

  it("omet silencieusement une relation dont une extremite n'est plus dans la liste d'entites", () => {
    const result = buildAccessibleGraphEntries(ENTITIES, [
      { sourceId: "e1", targetId: "e2-supprime", origin: RelationOrigin.AUTO },
    ]);

    expect(result).toEqual([]);
  });

  it("trie les entrees elles-memes par nom", () => {
    const result = buildAccessibleGraphEntries(ENTITIES, [
      { sourceId: "e3", targetId: "e1", origin: RelationOrigin.AUTO },
      { sourceId: "e1", targetId: "e2", origin: RelationOrigin.AUTO },
    ]);

    expect(result.map((entry) => entry.name)).toEqual(["Aeliana", "Robert"]);
  });
});

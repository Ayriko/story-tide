import { describe, expect, it } from "vitest";
import { RelationOrigin } from "@/generated/prisma/client";
import { buildAccessibleGraphEntries, buildGraphElements } from "./graph-elements";

describe("buildGraphElements", () => {
  it("retourne des tableaux vides sans entite ni relation", () => {
    expect(buildGraphElements([], [])).toEqual({ nodes: [], edges: [] });
  });

  it("convertit chaque entite en node avec id/label/typeKey/group", () => {
    const result = buildGraphElements(
      [
        {
          id: "e1",
          name: "Aeliana",
          typeKey: "character",
          typeLabel: "Personnage",
          group: "Personnages",
        },
        { id: "e2", name: "Valombre", typeKey: "place", typeLabel: "Lieu", group: "Lieux" },
      ],
      [],
    );

    expect(result.nodes).toEqual([
      { data: { id: "e1", label: "Aeliana", typeKey: "character", group: "Personnages" } },
      { data: { id: "e2", label: "Valombre", typeKey: "place", group: "Lieux" } },
    ]);
  });

  it("convertit chaque relation en arete avec source/target/origin", () => {
    const result = buildGraphElements(
      [
        {
          id: "e1",
          name: "Aeliana",
          typeKey: "character",
          typeLabel: "Personnage",
          group: "Personnages",
        },
        { id: "e2", name: "Valombre", typeKey: "place", typeLabel: "Lieu", group: "Lieux" },
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
        {
          id: "e1",
          name: "Aeliana",
          typeKey: "character",
          typeLabel: "Personnage",
          group: "Personnages",
        },
        { id: "e2", name: "Valombre", typeKey: "place", typeLabel: "Lieu", group: "Lieux" },
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
      [
        {
          id: "e1",
          name: "Aeliana",
          typeKey: "character",
          typeLabel: "Personnage",
          group: "Personnages",
        },
      ],
      [{ sourceId: "e1", targetId: "e2-supprime", origin: RelationOrigin.AUTO }],
    );

    expect(result.edges).toEqual([]);
  });
});

describe("buildAccessibleGraphEntries", () => {
  const ENTITIES = [
    {
      id: "e1",
      name: "Aeliana",
      typeKey: "character",
      typeLabel: "Personnage",
      group: "Personnages",
    },
    { id: "e2", name: "Valombre", typeKey: "place", typeLabel: "Lieu", group: "Lieux" },
    {
      id: "e3",
      name: "Robert",
      typeKey: "character",
      typeLabel: "Personnage",
      group: "Personnages",
    },
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
        typeLabel: "Personnage",
        outgoing: [
          { id: "e3", name: "Robert", typeLabel: "Personnage", mutual: false },
          { id: "e2", name: "Valombre", typeLabel: "Lieu", mutual: false },
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
      {
        id: "e1",
        name: "Aeliana",
        typeLabel: "Personnage",
        outgoing: [{ id: "e2", name: "Valombre", typeLabel: "Lieu", mutual: false }],
      },
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
      {
        id: "e1",
        name: "Aeliana",
        typeLabel: "Personnage",
        outgoing: [{ id: "e3", name: "Robert", typeLabel: "Personnage", mutual: true }],
      },
    ]);
  });

  it("depuis le nom a egalite, departage par id (deterministe) - paire mutuelle jamais dupliquee", () => {
    const sameNameEntities = [
      {
        id: "e1",
        name: "Homonyme",
        typeKey: "character",
        typeLabel: "Personnage",
        group: "Personnages",
      },
      {
        id: "e2",
        name: "Homonyme",
        typeKey: "character",
        typeLabel: "Personnage",
        group: "Personnages",
      },
    ];
    const result = buildAccessibleGraphEntries(sameNameEntities, [
      { sourceId: "e1", targetId: "e2", origin: RelationOrigin.MANUAL },
      { sourceId: "e2", targetId: "e1", origin: RelationOrigin.MANUAL },
    ]);

    // "e1" < "e2" - departage par id puisque les noms sont identiques.
    expect(result).toEqual([
      {
        id: "e1",
        name: "Homonyme",
        typeLabel: "Personnage",
        outgoing: [{ id: "e2", name: "Homonyme", typeLabel: "Personnage", mutual: true }],
      },
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

// KAN-81 : le type est resolu par l'appelant - un type personnalise arrive
// avec sa cle `custom:<id>` et son groupe, recopies tels quels.
describe("buildGraphElements - type personnalise (KAN-81)", () => {
  it("porte la cle custom:<id> et le groupe resolus dans les donnees du noeud", () => {
    const { nodes } = buildGraphElements(
      [
        {
          id: "e1",
          name: "Aube Grise",
          typeKey: "custom:ct1",
          typeLabel: "Vaisseau",
          group: "Objets",
        },
      ],
      [],
    );
    expect(nodes).toEqual([
      { data: { id: "e1", label: "Aube Grise", typeKey: "custom:ct1", group: "Objets" } },
    ]);
  });
});

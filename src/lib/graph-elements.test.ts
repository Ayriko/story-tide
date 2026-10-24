import { describe, expect, it } from "vitest";
import { RelationOrigin } from "@/generated/prisma/client";
import { buildAccessibleGraphEntries, buildGraphElements, pairEdgeId } from "./graph-elements";

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

  it("convertit une relation en arete texte flechee dans son sens (KAN-84)", () => {
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
        data: {
          id: "pair:e1~e2",
          source: "e1",
          target: "e2",
          kind: "text",
          arrow: true,
          label: "",
          relationTypes: [],
        },
      },
    ]);
  });

  it("ne trace qu'une arete texte pour une paire a la fois AUTO et MANUAL (KAN-84)", () => {
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

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]?.data).toMatchObject({ id: "pair:e1~e2", kind: "text", arrow: true });
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
          { id: "e3", name: "Robert", typeLabel: "Personnage", mutual: false, relationLabel: "" },
          { id: "e2", name: "Valombre", typeLabel: "Lieu", mutual: false, relationLabel: "" },
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
        outgoing: [
          { id: "e2", name: "Valombre", typeLabel: "Lieu", mutual: false, relationLabel: "" },
        ],
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
        outgoing: [
          { id: "e3", name: "Robert", typeLabel: "Personnage", mutual: true, relationLabel: "" },
        ],
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
        outgoing: [
          { id: "e2", name: "Homonyme", typeLabel: "Personnage", mutual: true, relationLabel: "" },
        ],
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

// KAN-84 : une arete par paire non ordonnee ; une relation declaree masque
// les reflets du texte de la paire ; fleche seulement si un sens unique.
describe("buildGraphElements - relations declarees (KAN-84)", () => {
  const SELYNE = {
    id: "a-selyne",
    name: "Selyne",
    typeKey: "character",
    typeLabel: "Personnage",
    group: "Personnages",
  };
  const ALDRIC = {
    id: "b-aldric",
    name: "Aldric",
    typeKey: "character",
    typeLabel: "Personnage",
    group: "Personnages",
  };
  const PARENT = {
    key: "parent",
    label: "Parent de",
    inverseLabel: "Enfant de",
    symmetric: false,
    isCustom: false,
    isHidden: false,
  };
  const MENTOR = { ...PARENT, key: "mentor", label: "Mentor de", inverseLabel: "Élève de" };
  const ALLY = {
    key: "ally",
    label: "Allié",
    inverseLabel: null,
    symmetric: true,
    isCustom: false,
    isHidden: false,
  };

  it("paire AUTO + declaree = une seule arete declaree, trait libelle depuis la source", () => {
    const { edges } = buildGraphElements(
      [SELYNE, ALDRIC],
      [{ sourceId: ALDRIC.id, targetId: SELYNE.id, origin: RelationOrigin.AUTO }],
      [{ sourceId: SELYNE.id, targetId: ALDRIC.id, relationType: PARENT }],
    );

    expect(edges).toEqual([
      {
        data: {
          id: "pair:a-selyne~b-aldric",
          source: SELYNE.id,
          target: ALDRIC.id,
          kind: "declared",
          arrow: true,
          label: "Parent de",
          relationTypes: [
            {
              key: "parent",
              label: "Parent de",
              inverseLabel: "Enfant de",
              symmetric: false,
              sourceId: SELYNE.id,
            },
          ],
        },
      },
    ]);
  });

  it("deux types declares sur la paire = une arete, libelles joints par « · »", () => {
    const { edges } = buildGraphElements(
      [SELYNE, ALDRIC],
      [],
      [
        { sourceId: SELYNE.id, targetId: ALDRIC.id, relationType: PARENT },
        { sourceId: SELYNE.id, targetId: ALDRIC.id, relationType: MENTOR },
      ],
    );

    expect(edges).toHaveLength(1);
    expect(edges[0]?.data).toMatchObject({ arrow: true, label: "Parent de · Mentor de" });
  });

  it("sens opposes : pas de fleche, libelles lus depuis la source de l'arete (plus petit id)", () => {
    const { edges } = buildGraphElements(
      [SELYNE, ALDRIC],
      [],
      [
        { sourceId: SELYNE.id, targetId: ALDRIC.id, relationType: PARENT },
        { sourceId: ALDRIC.id, targetId: SELYNE.id, relationType: MENTOR },
      ],
    );

    expect(edges[0]?.data).toMatchObject({
      source: SELYNE.id,
      arrow: false,
      label: "Parent de · Élève de",
    });
  });

  it("une symetrique ne donne aucun sens : fleche portee par la seule dirigee", () => {
    const { edges } = buildGraphElements(
      [SELYNE, ALDRIC],
      [],
      [
        { sourceId: SELYNE.id, targetId: ALDRIC.id, relationType: ALLY },
        { sourceId: ALDRIC.id, targetId: SELYNE.id, relationType: MENTOR },
      ],
    );

    expect(edges[0]?.data).toMatchObject({
      source: ALDRIC.id,
      target: SELYNE.id,
      arrow: true,
      label: "Allié · Mentor de",
    });
  });

  it("symetrique seule : pas de fleche", () => {
    const { edges } = buildGraphElements(
      [SELYNE, ALDRIC],
      [],
      [{ sourceId: SELYNE.id, targetId: ALDRIC.id, relationType: ALLY }],
    );

    expect(edges[0]?.data).toMatchObject({ kind: "declared", arrow: false, label: "Allié" });
  });

  it("mentions mutuelles : une arete texte sans fleche", () => {
    const { edges } = buildGraphElements(
      [SELYNE, ALDRIC],
      [
        { sourceId: SELYNE.id, targetId: ALDRIC.id, origin: RelationOrigin.MANUAL },
        { sourceId: ALDRIC.id, targetId: SELYNE.id, origin: RelationOrigin.AUTO },
      ],
    );

    expect(edges).toHaveLength(1);
    expect(edges[0]?.data).toMatchObject({ kind: "text", arrow: false, label: "" });
  });

  it("liste accessible : une entree par paire, libelle declare lu depuis la source", () => {
    const entries = buildAccessibleGraphEntries(
      [SELYNE, ALDRIC],
      [{ sourceId: ALDRIC.id, targetId: SELYNE.id, origin: RelationOrigin.AUTO }],
      [{ sourceId: SELYNE.id, targetId: ALDRIC.id, relationType: PARENT }],
    );

    expect(entries).toEqual([
      {
        id: SELYNE.id,
        name: "Selyne",
        typeLabel: "Personnage",
        outgoing: [
          {
            id: ALDRIC.id,
            name: "Aldric",
            typeLabel: "Personnage",
            mutual: false,
            relationLabel: "Parent de",
          },
        ],
      },
    ]);
  });

  it("liste accessible : paire sans sens unique rangee sous le premier nom, lue depuis lui", () => {
    const entries = buildAccessibleGraphEntries(
      [SELYNE, ALDRIC],
      [],
      [{ sourceId: SELYNE.id, targetId: ALDRIC.id, relationType: ALLY }],
    );

    // « Aldric » < « Selyne » : proprietaire canonique Aldric.
    expect(entries.map((entry) => entry.id)).toEqual([ALDRIC.id]);
    expect(entries[0]?.outgoing).toEqual([
      {
        id: SELYNE.id,
        name: "Selyne",
        typeLabel: "Personnage",
        mutual: true,
        relationLabel: "Allié",
      },
    ]);
  });
});

describe("pairEdgeId", () => {
  it("meme id quel que soit l'ordre des extremites (KAN-87)", () => {
    expect(pairEdgeId("b", "a")).toBe("pair:a~b");
    expect(pairEdgeId("a", "b")).toBe("pair:a~b");
  });
});

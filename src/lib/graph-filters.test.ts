import { describe, expect, it } from "vitest";
import type { GraphEdgeElement, GraphElements, GraphNodeElement } from "./graph-elements";
import {
  DEFAULT_GRAPH_FILTERS,
  computeVisibility,
  depthLabel,
  entryTypeFilterGroups,
  graphFiltersStorageKey,
  hasActiveFilters,
  parseStoredFilters,
  relationFilterOptions,
  type GraphFilters,
} from "./graph-filters";

function node(id: string, typeKey = "character"): GraphNodeElement {
  return { data: { id, label: id, typeKey, group: "Personnages" } };
}

function relationType(key: string, label: string) {
  return { key, label, inverseLabel: null, symmetric: true, sourceId: "x" };
}

function edge(source: string, target: string, typeKeys: string[] = []): GraphEdgeElement {
  const [a, b] = source < target ? [source, target] : [target, source];
  return {
    data: {
      id: `pair:${a}~${b}`,
      source,
      target,
      kind: typeKeys.length > 0 ? "declared" : "text",
      arrow: false,
      label: "",
      relationTypes: typeKeys.map((key) => relationType(key, key === "family" ? "Famille" : key)),
    },
  };
}

// Chaine selyne -famille- aldric -famille- mira -texte- port (lieu),
// plus selyne -allie- kael. Pas de cycle : les distances sont nettes.
const ELEMENTS: GraphElements = {
  nodes: [node("selyne"), node("aldric"), node("mira"), node("port", "place"), node("kael")],
  edges: [
    edge("selyne", "aldric", ["family"]),
    edge("aldric", "mira", ["family", "mentor"]),
    edge("mira", "port"),
    edge("selyne", "kael", ["ally"]),
  ],
};

function filters(overrides: Partial<GraphFilters>): GraphFilters {
  return { ...DEFAULT_GRAPH_FILTERS, ...overrides };
}

function visibleNodes(value: GraphFilters): string[] {
  return [...computeVisibility(ELEMENTS, value).nodeIds].sort();
}

describe("computeVisibility", () => {
  it("aucun filtre : tout est visible, focus « none »", () => {
    const visibility = computeVisibility(ELEMENTS, DEFAULT_GRAPH_FILTERS);

    expect(visibility.nodeIds.size).toBe(5);
    expect(visibility.edgeIds.size).toBe(4);
    expect(visibility.focusStatus).toBe("none");
  });

  it("type d'entree masque : ses etoiles et leurs aretes disparaissent", () => {
    const visibility = computeVisibility(ELEMENTS, filters({ hiddenTypeKeys: ["place"] }));

    expect(visibility.nodeIds.has("port")).toBe(false);
    expect(visibility.edgeIds.has("pair:mira~port")).toBe(false);
    expect(visibility.edgeIds.size).toBe(3);
  });

  it("« Liens du texte » masque : les aretes texte disparaissent, pas les etoiles", () => {
    const visibility = computeVisibility(ELEMENTS, filters({ hiddenRelationKeys: ["text"] }));

    expect(visibility.edgeIds.has("pair:mira~port")).toBe(false);
    expect(visibility.nodeIds.has("port")).toBe(true);
  });

  it("arete a plusieurs types : visible tant qu'au moins un de ses types l'est", () => {
    const familyHidden = computeVisibility(ELEMENTS, filters({ hiddenRelationKeys: ["family"] }));
    const bothHidden = computeVisibility(
      ELEMENTS,
      filters({ hiddenRelationKeys: ["family", "mentor"] }),
    );

    expect(familyHidden.edgeIds.has("pair:aldric~mira")).toBe(true);
    expect(familyHidden.edgeIds.has("pair:aldric~selyne")).toBe(false);
    expect(bothHidden.edgeIds.has("pair:aldric~mira")).toBe(false);
  });

  it.each([
    [1, ["aldric", "kael", "selyne"]],
    [2, ["aldric", "kael", "mira", "selyne"]],
    ["all", ["aldric", "kael", "mira", "port", "selyne"]],
  ] as const)("isoler selyne a %s saut(s)", (depth, expected) => {
    expect(
      visibleNodes(filters({ focus: { mode: "isolate", entityId: "selyne", depth } })),
    ).toEqual(expected);
  });

  it.each([
    [1, ["mira", "port"]],
    [2, ["port"]],
    ["all", []],
  ] as const)("masquer selyne a %s saut(s)", (depth, expected) => {
    expect(visibleNodes(filters({ focus: { mode: "hide", entityId: "selyne", depth } }))).toEqual(
      expected,
    );
  });

  it("isoler sur les seules relations « Famille » a 3 sauts : le parcours suit les aretes filtrees", () => {
    const visibility = computeVisibility(
      ELEMENTS,
      filters({
        hiddenRelationKeys: ["ally", "mentor", "text"],
        focus: { mode: "isolate", entityId: "selyne", depth: 3 },
      }),
    );

    expect([...visibility.nodeIds].sort()).toEqual(["aldric", "mira", "selyne"]);
    expect([...visibility.edgeIds].sort()).toEqual(["pair:aldric~mira", "pair:aldric~selyne"]);
    expect(visibility.focusStatus).toBe("active");
  });

  it("isoler : seules les aretes entre etoiles retenues restent", () => {
    const visibility = computeVisibility(
      ELEMENTS,
      filters({ focus: { mode: "isolate", entityId: "selyne", depth: 1 } }),
    );

    expect([...visibility.edgeIds].sort()).toEqual(["pair:aldric~selyne", "pair:kael~selyne"]);
  });

  it("entree isolee disparue : focus ignore, filtres de types toujours appliques", () => {
    const visibility = computeVisibility(
      ELEMENTS,
      filters({
        hiddenTypeKeys: ["place"],
        focus: { mode: "isolate", entityId: "supprimee", depth: 1 },
      }),
    );

    expect(visibility.focusStatus).toBe("ignored");
    expect(visibility.nodeIds.size).toBe(4);
  });

  it("entree isolee masquee par son type : focus ignore", () => {
    const visibility = computeVisibility(
      ELEMENTS,
      filters({
        hiddenTypeKeys: ["place"],
        focus: { mode: "isolate", entityId: "port", depth: 1 },
      }),
    );

    expect(visibility.focusStatus).toBe("ignored");
  });
});

describe("relationFilterOptions", () => {
  it("types declares presents, tries par libelle, puis « Liens du texte »", () => {
    expect(relationFilterOptions(ELEMENTS)).toEqual([
      { key: "ally", label: "ally" },
      { key: "family", label: "Famille" },
      { key: "mentor", label: "mentor" },
      { key: "text", label: "Liens du texte" },
    ]);
  });

  it("aucune arete texte : pas d'option « Liens du texte »", () => {
    expect(
      relationFilterOptions({ nodes: ELEMENTS.nodes, edges: [edge("a", "b", ["family"])] }),
    ).toEqual([{ key: "family", label: "Famille" }]);
  });
});

describe("parseStoredFilters", () => {
  it("valeur valide : restituee", () => {
    const stored: GraphFilters = {
      hiddenTypeKeys: ["place"],
      hiddenRelationKeys: ["text"],
      focus: { mode: "hide", entityId: "selyne", depth: "all" },
    };

    expect(parseStoredFilters(JSON.stringify(stored))).toEqual(stored);
  });

  it.each([
    ["absente", null],
    ["JSON illisible", "{pas du json"],
    ["forme inattendue", JSON.stringify({ hiddenTypeKeys: "place" })],
    [
      "profondeur inconnue",
      JSON.stringify({
        hiddenTypeKeys: [],
        hiddenRelationKeys: [],
        focus: { mode: "isolate", entityId: "a", depth: 7 },
      }),
    ],
  ])("valeur %s : filtres par defaut, sans erreur", (_label, raw) => {
    expect(parseStoredFilters(raw)).toEqual(DEFAULT_GRAPH_FILTERS);
  });
});

describe("utilitaires", () => {
  it("cle de stockage par monde", () => {
    expect(graphFiltersStorageKey("w1")).toBe("storytide:graph-filters:w1");
  });

  it("filtres actifs", () => {
    expect(hasActiveFilters(DEFAULT_GRAPH_FILTERS)).toBe(false);
    expect(hasActiveFilters(filters({ hiddenRelationKeys: ["text"] }))).toBe(true);
    expect(hasActiveFilters(filters({ focus: { mode: "isolate", entityId: "a", depth: 1 } }))).toBe(
      true,
    );
  });

  it("libelle de profondeur", () => {
    expect(depthLabel(1)).toBe("1 saut");
    expect(depthLabel(2)).toBe("2 sauts");
    expect(depthLabel("all")).toBe("tous les sauts");
  });
});

describe("entryTypeFilterGroups", () => {
  const ORDER = ["Personnages", "Lieux", "Objets"];

  it("seuls les types presents, avec leur nombre ; groupes non vides dans l'ordre", () => {
    expect(
      entryTypeFilterGroups(
        [
          { typeKey: "place", typeLabel: "Lieu", group: "Lieux" },
          { typeKey: "character", typeLabel: "Personnage", group: "Personnages" },
          { typeKey: "character", typeLabel: "Personnage", group: "Personnages" },
          { typeKey: "custom:c1", typeLabel: "Héros", group: "Personnages" },
        ],
        ORDER,
      ),
    ).toEqual([
      {
        group: "Personnages",
        types: [
          { key: "custom:c1", label: "Héros", count: 1 },
          { key: "character", label: "Personnage", count: 2 },
        ],
      },
      { group: "Lieux", types: [{ key: "place", label: "Lieu", count: 1 }] },
    ]);
  });

  it("monde vide : aucun groupe", () => {
    expect(entryTypeFilterGroups([], ORDER)).toEqual([]);
  });

  it("groupe inconnu de l'ordre : range a la fin", () => {
    const groups = entryTypeFilterGroups(
      [
        { typeKey: "x", typeLabel: "X", group: "Inconnu" },
        { typeKey: "object", typeLabel: "Objet", group: "Objets" },
      ],
      ORDER,
    );

    expect(groups.map(({ group }) => group)).toEqual(["Objets", "Inconnu"]);
  });
});

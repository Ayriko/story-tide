import { describe, expect, it } from "vitest";
import { diffGraphElements, isEmptyDiff } from "./graph-diff";
import type { GraphEdgeElement, GraphElements, GraphNodeElement } from "./graph-elements";

function node(id: string, label = id, typeKey = "character"): GraphNodeElement {
  return { data: { id, label, typeKey, group: "Personnages", icon: "user", tier: 0 } };
}

function edge(
  source: string,
  target: string,
  overrides: Partial<GraphEdgeElement["data"]> = {},
): GraphEdgeElement {
  const [a, b] = source < target ? [source, target] : [target, source];
  return {
    data: {
      id: `pair:${a}~${b}`,
      source,
      target,
      kind: "text",
      arrow: false,
      label: "",
      relationTypes: [],
      ...overrides,
    },
  };
}

const BASE: GraphElements = {
  nodes: [node("a"), node("b"), node("c")],
  edges: [edge("a", "b")],
};

describe("diffGraphElements", () => {
  it("memes elements (nouvel objet, meme contenu) : diff vide", () => {
    const diff = diffGraphElements(BASE, structuredClone(BASE));

    expect(isEmptyDiff(diff)).toBe(true);
  });

  it("ajout d'une etoile et d'une arete : seules elles sont ajoutees", () => {
    const next: GraphElements = {
      nodes: [...BASE.nodes, node("d")],
      edges: [...BASE.edges, edge("c", "d")],
    };

    const diff = diffGraphElements(BASE, next);

    expect(diff.addNodes.map((n) => n.data.id)).toEqual(["d"]);
    expect(diff.addEdges.map((e) => e.data.id)).toEqual(["pair:c~d"]);
    expect(diff.removeNodeIds).toEqual([]);
    expect(diff.updateNodes).toEqual([]);
    expect(diff.removeEdgeIds).toEqual([]);
    expect(diff.updateEdges).toEqual([]);
  });

  it("retrait d'une etoile et d'une arete", () => {
    const next: GraphElements = { nodes: [node("a"), node("b")], edges: [] };

    const diff = diffGraphElements(BASE, next);

    expect(diff.removeNodeIds).toEqual(["c"]);
    expect(diff.removeEdgeIds).toEqual(["pair:a~b"]);
    expect(diff.addNodes).toEqual([]);
  });

  it("etoile renommee ou retypee : mise a jour, jamais retrait + ajout (place conservee)", () => {
    const next: GraphElements = {
      nodes: [node("a", "Selyne la Grande"), node("b", "b", "place"), node("c")],
      edges: BASE.edges,
    };

    const diff = diffGraphElements(BASE, next);

    expect(diff.updateNodes.map((n) => n.data.id)).toEqual(["a", "b"]);
    expect(diff.addNodes).toEqual([]);
    expect(diff.removeNodeIds).toEqual([]);
  });

  it("arete texte devenue declaree, meme sens : mise a jour", () => {
    const next: GraphElements = {
      nodes: BASE.nodes,
      edges: [edge("a", "b", { kind: "declared", label: "Allié" })],
    };

    const diff = diffGraphElements(BASE, next);

    expect(diff.updateEdges.map((e) => e.data.label)).toEqual(["Allié"]);
    expect(diff.removeEdgeIds).toEqual([]);
    expect(diff.addEdges).toEqual([]);
  });

  it("arete dont le sens s'inverse : retiree puis ajoutee (extremites immuables)", () => {
    const next: GraphElements = {
      nodes: BASE.nodes,
      edges: [edge("b", "a", { arrow: true })],
    };

    const diff = diffGraphElements(BASE, next);

    expect(diff.removeEdgeIds).toEqual(["pair:a~b"]);
    expect(diff.addEdges.map((e) => [e.data.source, e.data.target])).toEqual([["b", "a"]]);
    expect(diff.updateEdges).toEqual([]);
  });
});

import type { GraphEdgeElement, GraphElements, GraphNodeElement } from "./graph-elements";

// Mise a jour du graphe par difference (KAN-87, ADR-0032) : l'instance
// Cytoscape est creee une fois par montage ; quand les elements changent
// (router.refresh apres une creation), on n'ajoute, ne retire et ne met a
// jour que ce qui a change, par id - les etoiles existantes gardent leur
// place. TS pur, testable isolement.

export type GraphDiff = {
  addNodes: GraphNodeElement[];
  removeNodeIds: string[];
  updateNodes: GraphNodeElement[];
  addEdges: GraphEdgeElement[];
  removeEdgeIds: string[];
  updateEdges: GraphEdgeElement[];
};

// Les donnees sont produites par la meme fonction (buildGraphElements) :
// meme ordre de cles, la comparaison serialisee suffit.
function sameData(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function diffById<T extends { data: { id: string } }>(
  previous: readonly T[],
  next: readonly T[],
  mustReplace: (before: T, after: T) => boolean,
) {
  const previousById = new Map(previous.map((element) => [element.data.id, element]));
  const nextIds = new Set(next.map((element) => element.data.id));
  const add: T[] = [];
  const update: T[] = [];
  const remove = previous
    .filter((element) => !nextIds.has(element.data.id))
    .map((element) => element.data.id);
  for (const element of next) {
    const before = previousById.get(element.data.id);
    if (!before) {
      add.push(element);
    } else if (mustReplace(before, element)) {
      remove.push(element.data.id);
      add.push(element);
    } else if (!sameData(before.data, element.data)) {
      update.push(element);
    }
  }
  return { add, remove, update };
}

export function diffGraphElements(previous: GraphElements, next: GraphElements): GraphDiff {
  const nodes = diffById(previous.nodes, next.nodes, () => false);
  // Les extremites d'une arete Cytoscape sont immuables : une arete dont le
  // sens change (fleche inversee) est retiree puis ajoutee.
  const edges = diffById(
    previous.edges,
    next.edges,
    (before, after) =>
      before.data.source !== after.data.source || before.data.target !== after.data.target,
  );
  return {
    addNodes: nodes.add,
    removeNodeIds: nodes.remove,
    updateNodes: nodes.update,
    addEdges: edges.add,
    removeEdgeIds: edges.remove,
    updateEdges: edges.update,
  };
}

export function isEmptyDiff(diff: GraphDiff): boolean {
  return Object.values(diff).every((list) => list.length === 0);
}

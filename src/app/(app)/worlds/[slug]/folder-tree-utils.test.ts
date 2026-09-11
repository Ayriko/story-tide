import { describe, expect, it } from "vitest";
import type { FolderTreeNode } from "@/services/folder-service";
import {
  UNFILED_NODE_ID,
  buildTreeNodes,
  flattenVisibleItems,
  treeItemKey,
  type EntityLite,
} from "./folder-tree-utils";

function makeFolderNode(overrides: Partial<FolderTreeNode> = {}): FolderTreeNode {
  return {
    id: "f1",
    worldId: "w1",
    name: "Dossier",
    parentId: null,
    seedRef: null,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    children: [],
    ...overrides,
  };
}

function makeEntity(overrides: Partial<EntityLite> = {}): EntityLite {
  return { id: "e1", name: "Aeliana", type: "character", ...overrides };
}

describe("buildTreeNodes", () => {
  it("place « Non classé » en dernier, meme quand des dossiers existent", () => {
    const tree = buildTreeNodes([makeFolderNode({ id: "f1", name: "Royaumes" })], []);

    expect(tree).toHaveLength(2);
    expect(tree[0]).toMatchObject({ kind: "folder", id: "f1", name: "Royaumes" });
    expect(tree[1]).toMatchObject({ kind: "folder", id: UNFILED_NODE_ID, name: "Non classé" });
  });

  it("reduit un arbre de dossiers imbrique a la meme forme, recursivement", () => {
    const nested = makeFolderNode({
      id: "f1",
      name: "Royaumes",
      children: [makeFolderNode({ id: "f2", name: "Nord", parentId: "f1", children: [] })],
    });

    const tree = buildTreeNodes([nested], []);

    expect(tree[0]).toEqual({
      kind: "folder",
      id: "f1",
      name: "Royaumes",
      children: [{ kind: "folder", id: "f2", name: "Nord", children: [] }],
    });
  });

  it("place les entites sans dossier comme feuilles de « Non classé »", () => {
    const tree = buildTreeNodes([], [makeEntity({ id: "e1" }), makeEntity({ id: "e2" })]);

    const unfiled = tree[0];
    if (!unfiled || unfiled.kind !== "folder") throw new Error("unreachable");
    expect(unfiled.children).toEqual([
      { kind: "entity", id: "e1", name: "Aeliana", type: "character" },
      { kind: "entity", id: "e2", name: "Aeliana", type: "character" },
    ]);
  });

  it("« Non classé » sans entite reste un noeud pliable vide (jamais omis)", () => {
    const tree = buildTreeNodes([], []);

    expect(tree).toEqual([
      { kind: "folder", id: UNFILED_NODE_ID, name: "Non classé", children: [] },
    ]);
  });
});

describe("treeItemKey", () => {
  it("compose la cle avec le parent quand il y en a un", () => {
    const node = { kind: "folder" as const, id: "f2", name: "Nord", children: [] };
    expect(treeItemKey("f1", node)).toBe("f1/f2");
    expect(treeItemKey(null, node)).toBe("f2");
  });
});

describe("flattenVisibleItems", () => {
  const tree = buildTreeNodes(
    [
      makeFolderNode({
        id: "f1",
        name: "Royaumes",
        children: [
          makeFolderNode({
            id: "f2",
            name: "Nord",
            parentId: "f1",
            children: [
              makeFolderNode({ id: "f3", name: "Capitales", parentId: "f2", children: [] }),
            ],
          }),
        ],
      }),
    ],
    [makeEntity({ id: "e1", name: "Aeliana" })],
  );

  it("replie tout : seuls les noeuds racines sont visibles", () => {
    const items = flattenVisibleItems(tree, new Set());

    expect(items.map((item) => item.key)).toEqual(["f1", UNFILED_NODE_ID]);
    expect(items.every((item) => item.depth === 0)).toBe(true);
  });

  it("deplie partiellement : seul le sous-arbre deplie descend d'un niveau", () => {
    const items = flattenVisibleItems(tree, new Set(["f1"]));

    expect(items.map((item) => item.key)).toEqual(["f1", "f1/f2", UNFILED_NODE_ID]);
    expect(items.find((item) => item.key === "f1/f2")?.depth).toBe(1);
  });

  it("deplie tout : chaque niveau apparait a la bonne profondeur, dans l'ordre du parcours", () => {
    const items = flattenVisibleItems(tree, new Set(["f1", "f1/f2", UNFILED_NODE_ID]));

    expect(items.map((item) => ({ key: item.key, depth: item.depth }))).toEqual([
      { key: "f1", depth: 0 },
      { key: "f1/f2", depth: 1 },
      { key: "f1/f2/f3", depth: 2 },
      { key: UNFILED_NODE_ID, depth: 0 },
      { key: `${UNFILED_NODE_ID}/e1`, depth: 1 },
    ]);
  });

  it("porte la cle du parent pour retrouver le noeud englobant (ArrowLeft)", () => {
    const items = flattenVisibleItems(tree, new Set(["f1"]));
    const child = items.find((item) => item.key === "f1/f2");

    expect(child?.parentKey).toBe("f1");
  });
});

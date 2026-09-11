import type { FolderTreeNode } from "@/services/folder-service";

// Fichier .ts pur (pas .tsx, pas "use client") : aucune dependance
// React/DOM, appelable tel quel depuis le Server Component layout.tsx comme
// depuis folder-tree.tsx cote client (KAN-57).

export type EntityLite = { id: string; name: string; type: string };

// Union unifiee dossier/entite - un dossier reel (FolderTreeNode) et le
// panier "Non classe" (getUnfiledEntities) partagent la meme forme "folder"
// pour que l'arbre les traite de facon identique (pliable, meme rendu).
export type TreeNode =
  | { kind: "folder"; id: string; name: string; children: TreeNode[] }
  | { kind: "entity"; id: string; name: string; type: string };

export const UNFILED_NODE_ID = "__unfiled__";
const UNFILED_NODE_NAME = "Non classé";

function toFolderNode(folder: FolderTreeNode): TreeNode {
  return {
    kind: "folder",
    id: folder.id,
    name: folder.name,
    children: folder.children.map(toFolderNode),
  };
}

// "Non classe" toujours en dernier (meme convention que "Divers", toujours
// dernier groupe de entity-schemas.ts) - regroupe les entites sans dossier.
// Aucune UI d'assignation n'existe dans ce lot (KAN-57 : pas de creation de
// dossier), donc ce panier contient aujourd'hui la totalite des entites du
// monde ; le code reste correct pour le jour ou une assignation existera.
export function buildTreeNodes(
  folders: FolderTreeNode[],
  unfiledEntities: EntityLite[],
): TreeNode[] {
  return [
    ...folders.map(toFolderNode),
    {
      kind: "folder",
      id: UNFILED_NODE_ID,
      name: UNFILED_NODE_NAME,
      children: unfiledEntities.map((entity) => ({ kind: "entity" as const, ...entity })),
    },
  ];
}

export function treeItemKey(parentKey: string | null, node: TreeNode): string {
  return parentKey ? `${parentKey}/${node.id}` : node.id;
}

export type FlatTreeItem = {
  key: string;
  depth: number;
  parentKey: string | null;
  node: TreeNode;
};

// Parcours en profondeur, expansion-aware : ne descend dans les enfants d'un
// dossier que s'il figure dans expandedKeys. C'est cette liste, et elle
// seule, qui pilote ArrowUp/Down/Home/End dans folder-tree.tsx (jamais
// l'arbre complet) - fonction pure, testable sans rendu.
export function flattenVisibleItems(
  nodes: TreeNode[],
  expandedKeys: ReadonlySet<string>,
  depth = 0,
  parentKey: string | null = null,
): FlatTreeItem[] {
  const items: FlatTreeItem[] = [];
  for (const node of nodes) {
    const key = treeItemKey(parentKey, node);
    items.push({ key, depth, parentKey, node });
    if (node.kind === "folder" && node.children.length > 0 && expandedKeys.has(key)) {
      items.push(...flattenVisibleItems(node.children, expandedKeys, depth + 1, key));
    }
  }
  return items;
}

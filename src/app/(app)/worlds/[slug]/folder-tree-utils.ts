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

// Sous-dossiers d'abord, puis les entites du dossier lui-meme (KAN-60,
// getFolderTree include desormais entities) - un seul tableau `children`
// melangeant les deux kinds, jamais deux listes separees : flattenVisibleItems
// et folder-tree.tsx traitent deja `children` de facon agnostique au kind
// (sauf pour expand/collapse, reserve aux dossiers), aucun changement requis
// la-bas.
function toFolderNode(folder: FolderTreeNode): TreeNode {
  return {
    kind: "folder",
    id: folder.id,
    name: folder.name,
    children: [
      ...folder.children.map(toFolderNode),
      ...folder.entities.map((entity) => ({
        kind: "entity" as const,
        id: entity.id,
        name: entity.name,
        type: entity.type,
      })),
    ],
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

export type FolderOption = { id: string; name: string; depth: number };

// Liste plate et indentee des DOSSIERS REELS (jamais "Non classe", jamais
// une entite) - alimente le menu "Deplacer vers..." (move-entity-menu.tsx,
// KAN-60). Fonction pure separee de flattenVisibleItems : celle-ci ignore
// l'etat de pli/depli (un menu de destination montre tout, contrairement a
// l'arbre affiche) et ignore les entites (jamais une destination valide).
export function flattenFolderOptions(folders: FolderTreeNode[], depth = 0): FolderOption[] {
  return folders.flatMap((folder) => [
    { id: folder.id, name: folder.name, depth },
    ...flattenFolderOptions(folder.children, depth + 1),
  ]);
}

// Deplace l'entite entityId vers le dossier targetKey (un id de dossier reel
// OU UNFILED_NODE_ID) dans une COPIE de l'arbre deja construit par
// buildTreeNodes. Fonction pure, jamais d'exception : une entite ou une
// cible introuvable (course avec une suppression concurrente, id perime) est
// un no-op silencieux qui renvoie `tree` inchange - c'est elle qui alimente
// useOptimistic dans folder-tree.tsx (KAN-60), testable sans dnd-kit ni jsdom.
export function moveEntityInTree(
  tree: TreeNode[],
  entityId: string,
  targetKey: string,
): TreeNode[] {
  let moved: TreeNode | null = null;

  function remove(nodes: TreeNode[]): TreeNode[] {
    const next: TreeNode[] = [];
    for (const node of nodes) {
      if (node.kind === "entity" && node.id === entityId) {
        moved = node;
        continue;
      }
      if (node.kind === "folder") {
        next.push({ ...node, children: remove(node.children) });
      } else {
        next.push(node);
      }
    }
    return next;
  }

  function insert(nodes: TreeNode[]): { nodes: TreeNode[]; inserted: boolean } {
    if (!moved) {
      return { nodes, inserted: false };
    }
    let inserted = false;
    const next = nodes.map((node) => {
      if (inserted || node.kind !== "folder") {
        return node;
      }
      if (node.id === targetKey) {
        inserted = true;
        return { ...node, children: [...node.children, moved as TreeNode] };
      }
      const result = insert(node.children);
      if (result.inserted) {
        inserted = true;
        return { ...node, children: result.nodes };
      }
      return node;
    });
    return { nodes: next, inserted };
  }

  const withoutEntity = remove(tree);
  if (!moved) {
    return tree;
  }
  const { nodes, inserted } = insert(withoutEntity);
  return inserted ? nodes : tree;
}

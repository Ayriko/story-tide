"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronRight, Folder as FolderIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { entityTypeLabel } from "@/lib/entity-schemas";
import { EntityTypeIcon } from "./entity-type-icon";
import { flattenVisibleItems, treeItemKey, type TreeNode } from "./folder-tree-utils";

// Arbre accessible (KAN-57) - patron WAI-ARIA Authoring Practices "tree" :
// role="tree"/"treeitem"/"group", tabindex flottant (un seul treeitem a
// tabIndex=0 a la fois), navigation clavier complete. Aucun conteneur
// defilant propre ici : reste a l'interieur du <nav overflow-y-auto> deja
// present dans sidebar.tsx, exactement comme la liste Types.
export function FolderTree({ tree, worldSlug }: { tree: TreeNode[]; worldSlug: string }) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const flatItems = flattenVisibleItems(tree, expandedKeys);
  const [focusedKey, setFocusedKey] = useState<string | null>(flatItems[0]?.key ?? null);
  const pendingFocusRef = useRef<string | null>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());

  // Le deplacement de focus DOM impuratif ne vit jamais en plein rendu : cet
  // effet s'execute apres que React a deja recommis les nouveaux tabIndex
  // dans le DOM (sinon .focus() sur un element encore tabIndex=-1 echoue
  // silencieusement, ou vole le focus sans geste clavier explicite).
  useEffect(() => {
    if (pendingFocusRef.current) {
      itemRefs.current.get(pendingFocusRef.current)?.focus();
      pendingFocusRef.current = null;
    }
  });

  function registerRef(key: string, element: HTMLElement | null) {
    if (element) {
      itemRefs.current.set(key, element);
    } else {
      itemRefs.current.delete(key);
    }
  }

  function toggleExpanded(key: string) {
    setExpandedKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function moveFocusTo(key: string) {
    setFocusedKey(key);
    pendingFocusRef.current = key;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const items = flattenVisibleItems(tree, expandedKeys);
    const currentIndex = items.findIndex((item) => item.key === focusedKey);
    const current = items[currentIndex];
    if (!current) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = items[currentIndex + 1];
      if (next) {
        moveFocusTo(next.key);
      }
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const previous = items[currentIndex - 1];
      if (previous) {
        moveFocusTo(previous.key);
      }
      return;
    }

    if (event.key === "ArrowRight") {
      if (current.node.kind !== "folder" || current.node.children.length === 0) {
        return;
      }
      event.preventDefault();
      if (!expandedKeys.has(current.key)) {
        toggleExpanded(current.key);
      } else {
        const next = items[currentIndex + 1];
        if (next) {
          moveFocusTo(next.key);
        }
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (current.node.kind === "folder" && expandedKeys.has(current.key)) {
        toggleExpanded(current.key);
      } else if (current.parentKey) {
        moveFocusTo(current.parentKey);
      }
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      const first = items[0];
      if (first) {
        moveFocusTo(first.key);
      }
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      const last = items[items.length - 1];
      if (last) {
        moveFocusTo(last.key);
      }
    }
  }

  return (
    <ul role="tree" aria-label="Dossiers" onKeyDown={handleKeyDown} className="flex flex-col gap-1">
      {tree.map((node) => (
        <TreeItem
          key={node.id}
          node={node}
          depth={0}
          parentKey={null}
          worldSlug={worldSlug}
          expandedKeys={expandedKeys}
          focusedKey={focusedKey}
          onToggle={toggleExpanded}
          onFocus={setFocusedKey}
          registerRef={registerRef}
        />
      ))}
    </ul>
  );
}

function TreeItem({
  node,
  depth,
  parentKey,
  worldSlug,
  expandedKeys,
  focusedKey,
  onToggle,
  onFocus,
  registerRef,
}: {
  node: TreeNode;
  depth: number;
  parentKey: string | null;
  worldSlug: string;
  expandedKeys: ReadonlySet<string>;
  focusedKey: string | null;
  onToggle: (key: string) => void;
  onFocus: (key: string) => void;
  registerRef: (key: string, element: HTMLElement | null) => void;
}) {
  const key = treeItemKey(parentKey, node);
  const tabIndex = focusedKey === key ? 0 : -1;
  const indentStyle = { paddingLeft: `${depth * 1.25}rem` };

  if (node.kind === "folder") {
    const isExpanded = expandedKeys.has(key);
    const hasChildren = node.children.length > 0;
    return (
      <li role="presentation">
        <button
          type="button"
          role="treeitem"
          ref={(element) => registerRef(key, element)}
          tabIndex={tabIndex}
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-selected={false}
          onFocus={() => onFocus(key)}
          onClick={() => hasChildren && onToggle(key)}
          style={indentStyle}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium text-foreground hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {hasChildren ? (
            <ChevronRight
              aria-hidden="true"
              className={cn("size-4 shrink-0 transition-transform", isExpanded && "rotate-90")}
            />
          ) : (
            <span aria-hidden="true" className="size-4 shrink-0" />
          )}
          <FolderIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded && hasChildren ? (
          <ul role="group" className="flex flex-col gap-1">
            {node.children.map((child) => (
              <TreeItem
                key={child.id}
                node={child}
                depth={depth + 1}
                parentKey={key}
                worldSlug={worldSlug}
                expandedKeys={expandedKeys}
                focusedKey={focusedKey}
                onToggle={onToggle}
                onFocus={onFocus}
                registerRef={registerRef}
              />
            ))}
          </ul>
        ) : null}
      </li>
    );
  }

  return (
    <li role="presentation">
      <Link
        href={`/worlds/${worldSlug}/entities/${node.id}`}
        role="treeitem"
        ref={(element) => registerRef(key, element)}
        tabIndex={tabIndex}
        // aria-selected=false partout (pas seulement omis) : ce role herite
        // de "option", qui l'exige (jsx-a11y/role-has-required-aria-props) -
        // cet arbre est un pur outil de navigation, sans notion de selection
        // distincte du focus, d'ou "false" invariable sur chaque noeud.
        aria-selected={false}
        onFocus={() => onFocus(key)}
        style={indentStyle}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span aria-hidden="true" className="size-4 shrink-0" />
        <EntityTypeIcon type={node.type} />
        <span className="truncate">{node.name}</span>
        <span className="sr-only">{entityTypeLabel(node.type)}</span>
      </Link>
    </li>
  );
}

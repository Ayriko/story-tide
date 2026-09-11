"use client";

import Link from "next/link";
import {
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronRight, Folder as FolderIcon, FolderOpen } from "lucide-react";
import { moveEntityToFolderAction, type MoveEntityState } from "@/actions/entity";
import { cn } from "@/lib/utils";
import { entityTypeLabel } from "@/lib/entity-schemas";
import { EntityTypeIcon } from "./entity-type-icon";
import { FolderRowActions } from "./folder-row-actions";
import { MoveEntityMenu } from "./move-entity-menu";
import {
  UNFILED_NODE_ID,
  flattenVisibleItems,
  moveEntityInTree,
  treeItemKey,
  type FolderOption,
  type TreeNode,
} from "./folder-tree-utils";

// Arbre accessible (KAN-57) - patron WAI-ARIA Authoring Practices "tree" :
// role="tree"/"treeitem"/"group", tabindex flottant (un seul treeitem a
// tabIndex=0 a la fois), navigation clavier complete. Aucun conteneur
// defilant propre ici : reste a l'interieur du <nav overflow-y-auto> deja
// present dans sidebar.tsx, exactement comme la liste Types.
//
// Glisser-deposer (KAN-60, @dnd-kit/core) : capteur POINTER SEUL, aucun
// KeyboardSensor - le mecanisme clavier/lecteur d'ecran accessible est le
// menu "Deplacer vers..." (MoveEntityMenu, WCAG 2.5.7), pas une simulation
// de glisser aux fleches. Etat optimiste (useOptimistic) porte ICI, jamais
// remonte a entity-search.tsx, qui reste totalement ignorant du glisser-deposer.
export function FolderTree({
  tree,
  worldId,
  worldSlug,
  folderOptions,
}: {
  tree: TreeNode[];
  worldId: string;
  worldSlug: string;
  folderOptions: FolderOption[];
}) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [optimisticTree, applyOptimisticMove] = useOptimistic(
    tree,
    (state, action: { entityId: string; targetKey: string }) =>
      moveEntityInTree(state, action.entityId, action.targetKey),
  );
  const flatItems = flattenVisibleItems(optimisticTree, expandedKeys);
  const [focusedKey, setFocusedKey] = useState<string | null>(flatItems[0]?.key ?? null);
  const pendingFocusRef = useRef<string | null>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());

  // Pas useActionState/<form action> ici - onDragEnd n'est pas une
  // soumission de formulaire, l'action est appelee directement (awaited)
  // dans le gestionnaire, meme raisonnement que create-folder-form.tsx pour
  // eviter tout useEffect qui observerait un etat.
  const [dragState, setDragState] = useState<MoveEntityState>({});
  const [, startTransition] = useTransition();
  const [activeDrag, setActiveDrag] = useState<{ id: string; name: string; type: string } | null>(
    null,
  );
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

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
    const items = flattenVisibleItems(optimisticTree, expandedKeys);
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

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as
      { entityId: string; name: string; type: string } | undefined;
    if (data) {
      setActiveDrag({ id: data.entityId, name: data.name, type: data.type });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null);
    const data = event.active.data.current as
      { entityId: string; currentFolderId: string | null } | undefined;
    const targetKey = event.over?.id;
    if (!data || targetKey === undefined) {
      return;
    }
    const targetId = String(targetKey);
    const currentId = data.currentFolderId ?? UNFILED_NODE_ID;
    if (targetId === currentId) {
      return;
    }
    startTransition(async () => {
      applyOptimisticMove({ entityId: data.entityId, targetKey: targetId });
      const formData = new FormData();
      formData.set("worldId", worldId);
      formData.set("entityId", data.entityId);
      formData.set("folderId", targetId === UNFILED_NODE_ID ? "" : targetId);
      const result = await moveEntityToFolderAction({}, formData);
      setDragState(result);
    });
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <ul
        role="tree"
        aria-label="Dossiers"
        onKeyDown={handleKeyDown}
        className="flex flex-col gap-1"
      >
        {optimisticTree.map((node) => (
          <TreeItem
            key={node.id}
            node={node}
            depth={0}
            parentKey={null}
            currentFolderId={null}
            worldId={worldId}
            worldSlug={worldSlug}
            folderOptions={folderOptions}
            expandedKeys={expandedKeys}
            focusedKey={focusedKey}
            onToggle={toggleExpanded}
            onFocus={setFocusedKey}
            registerRef={registerRef}
          />
        ))}
      </ul>

      {dragState.formError ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {dragState.formError}
        </p>
      ) : null}

      <DragOverlay>
        {activeDrag ? (
          <div className="flex items-center gap-2 rounded-md bg-card px-2 py-1.5 text-sm text-foreground shadow-lg ring-1 ring-foreground/10">
            <EntityTypeIcon type={activeDrag.type} />
            <span className="truncate">{activeDrag.name}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function TreeItem({
  node,
  depth,
  parentKey,
  currentFolderId,
  worldId,
  worldSlug,
  folderOptions,
  expandedKeys,
  focusedKey,
  onToggle,
  onFocus,
  registerRef,
}: {
  node: TreeNode;
  depth: number;
  parentKey: string | null;
  currentFolderId: string | null;
  worldId: string;
  worldSlug: string;
  folderOptions: FolderOption[];
  expandedKeys: ReadonlySet<string>;
  focusedKey: string | null;
  onToggle: (key: string) => void;
  onFocus: (key: string) => void;
  registerRef: (key: string, element: HTMLElement | null) => void;
}) {
  const key = treeItemKey(parentKey, node);
  const tabIndex = focusedKey === key ? 0 : -1;
  const indentStyle = { paddingLeft: `${depth * 1.25}rem` };

  // Appeles inconditionnellement (regle des hooks) - node.kind est stable
  // pour une instance donnee (meme cle React => meme nature de noeud d'un
  // rendu a l'autre), mais le linter ne peut pas le savoir statiquement.
  // useDraggable n'est exploite QUE pour une entite (listeners spreades plus
  // bas) ; useDroppable QUE pour un dossier - jamais {...attributes} de
  // useDraggable sur ce role="treeitem" (dnd-kit y mettrait son propre
  // role/tabIndex/aria-roledescription, qui ecraserait le tabindex flottant
  // et le role="treeitem" deja geres par cet arbre).
  const draggable = useDraggable({
    id: node.id,
    data:
      node.kind === "entity"
        ? { entityId: node.id, currentFolderId, name: node.name, type: node.type }
        : undefined,
  });
  const droppable = useDroppable({ id: node.id });

  if (node.kind === "folder") {
    const isExpanded = expandedKeys.has(key);
    const hasChildren = node.children.length > 0;
    const isRealFolder = node.id !== UNFILED_NODE_ID;
    return (
      // Le "row" (bouton + actions) vit dans un DIV flex a lui, jamais sur
      // le <li> : un <li> flex row entrainerait le <ul role="group"> des
      // enfants dans le meme axe horizontal (constate en verification
      // manuelle - un dossier deplie s'affichait a cote de sa ligne au lieu
      // de dessous). Le <li> reste un bloc simple, empile normalement le
      // row puis le sous-arbre.
      <li role="presentation">
        <div className="group/row relative flex items-center">
          <button
            type="button"
            role="treeitem"
            ref={(element) => {
              registerRef(key, element);
              droppable.setNodeRef(element);
            }}
            tabIndex={tabIndex}
            aria-expanded={hasChildren ? isExpanded : undefined}
            aria-selected={false}
            onFocus={() => onFocus(key)}
            onClick={() => hasChildren && onToggle(key)}
            style={indentStyle}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium text-foreground hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              isRealFolder && "pr-8",
              droppable.isOver && "outline-dashed outline-2 outline-primary",
            )}
          >
            {hasChildren ? (
              <ChevronRight
                aria-hidden="true"
                className={cn("size-4 shrink-0 transition-transform", isExpanded && "rotate-90")}
              />
            ) : (
              <span aria-hidden="true" className="size-4 shrink-0" />
            )}
            {droppable.isOver ? (
              <FolderOpen aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <FolderIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{node.name}</span>
          </button>
          {isRealFolder ? (
            <FolderRowActions worldId={worldId} folderId={node.id} folderName={node.name} />
          ) : null}
        </div>
        {isExpanded && hasChildren ? (
          <ul role="group" className="flex flex-col gap-1">
            {node.children.map((child) => (
              <TreeItem
                key={child.id}
                node={child}
                depth={depth + 1}
                parentKey={key}
                currentFolderId={isRealFolder ? node.id : null}
                worldId={worldId}
                worldSlug={worldSlug}
                folderOptions={folderOptions}
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
    <li role="presentation" className="group/row relative flex items-center">
      <Link
        href={`/worlds/${worldSlug}/entities/${node.id}`}
        role="treeitem"
        ref={(element) => {
          registerRef(key, element);
          draggable.setNodeRef(element);
        }}
        tabIndex={tabIndex}
        // aria-selected=false partout (pas seulement omis) : ce role herite
        // de "option", qui l'exige (jsx-a11y/role-has-required-aria-props) -
        // cet arbre est un pur outil de navigation, sans notion de selection
        // distincte du focus, d'ou "false" invariable sur chaque noeud.
        aria-selected={false}
        onFocus={() => onFocus(key)}
        style={indentStyle}
        className={cn(
          "flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 pr-8 text-sm text-foreground hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          draggable.isDragging && "opacity-40",
        )}
        {...draggable.listeners}
      >
        <span aria-hidden="true" className="size-4 shrink-0" />
        <EntityTypeIcon type={node.type} />
        <span className="truncate">{node.name}</span>
        <span className="sr-only">{entityTypeLabel(node.type)}</span>
      </Link>
      <MoveEntityMenu
        worldId={worldId}
        entityId={node.id}
        entityName={node.name}
        currentFolderId={currentFolderId}
        folderOptions={folderOptions}
      />
    </li>
  );
}

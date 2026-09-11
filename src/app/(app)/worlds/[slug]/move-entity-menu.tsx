"use client";

import { useState, useTransition } from "react";
import { FolderInput } from "lucide-react";
import { moveEntityToFolderAction, type MoveEntityState } from "@/actions/entity";
import type { FolderOption } from "./folder-tree-utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Mecanisme PRINCIPAL et accessible par defaut pour deplacer une entite
// (KAN-60, WCAG 2.5.7 "Dragging Movements") - fonctionne identiquement a la
// souris, au clavier (Tab, Entree/Espace, fleches natives du menu Radix), au
// lecteur d'ecran. Le glisser-depose (folder-tree.tsx) est une couche de
// confort EN PLUS, jamais requise : ce menu couvre a lui seul toute la
// fonctionnalite.
//
// L'action est appelee directement (jamais liee a un <form>) : le contenu de
// DropdownMenuContent est porte par un Portail Radix hors de l'arbre DOM
// physique, un vrai <form> ne pourrait pas l'englober.
export function MoveEntityMenu({
  worldId,
  entityId,
  entityName,
  currentFolderId,
  folderOptions,
}: {
  worldId: string;
  entityId: string;
  entityName: string;
  currentFolderId: string | null;
  folderOptions: FolderOption[];
}) {
  const [state, setState] = useState<MoveEntityState>({});
  const [isPending, startTransition] = useTransition();

  function move(folderId: string | null) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("worldId", worldId);
      formData.set("entityId", entityId);
      formData.set("folderId", folderId ?? "");
      const result = await moveEntityToFolderAction({}, formData);
      setState(result);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={isPending}
            aria-label={`Déplacer « ${entityName} » vers...`}
            className="absolute right-1 size-7 opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100"
          >
            <FolderInput aria-hidden="true" className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem disabled={currentFolderId === null} onSelect={() => move(null)}>
            Non classé
          </DropdownMenuItem>
          {folderOptions.map((option) => (
            <DropdownMenuItem
              key={option.id}
              disabled={option.id === currentFolderId}
              style={{ paddingLeft: `${0.375 + option.depth}rem` }}
              onSelect={() => move(option.id)}
            >
              {option.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {state.formError ? (
        <p role="alert" className="absolute top-full right-0 z-10 text-xs text-destructive">
          {state.formError}
        </p>
      ) : null}
    </>
  );
}

"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateFolderDialog } from "./create-folder-dialog";
import { RenameFolderDialog } from "./rename-folder-dialog";
import { DeleteFolderDialog } from "./delete-folder-dialog";

type OpenDialog = "subfolder" | "rename" | "delete" | null;

// DOM FRERE du <button role="treeitem"> existant (folder-tree.tsx), jamais
// imbrique dedans - pas de role interactif dans un role interactif, pas de
// second role="treeitem". Bouton icone TOUJOURS un arret Tab normal
// (opacity-0, jamais hidden/display:none) : revele des que la ligne ou ce
// bouton recoit le focus (group-focus-within, cf. classe posee par
// l'appelant sur le <li>) - jamais reserve au seul survol souris.
export function FolderRowActions({
  worldId,
  folderId,
  folderName,
}: {
  worldId: string;
  folderId: string;
  folderName: string;
}) {
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Actions pour le dossier « ${folderName} »`}
            className="absolute right-1 size-7 opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100"
          >
            <Settings aria-hidden="true" className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setOpenDialog("subfolder")}>
            + Sous-dossier
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setOpenDialog("rename")}>Renommer</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setOpenDialog("delete")}>
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateFolderDialog
        worldId={worldId}
        parentId={folderId}
        open={openDialog === "subfolder"}
        onOpenChange={(open) => setOpenDialog(open ? "subfolder" : null)}
      />
      <RenameFolderDialog
        worldId={worldId}
        folderId={folderId}
        currentName={folderName}
        open={openDialog === "rename"}
        onOpenChange={(open) => setOpenDialog(open ? "rename" : null)}
      />
      <DeleteFolderDialog
        worldId={worldId}
        folderId={folderId}
        folderName={folderName}
        open={openDialog === "delete"}
        onOpenChange={(open) => setOpenDialog(open ? "delete" : null)}
      />
    </>
  );
}

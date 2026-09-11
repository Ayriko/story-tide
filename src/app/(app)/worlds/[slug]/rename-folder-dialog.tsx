"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RenameFolderForm } from "./rename-folder-form";

// Toujours controle (declenche par l'item "Renommer" de folder-row-actions.tsx,
// aucun cas d'usage top-level) - pas de DialogTrigger ici.
export function RenameFolderDialog({
  worldId,
  folderId,
  currentName,
  open,
  onOpenChange,
}: {
  worldId: string;
  folderId: string;
  currentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renommer « {currentName} »</DialogTitle>
        </DialogHeader>
        <RenameFolderForm
          worldId={worldId}
          folderId={folderId}
          currentName={currentName}
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

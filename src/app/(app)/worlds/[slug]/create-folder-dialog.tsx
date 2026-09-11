"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CreateFolderForm } from "./create-folder-form";

// Composant "controlable" (KAN-60) : deux usages.
// 1) Non controle (top-level, "+ Nouveau dossier", parentId=null) - gere son
//    propre etat d'ouverture, rend son propre declencheur.
// 2) Controle (depuis folder-row-actions.tsx, "+ Sous-dossier", parentId
//    fixe) - open/onOpenChange fournis par l'appelant, aucun declencheur
//    rendu ici (c'est l'item de menu qui ouvre le dialogue).
// Dans les deux cas, CreateFolderForm doit pouvoir refermer le dialogue a la
// fin d'une soumission reussie (onSuccess) - d'ou setOpen unifie, jamais un
// Dialog Radix reellement non controle (qui ne serait pas fermable depuis
// l'exterieur).
export function CreateFolderDialog({
  worldId,
  parentId,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  worldId: string;
  parentId: string | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isControlled ? null : (
        <DialogTrigger asChild>
          <Button type="button" variant="outline" className="w-full">
            + Nouveau dossier
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{parentId ? "Nouveau sous-dossier" : "Nouveau dossier"}</DialogTitle>
        </DialogHeader>
        <CreateFolderForm worldId={worldId} parentId={parentId} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

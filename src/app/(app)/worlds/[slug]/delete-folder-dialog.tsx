"use client";

import { useState, useTransition } from "react";
import { deleteFolderAction, type FolderDeleteState } from "@/actions/folder";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const initialState: FolderDeleteState = {};

// Toujours controle (declenche par l'item "Supprimer" de folder-row-actions.tsx).
// Bouton simple (PAS AlertDialogAction, meme raison que delete-world-form.tsx) :
// AlertDialogAction fermerait la boite immediatement au clic, avant meme que
// l'action serveur asynchrone n'ait pu echouer et afficher son erreur dans
// une boite deja fermee. deleteFolderAction ne redirige jamais (contrairement
// a deleteWorldAction) - c'est ce gestionnaire, une fois la promesse resolue
// sans erreur, qui ferme la boite via onOpenChange(false), jamais un effet.
export function DeleteFolderDialog({
  worldId,
  folderId,
  folderName,
  open,
  onOpenChange,
}: {
  worldId: string;
  folderId: string;
  folderName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, setState] = useState<FolderDeleteState>(initialState);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const formData = new FormData();
      formData.set("worldId", worldId);
      formData.set("folderId", folderId);
      const result = await deleteFolderAction(state, formData);
      setState(result);
      if (!result.formError) {
        onOpenChange(false);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer « {folderName} » ?</AlertDialogTitle>
          <AlertDialogDescription>
            Les sous-dossiers de « {folderName} », à toute profondeur, seront supprimés. Aucune
            entrée n&apos;est jamais supprimée : celles qu&apos;ils contiennent repasseront dans «
            Non classé ».
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit}>
          {state.formError ? (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {state.formError}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <Button type="submit" disabled={isPending} aria-busy={isPending} variant="destructive">
              {isPending ? "Suppression..." : "Confirmer la suppression"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

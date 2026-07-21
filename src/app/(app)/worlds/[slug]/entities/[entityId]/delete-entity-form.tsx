"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { deleteEntityAction, type EntityDeleteState } from "@/actions/entity";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const initialState: EntityDeleteState = {};

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    // Bouton simple (PAS AlertDialogAction), meme raison que
    // delete-world-form.tsx : AlertDialogAction fermerait la boite avant que
    // l'echec eventuel de l'action serveur n'ait pu s'y afficher.
    <Button type="submit" disabled={pending} aria-busy={pending} variant="destructive">
      {pending ? "Suppression..." : "Confirmer la suppression"}
    </Button>
  );
}

// Meme patron que delete-world-form.tsx : AlertDialog (Radix) remplace le
// pattern "confirming state + 2 boutons", jamais de window.confirm bloquant.
export function DeleteEntityForm({
  worldId,
  worldSlug,
  entityId,
}: {
  worldId: string;
  worldSlug: string;
  entityId: string;
}) {
  const [state, formAction] = useActionState(deleteEntityAction, initialState);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline">
          Supprimer cette entrée
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer cette entrée ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est irréversible : l&apos;entrée sera définitivement supprimée.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form action={formAction}>
          <input type="hidden" name="worldId" value={worldId} />
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <input type="hidden" name="entityId" value={entityId} />

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
            <ConfirmButton />
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteEntityAction, type EntityDeleteState } from "@/actions/entity";
import { Button } from "@/components/ui/button";

const initialState: EntityDeleteState = {};

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} variant="destructive">
      {pending ? "Suppression..." : "Confirmer la suppression"}
    </Button>
  );
}

// Meme patron que delete-world-form.tsx : confirmation en 2 etapes, entierement
// au clavier, pas de window.confirm bloquant.
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
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="font-heading text-sm font-medium text-foreground">Zone de danger</h3>
        <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
          Supprimer cette fiche
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <h3 className="font-heading text-sm font-medium text-foreground">Zone de danger</h3>
      <input type="hidden" name="worldId" value={worldId} />
      <input type="hidden" name="worldSlug" value={worldSlug} />
      <input type="hidden" name="entityId" value={entityId} />

      {state.formError ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Cette action est irréversible : la fiche sera définitivement supprimée.
      </p>

      <div className="flex gap-2">
        <ConfirmButton />
        <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

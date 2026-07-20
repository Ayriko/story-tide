"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteWorldAction, type WorldDeleteState } from "@/actions/world";
import { Button } from "@/components/ui/button";

const initialState: WorldDeleteState = {};

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} variant="destructive">
      {pending ? "Suppression..." : "Confirmer la suppression"}
    </Button>
  );
}

// Confirmation en 2 etapes, entierement au clavier (boutons natifs, pas de
// window.confirm bloquant) : evite d'engager une suppression irreversible en
// un seul Tab+Entree accidentel.
export function DeleteWorldForm({ worldId }: { worldId: string }) {
  const [state, formAction] = useActionState(deleteWorldAction, initialState);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="font-heading text-sm font-medium text-foreground">Zone de danger</h3>
        <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
          Supprimer ce monde
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <h3 className="font-heading text-sm font-medium text-foreground">Zone de danger</h3>
      <input type="hidden" name="worldId" value={worldId} />

      {state.formError ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Cette action est irréversible : le monde et son contenu seront définitivement supprimés.
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

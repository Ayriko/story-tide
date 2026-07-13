"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteEntityAction, type EntityDeleteState } from "@/actions/entity";
import {
  formErrorClassName,
  secondaryButtonClassName,
  submitButtonClassName,
} from "@/app/(app)/form-styles";

const initialState: EntityDeleteState = {};

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${submitButtonClassName} bg-red-700 hover:bg-red-800 dark:bg-red-700 dark:hover:bg-red-800`}
    >
      {pending ? "Suppression..." : "Confirmer la suppression"}
    </button>
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
        <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Zone de danger</h3>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={secondaryButtonClassName}
        >
          Supprimer cette fiche
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Zone de danger</h3>
      <input type="hidden" name="worldId" value={worldId} />
      <input type="hidden" name="worldSlug" value={worldSlug} />
      <input type="hidden" name="entityId" value={entityId} />

      {state.formError ? (
        <p role="alert" className={formErrorClassName}>
          {state.formError}
        </p>
      ) : null}

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Cette action est irréversible : la fiche sera définitivement supprimée.
      </p>

      <div className="flex gap-2">
        <ConfirmButton />
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className={secondaryButtonClassName}
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

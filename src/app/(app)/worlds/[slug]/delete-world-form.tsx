"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteWorldAction, type WorldDeleteState } from "@/actions/world";
import {
  formErrorClassName,
  secondaryButtonClassName,
  submitButtonClassName,
} from "../../form-styles";

const initialState: WorldDeleteState = {};

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

// Confirmation en 2 etapes, entierement au clavier (boutons natifs, pas de
// window.confirm bloquant) : evite d'engager une suppression irreversible en
// un seul Tab+Entree accidentel.
export function DeleteWorldForm({ worldId }: { worldId: string }) {
  const [state, formAction] = useActionState(deleteWorldAction, initialState);
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
          Supprimer ce monde
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Zone de danger</h3>
      <input type="hidden" name="worldId" value={worldId} />

      {state.formError ? (
        <p role="alert" className={formErrorClassName}>
          {state.formError}
        </p>
      ) : null}

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Cette action est irréversible : le monde et son contenu seront définitivement supprimés.
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

"use client";

import { useState, useTransition } from "react";
import { createFolderAction, type FolderFormState } from "@/actions/folder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: FolderFormState = {};

// Formulaire nu (meme patron que create-entity-form.tsx : le "chrome" vient
// du Dialog englobant), mais SANS useActionState/<form action> - createEntityAction
// redirige toujours en cas de succes (le composant se demonte, rien a fermer),
// alors qu'ici le dialogue doit se refermer lui-meme SANS naviguer nulle
// part. Fermer depuis un useEffect qui observe le retour de useActionState
// aurait la meme forme qu'un hydration-from-effect (react-hooks/set-state-in-effect,
// deja rencontre sur la lecture localStorage de KAN-57) - l'action est donc
// appelee directement dans le gestionnaire onSubmit (awaited), qui ferme le
// dialogue lui-meme une fois la promesse resolue sans erreur, jamais depuis
// un effet.
export function CreateFolderForm({
  worldId,
  parentId,
  onSuccess,
}: {
  worldId: string;
  parentId: string | null;
  onSuccess: () => void;
}) {
  const [state, setState] = useState<FolderFormState>(initialState);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createFolderAction(state, formData);
      setState(result);
      if (!result.errors && !result.formError) {
        onSuccess();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
      <input type="hidden" name="worldId" value={worldId} />
      <input type="hidden" name="parentId" value={parentId ?? ""} />

      {state.formError ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="folder-name">Nom</Label>
        <Input
          id="folder-name"
          name="name"
          type="text"
          required
          autoComplete="off"
          defaultValue={state.values?.name ?? ""}
          aria-invalid={state.errors?.name ? true : undefined}
          aria-describedby={state.errors?.name ? "folder-name-error" : undefined}
        />
        {state.errors?.name ? (
          <p id="folder-name-error" className="text-sm text-destructive">
            {state.errors.name}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={isPending} aria-busy={isPending}>
        {isPending ? "Création..." : "Créer"}
      </Button>
    </form>
  );
}

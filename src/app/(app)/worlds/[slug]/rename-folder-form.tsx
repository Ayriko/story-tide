"use client";

import { useState, useTransition } from "react";
import { renameFolderAction, type FolderFormState } from "@/actions/folder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: FolderFormState = {};

// Meme raisonnement que create-folder-form.tsx : pas de useActionState/<form
// action>, l'action est appelee directement dans onSubmit pour pouvoir
// fermer le dialogue depuis la meme fonction, jamais depuis un effet.
export function RenameFolderForm({
  worldId,
  folderId,
  currentName,
  onSuccess,
}: {
  worldId: string;
  folderId: string;
  currentName: string;
  onSuccess: () => void;
}) {
  const [state, setState] = useState<FolderFormState>(initialState);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await renameFolderAction(state, formData);
      setState(result);
      if (!result.errors && !result.formError) {
        onSuccess();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
      <input type="hidden" name="worldId" value={worldId} />
      <input type="hidden" name="folderId" value={folderId} />

      {state.formError ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rename-folder-name">Nom</Label>
        <Input
          id="rename-folder-name"
          name="name"
          type="text"
          required
          autoComplete="off"
          defaultValue={state.values?.name ?? currentName}
          aria-invalid={state.errors?.name ? true : undefined}
          aria-describedby={state.errors?.name ? "rename-folder-name-error" : undefined}
        />
        {state.errors?.name ? (
          <p id="rename-folder-name-error" className="text-sm text-destructive">
            {state.errors.name}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={isPending} aria-busy={isPending}>
        {isPending ? "Renommage..." : "Renommer"}
      </Button>
    </form>
  );
}

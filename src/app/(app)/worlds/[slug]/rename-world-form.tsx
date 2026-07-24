"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateWorldAction, type WorldFormState } from "@/actions/world";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Enregistrement..." : "Renommer"}
    </Button>
  );
}

// Formulaire nu (KAN-36 P2), meme patron que create-world-form.tsx : le
// titre vient du Dialog englobant (world-settings-dialog.tsx).
export function RenameWorldForm({ worldId, name }: { worldId: string; name: string }) {
  const initialState: WorldFormState = { values: { name } };
  const [state, formAction] = useActionState(updateWorldAction, initialState);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-3">
      <input type="hidden" name="worldId" value={worldId} />

      {state.formError ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Nom du monde</Label>
        <Input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={state.values?.name ?? name}
          aria-invalid={state.errors?.name ? true : undefined}
          aria-describedby={state.errors?.name ? "name-error" : undefined}
        />
        {state.errors?.name ? (
          <p id="name-error" className="text-sm text-destructive">
            {state.errors.name}
          </p>
        ) : null}
      </div>

      <SubmitButton />
    </form>
  );
}

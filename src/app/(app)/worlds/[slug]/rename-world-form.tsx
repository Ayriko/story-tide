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
// stayOnWorldsList (retour Aymeric) : depuis /worlds (quick win 2.4),
// renommer redirigeait vers /worlds/<slug> comme depuis la page du monde -
// quitte la liste alors qu'on y etait deja. Enumeration "list"/"world" en
// champ cache, jamais un chemin brut (open redirect, OWASP A01) - la cible
// reelle est calculee par updateWorldAction lui-meme.
export function RenameWorldForm({
  worldId,
  name,
  stayOnWorldsList = false,
}: {
  worldId: string;
  name: string;
  stayOnWorldsList?: boolean;
}) {
  const initialState: WorldFormState = { values: { name } };
  const [state, formAction] = useActionState(updateWorldAction, initialState);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-3">
      <input type="hidden" name="worldId" value={worldId} />
      <input type="hidden" name="afterRename" value={stayOnWorldsList ? "list" : "world"} />

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
          autoComplete="off"
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

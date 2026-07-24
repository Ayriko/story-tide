"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateEntityAction, type EntityFormState } from "@/actions/entity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EntityTypeCombobox } from "../../entity-type-combobox";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Enregistrement..." : "Enregistrer"}
    </Button>
  );
}

// Formulaire nu (KAN-36 P2), meme patron que create-world-form.tsx : le
// titre vient du Dialog englobant (entity-settings-dialog.tsx).
export function EditEntityForm({
  worldId,
  worldSlug,
  entityId,
  name,
  type,
  aliases,
}: {
  worldId: string;
  worldSlug: string;
  entityId: string;
  name: string;
  type: string;
  aliases: string[];
}) {
  const initialState: EntityFormState = {
    values: { name, type, aliases: aliases.join("\n") },
  };
  const [state, formAction] = useActionState(updateEntityAction, initialState);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-3">
      <input type="hidden" name="worldId" value={worldId} />
      <input type="hidden" name="worldSlug" value={worldSlug} />
      <input type="hidden" name="entityId" value={entityId} />

      {state.formError ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="entity-name">Nom</Label>
        <Input
          id="entity-name"
          name="name"
          type="text"
          required
          defaultValue={state.values?.name ?? name}
          aria-invalid={state.errors?.name ? true : undefined}
          aria-describedby={state.errors?.name ? "entity-name-error" : undefined}
        />
        {state.errors?.name ? (
          <p id="entity-name-error" className="text-sm text-destructive">
            {state.errors.name}
          </p>
        ) : null}
      </div>

      <EntityTypeCombobox
        id="entity-type"
        name="type"
        label="Type"
        defaultValue={state.values?.type ?? type}
        invalid={Boolean(state.errors?.type)}
        describedBy={state.errors?.type ? "entity-type-error" : undefined}
      />
      {state.errors?.type ? (
        <p id="entity-type-error" className="text-sm text-destructive">
          {state.errors.type}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="entity-aliases">Alias (un par ligne)</Label>
        <Textarea
          id="entity-aliases"
          name="aliases"
          rows={3}
          defaultValue={state.values?.aliases ?? aliases.join("\n")}
          aria-invalid={state.errors?.aliases ? true : undefined}
          aria-describedby={state.errors?.aliases ? "entity-aliases-error" : undefined}
        />
        {state.errors?.aliases ? (
          <p id="entity-aliases-error" className="text-sm text-destructive">
            {state.errors.aliases}
          </p>
        ) : null}
      </div>

      <SubmitButton />
    </form>
  );
}

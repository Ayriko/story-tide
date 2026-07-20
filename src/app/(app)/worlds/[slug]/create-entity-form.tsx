"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createEntityAction, type EntityFormState } from "@/actions/entity";
import { ENTITY_TYPES } from "@/lib/entity-schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { EntityTypeCombobox } from "./entity-type-combobox";

const initialState: EntityFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Création..." : "Créer la fiche"}
    </Button>
  );
}

export function CreateEntityForm({ worldId, worldSlug }: { worldId: string; worldSlug: string }) {
  const [state, formAction] = useActionState(createEntityAction, initialState);

  return (
    <Card>
      <CardContent>
        <form
          action={formAction}
          noValidate
          aria-labelledby="create-entity-heading"
          className="flex flex-col gap-3"
        >
          <h3
            id="create-entity-heading"
            className="font-heading text-sm font-medium text-foreground"
          >
            Nouvelle fiche
          </h3>

          <input type="hidden" name="worldId" value={worldId} />
          <input type="hidden" name="worldSlug" value={worldSlug} />

          {state.formError ? (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
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
              defaultValue={state.values?.name ?? ""}
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
            defaultValue={state.values?.type ?? ENTITY_TYPES[0]}
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
              defaultValue={state.values?.aliases ?? ""}
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
      </CardContent>
    </Card>
  );
}

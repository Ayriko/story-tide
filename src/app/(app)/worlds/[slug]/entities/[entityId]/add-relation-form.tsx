"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createDeclaredRelationAction,
  type DeclaredRelationFormState,
} from "@/actions/declared-relations";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EntityTargetCombobox, type TargetEntityOption } from "./entity-target-combobox";
import { RelationTypeSelect, type RelationTypeOptions } from "./relation-type-select";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Ajout..." : "Ajouter la relation"}
    </Button>
  );
}

// « Ajouter une relation » (KAN-84) : type + entree cible, depuis la fiche
// courante. Apres un ajout reussi, le combobox (etat React, pas un champ
// reinitialise par le formulaire) est remonte via `key` - mis a jour DANS
// l'action, jamais depuis un effet.
export function AddRelationForm({
  worldId,
  worldSlug,
  entityId,
  options,
  entities,
}: {
  worldId: string;
  worldSlug: string;
  entityId: string;
  options: RelationTypeOptions;
  entities: TargetEntityOption[];
}) {
  const [resetKey, setResetKey] = useState(0);
  const [state, formAction] = useActionState<DeclaredRelationFormState, FormData>(
    async (previous, formData) => {
      const next = await createDeclaredRelationAction(previous, formData);
      if (next.ok) {
        setResetKey((key) => key + 1);
      }
      return next;
    },
    {},
  );
  const prefix = `add-relation-${entityId}`;

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

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefix}-type`}>Type de relation</Label>
          <RelationTypeSelect
            id={`${prefix}-type`}
            options={options}
            invalid={state.errors?.choice !== undefined}
            describedBy={state.errors?.choice ? `${prefix}-type-error` : undefined}
          />
          {state.errors?.choice ? (
            <p id={`${prefix}-type-error`} className="text-sm text-destructive">
              {state.errors.choice}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <EntityTargetCombobox
            key={resetKey}
            id={`${prefix}-target`}
            name="otherId"
            label="Entrée liée"
            entities={entities}
            invalid={state.errors?.otherId !== undefined}
            describedBy={state.errors?.otherId ? `${prefix}-target-error` : undefined}
          />
          {state.errors?.otherId ? (
            <p id={`${prefix}-target-error`} className="text-sm text-destructive">
              {state.errors.otherId}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}

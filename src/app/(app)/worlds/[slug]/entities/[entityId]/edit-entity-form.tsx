"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateEntityAction, type EntityFormState } from "@/actions/entity";
import {
  fieldErrorClassName,
  formErrorClassName,
  inputClassName,
  labelClassName,
  submitButtonClassName,
  textareaClassName,
} from "@/app/(app)/form-styles";
import { EntityTypeCombobox } from "../../entity-type-combobox";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={submitButtonClassName}>
      {pending ? "Enregistrement..." : "Enregistrer"}
    </button>
  );
}

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
    <form
      action={formAction}
      noValidate
      aria-labelledby="edit-entity-heading"
      className="flex flex-col gap-3"
    >
      <h3
        id="edit-entity-heading"
        className="text-sm font-semibold text-zinc-950 dark:text-zinc-50"
      >
        Modifier la fiche
      </h3>

      <input type="hidden" name="worldId" value={worldId} />
      <input type="hidden" name="worldSlug" value={worldSlug} />
      <input type="hidden" name="entityId" value={entityId} />

      {state.formError ? (
        <p role="alert" className={formErrorClassName}>
          {state.formError}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="entity-name" className={labelClassName}>
          Nom
        </label>
        <input
          id="entity-name"
          name="name"
          type="text"
          required
          defaultValue={state.values?.name ?? name}
          aria-invalid={state.errors?.name ? true : undefined}
          aria-describedby={state.errors?.name ? "entity-name-error" : undefined}
          className={inputClassName}
        />
        {state.errors?.name ? (
          <p id="entity-name-error" className={fieldErrorClassName}>
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
        <p id="entity-type-error" className={fieldErrorClassName}>
          {state.errors.type}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="entity-aliases" className={labelClassName}>
          Alias (un par ligne)
        </label>
        <textarea
          id="entity-aliases"
          name="aliases"
          rows={3}
          defaultValue={state.values?.aliases ?? aliases.join("\n")}
          aria-invalid={state.errors?.aliases ? true : undefined}
          aria-describedby={state.errors?.aliases ? "entity-aliases-error" : undefined}
          className={textareaClassName}
        />
        {state.errors?.aliases ? (
          <p id="entity-aliases-error" className={fieldErrorClassName}>
            {state.errors.aliases}
          </p>
        ) : null}
      </div>

      <SubmitButton />
    </form>
  );
}

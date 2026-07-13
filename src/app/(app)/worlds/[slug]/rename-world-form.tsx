"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateWorldAction, type WorldFormState } from "@/actions/world";
import {
  fieldErrorClassName,
  formErrorClassName,
  inputClassName,
  labelClassName,
  submitButtonClassName,
} from "../../form-styles";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={submitButtonClassName}>
      {pending ? "Enregistrement..." : "Renommer"}
    </button>
  );
}

export function RenameWorldForm({ worldId, name }: { worldId: string; name: string }) {
  const initialState: WorldFormState = { values: { name } };
  const [state, formAction] = useActionState(updateWorldAction, initialState);

  return (
    <form
      action={formAction}
      noValidate
      aria-labelledby="rename-world-heading"
      className="flex flex-col gap-3"
    >
      <h3
        id="rename-world-heading"
        className="text-sm font-semibold text-zinc-950 dark:text-zinc-50"
      >
        Renommer
      </h3>

      <input type="hidden" name="worldId" value={worldId} />

      {state.formError ? (
        <p role="alert" className={formErrorClassName}>
          {state.formError}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className={labelClassName}>
          Nom du monde
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={state.values?.name ?? name}
          aria-invalid={state.errors?.name ? true : undefined}
          aria-describedby={state.errors?.name ? "name-error" : undefined}
          className={inputClassName}
        />
        {state.errors?.name ? (
          <p id="name-error" className={fieldErrorClassName}>
            {state.errors.name}
          </p>
        ) : null}
      </div>

      <SubmitButton />
    </form>
  );
}

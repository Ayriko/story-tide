"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createWorldAction, type WorldFormState } from "@/actions/world";
import {
  fieldErrorClassName,
  formErrorClassName,
  inputClassName,
  labelClassName,
  submitButtonClassName,
} from "../form-styles";

const initialState: WorldFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={submitButtonClassName}>
      {pending ? "Création..." : "Créer le monde"}
    </button>
  );
}

export function CreateWorldForm() {
  const [state, formAction] = useActionState(createWorldAction, initialState);

  return (
    <form
      action={formAction}
      noValidate
      aria-labelledby="create-world-heading"
      className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <h2
        id="create-world-heading"
        className="text-sm font-semibold text-zinc-950 dark:text-zinc-50"
      >
        Nouveau monde
      </h2>

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
          defaultValue={state.values?.name ?? ""}
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

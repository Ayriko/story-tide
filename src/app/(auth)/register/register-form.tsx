"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { registerAction, type AuthActionState } from "@/actions/auth";
import {
  fieldErrorClassName,
  formErrorClassName,
  inputClassName,
  labelClassName,
  submitButtonClassName,
} from "../form-styles";

const initialState: AuthActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={submitButtonClassName}>
      {pending ? "Creation..." : "Creer mon compte"}
    </button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, initialState);

  return (
    <form action={formAction} noValidate className="mt-6 flex flex-col gap-4">
      {state.formError ? (
        <p role="alert" className={formErrorClassName}>
          {state.formError}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className={labelClassName}>
          Nom
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
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

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className={labelClassName}>
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email ?? ""}
          aria-invalid={state.errors?.email ? true : undefined}
          aria-describedby={state.errors?.email ? "email-error" : undefined}
          className={inputClassName}
        />
        {state.errors?.email ? (
          <p id="email-error" className={fieldErrorClassName}>
            {state.errors.email}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className={labelClassName}>
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={state.errors?.password ? true : undefined}
          aria-describedby={state.errors?.password ? "password-error" : undefined}
          className={inputClassName}
        />
        {state.errors?.password ? (
          <p id="password-error" className={fieldErrorClassName}>
            {state.errors.password}
          </p>
        ) : null}
      </div>

      <SubmitButton />
    </form>
  );
}

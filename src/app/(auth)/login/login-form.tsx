"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, type AuthActionState } from "@/actions/auth";
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
      {pending ? "Connexion..." : "Se connecter"}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} noValidate className="mt-6 flex flex-col gap-4">
      {state.formError ? (
        <p role="alert" className={formErrorClassName}>
          {state.formError}
        </p>
      ) : null}

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
          autoComplete="current-password"
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

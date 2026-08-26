"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { resetPasswordAction, type ResetPasswordActionState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "../password-input";
import { Label } from "@/components/ui/label";

const initialState: ResetPasswordActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} size="lg" className="w-full">
      {pending ? "Enregistrement..." : "Enregistrer le nouveau mot de passe"}
    </Button>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resetPasswordAction, initialState);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {/* Le jeton voyage en champ cache : il vient de l'URL posee par Better
          Auth apres verification, et n'a pas a etre saisi ni affiche. */}
      <input type="hidden" name="token" value={token} />

      {state.formError ? (
        <div className="flex flex-col gap-2">
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {state.formError}
          </p>
          <Link
            href="/forgot-password"
            className="rounded-sm text-sm text-foreground underline underline-offset-4 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Demander un nouveau lien
          </Link>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Nouveau mot de passe</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          aria-invalid={state.errors?.password ? true : undefined}
          aria-describedby={state.errors?.password ? "password-error" : "password-aide"}
        />
        {state.errors?.password ? (
          <p id="password-error" className="text-sm text-destructive">
            {state.errors.password}
          </p>
        ) : (
          <p id="password-aide" className="text-sm text-muted-foreground">
            8 caractères minimum.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="passwordConfirm">Confirmer le mot de passe</Label>
        <PasswordInput
          id="passwordConfirm"
          name="passwordConfirm"
          autoComplete="new-password"
          required
          aria-invalid={state.errors?.passwordConfirm ? true : undefined}
          aria-describedby={state.errors?.passwordConfirm ? "passwordConfirm-error" : undefined}
        />
        {state.errors?.passwordConfirm ? (
          <p id="passwordConfirm-error" className="text-sm text-destructive">
            {state.errors.passwordConfirm}
          </p>
        ) : null}
      </div>

      <SubmitButton />
    </form>
  );
}

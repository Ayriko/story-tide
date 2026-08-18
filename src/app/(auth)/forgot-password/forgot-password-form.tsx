"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestPasswordResetAction, type ForgotPasswordActionState } from "@/actions/auth";
import { RESET_REQUEST_CONFIRMATION } from "@/lib/auth-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ForgotPasswordActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} size="lg" className="w-full">
      {pending ? "Envoi..." : "Envoyer le lien"}
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, initialState);

  // Confirmation volontairement identique que l'adresse corresponde ou non a
  // un compte (OWASP A07) : le formulaire disparait pour eviter de donner
  // envie de retenter, ce qui serait le seul moyen de comparer des reponses.
  if (state.sent) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="rounded-md bg-primary/10 px-3 py-2 text-sm text-foreground">
          {RESET_REQUEST_CONFIRMATION}
        </p>
        <p className="text-sm text-muted-foreground">
          Le lien reçu est valable une heure et ne peut servir qu&apos;une seule fois. Pensez à
          regarder vos courriers indésirables.
        </p>
        <Link
          href="/login"
          className="rounded-sm text-sm text-foreground underline underline-offset-4 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {state.formError ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email ?? ""}
          aria-invalid={state.errors?.email ? true : undefined}
          aria-describedby={state.errors?.email ? "email-error" : undefined}
        />
        {state.errors?.email ? (
          <p id="email-error" className="text-sm text-destructive">
            {state.errors.email}
          </p>
        ) : null}
      </div>

      <SubmitButton />

      <Link
        href="/login"
        className="rounded-sm text-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Retour à la connexion
      </Link>
    </form>
  );
}

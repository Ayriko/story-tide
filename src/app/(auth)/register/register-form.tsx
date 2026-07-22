"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { registerAction, type AuthActionState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} size="lg" className="w-full">
      {pending ? "Création..." : "Créer mon compte"}
    </Button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, initialState);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {state.formError ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Nom</Label>
        <Input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          defaultValue={state.values?.name ?? ""}
          aria-invalid={state.errors?.name ? true : undefined}
          aria-describedby={state.errors?.name ? "name-error" : undefined}
        />
        {state.errors?.name ? (
          <p id="name-error" className="text-sm text-destructive">
            {state.errors.name}
          </p>
        ) : null}
      </div>

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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={state.errors?.password ? true : undefined}
          aria-describedby={state.errors?.password ? "password-error" : undefined}
        />
        {state.errors?.password ? (
          <p id="password-error" className="text-sm text-destructive">
            {state.errors.password}
          </p>
        ) : null}
      </div>

      {/* Monde d'introduction "Atheraus" (KAN-35) : cree par defaut (opt-out),
          case native + label (regle CLAUDE.md : elements natifs d'abord,
          aucun composant Checkbox shadcn dans le projet a ce jour - pas de
          nouvelle dependance pour une seule case). */}
      <div className="flex items-start gap-2">
        <input
          id="skipIntroWorld"
          name="skipIntroWorld"
          type="checkbox"
          className="mt-0.5 size-4 rounded border-input"
        />
        <Label htmlFor="skipIntroWorld" className="text-sm font-normal text-muted-foreground">
          Ne pas créer le monde d&apos;exemple « Atheraus » (démonstration de la liaison automatique
          d&apos;entités)
        </Label>
      </div>

      <SubmitButton />
    </form>
  );
}

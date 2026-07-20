"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createWorldAction, type WorldFormState } from "@/actions/world";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

const initialState: WorldFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Création..." : "Créer le monde"}
    </Button>
  );
}

export function CreateWorldForm() {
  const [state, formAction] = useActionState(createWorldAction, initialState);

  return (
    <Card>
      <CardContent>
        <form
          action={formAction}
          noValidate
          aria-labelledby="create-world-heading"
          className="flex flex-col gap-3"
        >
          <h2
            id="create-world-heading"
            className="font-heading text-sm font-medium text-foreground"
          >
            Nouveau monde
          </h2>

          {state.formError ? (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {state.formError}
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nom du monde</Label>
            <Input
              id="name"
              name="name"
              type="text"
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

          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}

"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createWorldAction, type WorldFormState } from "@/actions/world";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: WorldFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Création..." : "Créer le monde"}
    </Button>
  );
}

// Formulaire nu (KAN-36 P2) : le "chrome" (titre, cadre) vient desormais du
// Dialog qui l'enveloppe (create-world-dialog.tsx) - DialogTitle porte deja
// le nom accessible de la boite de dialogue, pas besoin d'un heading propre
// ici. Succes = createWorldAction redirige (actions/world.ts) : la page
// entiere (donc ce Dialog) est demontee, aucune fermeture explicite requise.
// Echec = l'etat re-affiche l'erreur, le Dialog reste simplement ouvert.
export function CreateWorldForm() {
  const [state, formAction] = useActionState(createWorldAction, initialState);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-3">
      {state.formError ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name" className="sr-only">
          Nom du monde
        </Label>
        <Input
          id="name"
          name="name"
          type="text"
          required
          placeholder="Nom du monde"
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
  );
}

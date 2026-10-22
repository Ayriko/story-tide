"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createCustomRelationTypeAction,
  updateCustomRelationTypeAction,
  type CustomRelationTypeFormState,
} from "@/actions/world-settings";
import type { CustomRelationTypeDTO } from "@/lib/relation-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Enregistrement..." : editing ? "Enregistrer" : "Créer le type"}
    </Button>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  ) : null;
}

// Creation ET modification d'un type de relation personnalise (KAN-84), sur
// le patron de CustomTypeForm (KAN-81) : `onSaved` appele DANS l'action, la
// boite de dialogue se ferme apres succes (les radios controles ne survivent
// donc jamais a la reinitialisation du formulaire par React 19). Le libelle
// inverse n'est rendu - donc poste - que pour un type dirige.
export function CustomRelationTypeForm({
  worldId,
  initial,
  onSaved,
}: {
  worldId: string;
  initial?: CustomRelationTypeDTO;
  onSaved: () => void;
}) {
  const editing = initial !== undefined;
  const [state, formAction] = useActionState<CustomRelationTypeFormState, FormData>(
    async (previous, formData) => {
      const next = await (
        editing ? updateCustomRelationTypeAction : createCustomRelationTypeAction
      )(previous, formData);
      if (next.ok) {
        onSaved();
      }
      return next;
    },
    {},
  );
  const [symmetric, setSymmetric] = useState<boolean>(initial?.symmetric ?? false);
  const prefix = initial ? `relation-type-${initial.id}` : "relation-type-new";
  const errorId = (field: string) => `${prefix}-${field}-error`;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="worldId" value={worldId} />
      {initial ? <input type="hidden" name="typeId" value={initial.id} /> : null}

      {state.formError ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${prefix}-label`}>Libellé</Label>
        <Input
          id={`${prefix}-label`}
          name="label"
          type="text"
          required
          maxLength={40}
          autoComplete="off"
          placeholder="Suzerain de"
          defaultValue={state.values?.label ?? initial?.label ?? ""}
          aria-invalid={state.errors?.label ? true : undefined}
          aria-describedby={state.errors?.label ? errorId("label") : undefined}
        />
        <FieldError id={errorId("label")} message={state.errors?.label} />
      </div>

      <fieldset
        className="flex flex-col gap-2"
        aria-describedby={state.errors?.symmetric ? errorId("symmetric") : undefined}
      >
        <legend className="mb-1.5 text-sm font-medium text-foreground">Sens</legend>
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="radio"
            name="symmetric"
            value="false"
            checked={!symmetric}
            onChange={() => setSymmetric(false)}
            className="mt-0.5 accent-primary"
          />
          <span>
            Dirigée
            <span className="block text-xs text-muted-foreground">
              Se lit autrement depuis l&apos;autre fiche (Suzerain de / Vassal de).
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="radio"
            name="symmetric"
            value="true"
            checked={symmetric}
            onChange={() => setSymmetric(true)}
            className="mt-0.5 accent-primary"
          />
          <span>
            Symétrique
            <span className="block text-xs text-muted-foreground">
              Se lit pareil depuis les deux fiches (Allié).
            </span>
          </span>
        </label>
        <FieldError id={errorId("symmetric")} message={state.errors?.symmetric} />
      </fieldset>

      {!symmetric ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefix}-inverse`}>Libellé inverse</Label>
          <Input
            id={`${prefix}-inverse`}
            name="inverseLabel"
            type="text"
            required
            maxLength={40}
            autoComplete="off"
            placeholder="Vassal de"
            defaultValue={state.values?.inverseLabel ?? initial?.inverseLabel ?? ""}
            aria-invalid={state.errors?.inverseLabel ? true : undefined}
            aria-describedby={`${prefix}-inverse-hint${
              state.errors?.inverseLabel ? ` ${errorId("inverseLabel")}` : ""
            }`}
          />
          <p id={`${prefix}-inverse-hint`} className="text-xs text-muted-foreground">
            Lu depuis la fiche cible de la relation.
          </p>
          <FieldError id={errorId("inverseLabel")} message={state.errors?.inverseLabel} />
        </div>
      ) : null}

      <div className="flex justify-end">
        <SubmitButton editing={editing} />
      </div>
    </form>
  );
}

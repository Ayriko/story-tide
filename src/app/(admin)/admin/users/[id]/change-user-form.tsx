"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { AdminUserFormState } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const initialState: AdminUserFormState = {};

function SubmitButton({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending} className="self-start">
      {pending ? "Enregistrement..." : label}
    </Button>
  );
}

// Formulaire commun aux deux changements de la fiche (plan, role) : un choix
// + une raison obligatoire, journalisee telle quelle. `field` sert de nom de
// champ ("plan" / "role") et de prefixe d'id, les deux formulaires vivant sur
// la meme page.
//
// `lockedReason` : formulaire affiche mais non soumettable (un administrateur
// ne retire pas son propre role). Le texte explique pourquoi ; la garde reelle
// est cote serveur (admin-user-service.ts), le bouton desactive n'est qu'un
// confort.
export function ChangeUserForm({
  action,
  userId,
  field,
  options,
  currentValue,
  selectLabel,
  reasonLabel,
  submitLabel,
  lockedReason,
}: {
  action: (state: AdminUserFormState, formData: FormData) => Promise<AdminUserFormState>;
  userId: string;
  field: "plan" | "role";
  options: readonly string[];
  currentValue: string;
  selectLabel: string;
  reasonLabel: string;
  submitLabel: string;
  lockedReason?: string;
}) {
  const [state, formAction] = useActionState(action, initialState);
  const locked = lockedReason !== undefined;
  const selectId = `${field}-value`;
  const reasonId = `${field}-reason`;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-3">
      <input type="hidden" name="userId" value={userId} />

      {state.formError ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="rounded-md bg-primary/10 px-3 py-2 text-sm text-foreground">
          {state.success}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={selectId}>{selectLabel}</Label>
        {/* key : apres un changement reussi, la fiche est revalidee et le
            select (non controle) repart de la nouvelle valeur courante. */}
        <Select key={currentValue} name={field} defaultValue={currentValue} disabled={locked}>
          <SelectTrigger
            id={selectId}
            className="w-48"
            aria-invalid={state.errors?.value ? true : undefined}
            aria-describedby={state.errors?.value ? `${selectId}-error` : undefined}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.value ? (
          <p id={`${selectId}-error`} className="text-sm text-destructive">
            {state.errors.value}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={reasonId}>{reasonLabel}</Label>
        <Textarea
          id={reasonId}
          name="reason"
          required
          minLength={5}
          maxLength={500}
          disabled={locked}
          defaultValue={state.values?.reason ?? ""}
          aria-invalid={state.errors?.reason ? true : undefined}
          aria-describedby={state.errors?.reason ? `${reasonId}-error` : undefined}
        />
        {state.errors?.reason ? (
          <p id={`${reasonId}-error`} className="text-sm text-destructive">
            {state.errors.reason}
          </p>
        ) : null}
      </div>

      {locked ? <p className="text-sm text-muted-foreground">{lockedReason}</p> : null}

      <SubmitButton label={submitLabel} disabled={locked} />
    </form>
  );
}

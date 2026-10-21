"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createCustomTypeAction,
  updateCustomTypeAction,
  type CustomTypeFormState,
} from "@/actions/world-settings";
import { ENTITY_TYPE_GROUPS, type EntityTypeGroup } from "@/lib/entity-schemas";
import { CUSTOM_TYPE_ICONS, GROUP_DEFAULT_ICON, type EntityTypeIconKey } from "@/lib/entity-types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ENTITY_TYPE_ICON } from "../../entity-type-icon";

// Libelle accessible de chaque icone de la grille (le nom de cle n'est pas
// un texte a lire).
const ICON_LABEL: Record<EntityTypeIconKey, string> = {
  user: "Personne",
  leaf: "Feuille",
  "map-pin": "Repère",
  shield: "Bouclier",
  wand: "Baguette",
  "book-open": "Livre",
  package: "Paquet",
  "sticky-note": "Note",
  crown: "Couronne",
  swords: "Épées",
  castle: "Château",
  mountain: "Montagne",
  ship: "Navire",
  rocket: "Fusée",
  skull: "Crâne",
  flame: "Flamme",
  gem: "Gemme",
  scroll: "Parchemin",
  feather: "Plume",
  moon: "Lune",
  sparkles: "Étincelles",
  eye: "Œil",
  key: "Clé",
  "paw-print": "Empreinte",
};

export const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-destructive";

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Enregistrement..." : editing ? "Enregistrer" : "Créer le type"}
    </Button>
  );
}

function isGroup(value: string): value is EntityTypeGroup {
  return (ENTITY_TYPE_GROUPS as readonly string[]).includes(value);
}

// Creation ET modification d'un type personnalise (KAN-81). `onSaved` est
// appele DANS l'action (transition), jamais depuis un effet : ferme la boite
// de dialogue englobante apres un enregistrement reussi.
export function CustomTypeForm({
  worldId,
  initial,
  onSaved,
}: {
  worldId: string;
  initial?: { id: string; label: string; group: string; icon: string };
  onSaved: () => void;
}) {
  const editing = initial !== undefined;
  const [state, formAction] = useActionState<CustomTypeFormState, FormData>(
    async (previous, formData) => {
      const next = await (editing ? updateCustomTypeAction : createCustomTypeAction)(
        previous,
        formData,
      );
      if (next.ok) {
        onSaved();
      }
      return next;
    },
    {},
  );

  const initialGroup = initial && isGroup(initial.group) ? initial.group : "Divers";
  const [group, setGroup] = useState<EntityTypeGroup>(initialGroup);
  // null = icone par defaut du groupe (suit le groupe tant que l'utilisateur
  // n'a rien choisi).
  const [chosenIcon, setChosenIcon] = useState<string | null>(initial?.icon ?? null);
  const icon = chosenIcon ?? GROUP_DEFAULT_ICON[group];
  const prefix = initial ? `custom-type-${initial.id}` : "custom-type-new";

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
          defaultValue={state.values?.label ?? initial?.label ?? ""}
          aria-invalid={state.errors?.label ? true : undefined}
          aria-describedby={state.errors?.label ? `${prefix}-label-error` : undefined}
        />
        {state.errors?.label ? (
          <p id={`${prefix}-label-error`} className="text-sm text-destructive">
            {state.errors.label}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${prefix}-group`}>Groupe</Label>
        <select
          id={`${prefix}-group`}
          name="group"
          value={group}
          onChange={(event) => {
            if (isGroup(event.target.value)) {
              setGroup(event.target.value);
            }
          }}
          aria-invalid={state.errors?.group ? true : undefined}
          aria-describedby={state.errors?.group ? `${prefix}-group-error` : undefined}
          className={SELECT_CLASS}
        >
          {ENTITY_TYPE_GROUPS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {state.errors?.group ? (
          <p id={`${prefix}-group-error`} className="text-sm text-destructive">
            {state.errors.group}
          </p>
        ) : null}
      </div>

      <fieldset
        className="flex flex-col gap-1.5"
        aria-describedby={state.errors?.icon ? `${prefix}-icon-error` : undefined}
      >
        <legend className="mb-1.5 text-sm font-medium text-foreground">Icône</legend>
        <div className="grid grid-cols-8 gap-1.5">
          {CUSTOM_TYPE_ICONS.map((key) => {
            const Icon = ENTITY_TYPE_ICON[key];
            const checked = icon === key;
            return (
              <label
                key={key}
                className={cn(
                  "flex size-9 cursor-pointer items-center justify-center rounded-md border has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                  checked
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                <input
                  type="radio"
                  name="icon"
                  value={key}
                  checked={checked}
                  onChange={() => setChosenIcon(key)}
                  className="sr-only"
                />
                <Icon aria-hidden="true" className="size-4" />
                <span className="sr-only">{ICON_LABEL[key]}</span>
              </label>
            );
          })}
        </div>
        {state.errors?.icon ? (
          <p id={`${prefix}-icon-error`} className="text-sm text-destructive">
            {state.errors.icon}
          </p>
        ) : null}
      </fieldset>

      <div className="flex justify-end">
        <SubmitButton editing={editing} />
      </div>
    </form>
  );
}

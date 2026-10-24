"use client";

import { useState, useTransition } from "react";
import {
  createDeclaredRelationAction,
  type DeclaredRelationFormState,
} from "@/actions/declared-relations";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  isSymmetricRelationType,
  linkFormFields,
  linkRelationTypeOptions,
  preselectRelation,
  type LinkDirection,
  type LinkEnd,
} from "@/lib/graph-link";
import {
  allRelationTypes,
  parseRelationChoice,
  relationChoiceValue,
  type WorldRelationTypeCatalog,
} from "@/lib/relation-types";
import { RelationTypeSelect } from "../entities/[entityId]/relation-type-select";

export type LinkEndpoint = LinkEnd & { name: string };

// Boite « Nouvelle relation » apres un trace entre deux etoiles (KAN-87).
// A = etoile de depart du geste, B = etoile d'arrivee. Le sens d'un type
// dirige est un choix explicite (deux options lisibles), jamais deduit du
// geste. Formulaire en onSubmit + useTransition et PAS <form action> :
// React 19 reinitialise un formulaire apres son action, une erreur (doublon)
// effacerait le type et le sens choisis.
export function RelationFromGraphDialog({
  worldId,
  worldSlug,
  catalog,
  a,
  b,
  onClose,
  onCreated,
}: {
  worldId: string;
  worldSlug: string;
  catalog: WorldRelationTypeCatalog;
  a: LinkEndpoint;
  b: LinkEndpoint;
  onClose: () => void;
  onCreated: () => void;
}) {
  const preselection = preselectRelation(a, b, catalog);
  const [typeKey, setTypeKey] = useState<string | null>(preselection?.key ?? null);
  const [direction, setDirection] = useState<LinkDirection>(preselection?.direction ?? "a-to-b");
  const [state, setState] = useState<DeclaredRelationFormState>({});
  const [isPending, startTransition] = useTransition();
  const options = linkRelationTypeOptions(catalog);
  const selectedType = typeKey
    ? allRelationTypes(catalog).find((type) => type.key === typeKey)
    : undefined;
  const directed = typeKey !== null && !isSymmetricRelationType(catalog, typeKey);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const fields = typeKey
        ? linkFormFields(a.id, b.id, typeKey, !directed, direction)
        : { entityId: a.id, otherId: b.id, choice: "" };
      const formData = new FormData();
      formData.set("worldId", worldId);
      formData.set("worldSlug", worldSlug);
      formData.set("entityId", fields.entityId);
      formData.set("otherId", fields.otherId);
      formData.set("choice", fields.choice);
      const result = await createDeclaredRelationAction({}, formData);
      setState(result);
      if (result.ok) {
        onCreated();
      }
    });
  }

  const errorMessage = state.formError ?? state.errors?.choice ?? state.errors?.otherId;
  const label = selectedType?.label ?? "";

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle relation</DialogTitle>
          <DialogDescription>
            Entre {a.name} et {b.name}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {errorMessage ? (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {errorMessage}
            </p>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="graph-relation-type">Type de relation</Label>
            <RelationTypeSelect
              id="graph-relation-type"
              options={options}
              defaultValue={
                preselection
                  ? relationChoiceValue({ key: preselection.key, viewpoint: "source" })
                  : undefined
              }
              onChange={(value) => {
                setTypeKey(parseRelationChoice(value)?.key ?? null);
                setState({});
              }}
            />
          </div>
          {directed ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium text-foreground">Sens</legend>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="radio"
                  name="direction"
                  value="a-to-b"
                  checked={direction === "a-to-b"}
                  onChange={() => setDirection("a-to-b")}
                  className="size-4 accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                />
                {a.name} — {label} → {b.name}
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="radio"
                  name="direction"
                  value="b-to-a"
                  checked={direction === "b-to-a"}
                  onChange={() => setDirection("b-to-a")}
                  className="size-4 accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                />
                {b.name} — {label} → {a.name}
              </label>
            </fieldset>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending} aria-busy={isPending}>
              {isPending ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

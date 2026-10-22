"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  deleteCustomRelationTypeAction,
  type WorldSettingsActionState,
} from "@/actions/world-settings";
import {
  allRelationTypes,
  customRelationTypeKey,
  type CustomRelationTypeDTO,
  type ResolvedRelationType,
  type WorldRelationTypeCatalog,
} from "@/lib/relation-types";
import type { CustomRelationTypeUsage } from "@/services/relation-type-service";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SELECT_CLASS } from "../types/custom-type-form";

function ConfirmButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={disabled || pending} aria-busy={pending}>
      {pending ? "Suppression..." : "Supprimer le type"}
    </Button>
  );
}

function optionLabel(type: ResolvedRelationType): string {
  const name = type.inverseLabel ? `${type.label} / ${type.inverseLabel}` : type.label;
  return type.isCustom ? `${name} (perso)` : name;
}

function TargetOptions({ targets }: { targets: ResolvedRelationType[] }) {
  return (
    <>
      <option value="">Choisir un type…</option>
      {targets.map((type) => (
        <option key={type.key} value={type.key}>
          {optionLabel(type)}
        </option>
      ))}
    </>
  );
}

// Suppression d'un type de relation personnalise (KAN-84). Avec relations :
// chaque relation recoit un type cible DE MEME NATURE (symetrique ->
// symetrique, dirige -> dirige : jamais de sens inverse en silence), choix
// global pre-remplissant chaque ligne. Une ligne dont la paire porte deja le
// type choisi est annoncee « deja presente : sera supprimee » avant
// validation. Cibles : tous les natifs de meme nature (y compris masques) et
// les autres types perso de meme nature.
export function DeleteCustomRelationTypeDialog({
  worldId,
  customType,
  usages,
  catalog,
}: {
  worldId: string;
  customType: CustomRelationTypeDTO;
  usages: CustomRelationTypeUsage[];
  catalog: WorldRelationTypeCatalog;
}) {
  const [state, formAction] = useActionState<WorldSettingsActionState, FormData>(
    deleteCustomRelationTypeAction,
    {},
  );
  const [globalTarget, setGlobalTarget] = useState("");
  const [targets, setTargets] = useState<Record<string, string>>({});
  const targetOf = (relationId: string) => targets[relationId] ?? "";
  const allTargeted = usages.every((usage) => targetOf(usage.id) !== "");
  const isDuplicate = (usage: CustomRelationTypeUsage) =>
    usage.existingTypeKeys.includes(targetOf(usage.id));
  const duplicateCount = usages.filter(isDuplicate).length;
  const candidates = allRelationTypes(catalog).filter(
    (type) =>
      type.symmetric === customType.symmetric && type.key !== customRelationTypeKey(customType.id),
  );
  const prefix = `delete-relation-type-${customType.id}`;
  const arrow = customType.symmetric ? "↔" : "→";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Supprimer le type ${customType.label}`}
        >
          Supprimer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer le type « {customType.label} » ?</DialogTitle>
          <DialogDescription>
            {usages.length === 0
              ? "Aucune relation n'utilise ce type."
              : `${usages.length} ${usages.length === 1 ? "relation utilise" : "relations utilisent"} ce type : choisis un type ${customType.symmetric ? "symétrique" : "dirigé"} pour chacune.`}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="worldId" value={worldId} />
          <input type="hidden" name="typeId" value={customType.id} />

          {state.formError ? (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {state.formError}
            </p>
          ) : null}

          {usages.length > 0 ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${prefix}-all`}>Réaffecter toutes ces relations à…</Label>
                <select
                  id={`${prefix}-all`}
                  value={globalTarget}
                  onChange={(event) => {
                    const value = event.target.value;
                    setGlobalTarget(value);
                    setTargets(Object.fromEntries(usages.map((usage) => [usage.id, value])));
                  }}
                  className={SELECT_CLASS}
                >
                  <TargetOptions targets={candidates} />
                </select>
              </div>

              <ul className="flex max-h-64 flex-col gap-3 overflow-y-auto themed-scrollbar">
                {usages.map((usage) => {
                  const duplicateId = `${prefix}-${usage.id}-duplicate`;
                  return (
                    <li key={usage.id} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor={`${prefix}-${usage.id}`} className="min-w-0 truncate">
                          {usage.sourceName} — {customType.label} {arrow} {usage.targetName}
                        </Label>
                        <select
                          id={`${prefix}-${usage.id}`}
                          name={`reassign:${usage.id}`}
                          value={targetOf(usage.id)}
                          onChange={(event) =>
                            setTargets((previous) => ({
                              ...previous,
                              [usage.id]: event.target.value,
                            }))
                          }
                          aria-describedby={isDuplicate(usage) ? duplicateId : undefined}
                          className={`${SELECT_CLASS} w-48 shrink-0`}
                        >
                          <TargetOptions targets={candidates} />
                        </select>
                      </div>
                      {isDuplicate(usage) ? (
                        <p id={duplicateId} className="text-xs text-muted-foreground">
                          Déjà présente : sera supprimée.
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>

              {duplicateCount > 0 ? (
                <p role="status" className="text-sm text-foreground">
                  {duplicateCount === 1
                    ? "1 relation existe déjà avec le type choisi : elle sera supprimée au lieu d'être dupliquée."
                    : `${duplicateCount} relations existent déjà avec le type choisi : elles seront supprimées au lieu d'être dupliquées.`}
                </p>
              ) : null}
            </>
          ) : null}

          <div className="flex justify-end">
            <ConfirmButton disabled={!allTargeted} />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

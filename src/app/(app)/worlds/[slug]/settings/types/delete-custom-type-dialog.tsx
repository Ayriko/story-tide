"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteCustomTypeAction, type WorldSettingsActionState } from "@/actions/world-settings";
import { groupedEntityTypes, ENTITY_TYPE_REFERENCE } from "@/lib/entity-schemas";
import { customTypeKey, type CustomEntityTypeDTO } from "@/lib/entity-types";
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
import { SELECT_CLASS } from "./custom-type-form";

function ConfirmButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={disabled || pending} aria-busy={pending}>
      {pending ? "Suppression..." : "Supprimer le type"}
    </Button>
  );
}

// Cibles de reaffectation (KAN-81) : TOUS les natifs (y compris masques - une
// entree peut garder un type masque) et les AUTRES types personnalises du
// monde, groupes par les 8 groupes.
function TargetOptions({ otherCustomTypes }: { otherCustomTypes: CustomEntityTypeDTO[] }) {
  return (
    <>
      <option value="">Choisir un type…</option>
      {groupedEntityTypes().map(({ group, types }) => (
        <optgroup key={group} label={group}>
          {types.map((type) => (
            <option key={type} value={type}>
              {ENTITY_TYPE_REFERENCE[type].label}
            </option>
          ))}
          {otherCustomTypes
            .filter((custom) => custom.group === group)
            .map((custom) => (
              <option key={custom.id} value={customTypeKey(custom.id)}>
                {custom.label} (perso)
              </option>
            ))}
        </optgroup>
      ))}
    </>
  );
}

// Suppression d'un type personnalise. Sans entree : confirmation simple.
// Avec entrees : chaque entree doit recevoir un type cible (choix global
// pre-remplissant chaque ligne, modifiable ligne par ligne) ; le bouton reste
// desactive tant qu'une entree n'a pas de cible. Le serveur revalide que la
// carte couvre EXACTEMENT les entrees du type au moment de l'appel.
export function DeleteCustomTypeDialog({
  worldId,
  customType,
  entries,
  otherCustomTypes,
}: {
  worldId: string;
  customType: CustomEntityTypeDTO;
  entries: { id: string; name: string }[];
  otherCustomTypes: CustomEntityTypeDTO[];
}) {
  const [state, formAction] = useActionState<WorldSettingsActionState, FormData>(
    deleteCustomTypeAction,
    {},
  );
  const [globalTarget, setGlobalTarget] = useState("");
  const [targets, setTargets] = useState<Record<string, string>>({});
  const targetOf = (entryId: string) => targets[entryId] ?? "";
  const allTargeted = entries.every((entry) => targetOf(entry.id) !== "");
  const prefix = `delete-type-${customType.id}`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        {/* Nom accessible complet, commencant par le texte visible (label
            dans le nom) : un bouton par ligne, chacun distinguable. */}
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
            {entries.length === 0
              ? "Aucune entrée n'utilise ce type."
              : `${entries.length} ${entries.length === 1 ? "entrée utilise" : "entrées utilisent"} ce type : choisis un nouveau type pour chacune.`}
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

          {entries.length > 0 ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${prefix}-all`}>Réaffecter toutes ces entrées à…</Label>
                <select
                  id={`${prefix}-all`}
                  value={globalTarget}
                  onChange={(event) => {
                    const value = event.target.value;
                    setGlobalTarget(value);
                    setTargets(Object.fromEntries(entries.map((entry) => [entry.id, value])));
                  }}
                  className={SELECT_CLASS}
                >
                  <TargetOptions otherCustomTypes={otherCustomTypes} />
                </select>
              </div>

              <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto themed-scrollbar">
                {entries.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3">
                    <Label htmlFor={`${prefix}-${entry.id}`} className="min-w-0 truncate">
                      {entry.name}
                    </Label>
                    <select
                      id={`${prefix}-${entry.id}`}
                      name={`reassign:${entry.id}`}
                      value={targetOf(entry.id)}
                      onChange={(event) =>
                        setTargets((previous) => ({ ...previous, [entry.id]: event.target.value }))
                      }
                      className={`${SELECT_CLASS} w-48 shrink-0`}
                    >
                      <TargetOptions otherCustomTypes={otherCustomTypes} />
                    </select>
                  </li>
                ))}
              </ul>
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

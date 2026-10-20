"use client";

import { useState } from "react";
import {
  customTypeKey,
  resolveEntityType,
  type CustomEntityTypeDTO,
  type WorldTypeCatalog,
} from "@/lib/entity-types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EntityTypeIcon } from "../../entity-type-icon";
import { CustomTypeForm } from "./custom-type-form";
import { DeleteCustomTypeDialog } from "./delete-custom-type-dialog";
import { entryCountLabel } from "./entry-count";

// Boite de dialogue controlee : fermee par le formulaire apres un
// enregistrement reussi (onSaved, appele dans l'action).
function CustomTypeDialog({
  worldId,
  initial,
  trigger,
  title,
}: {
  worldId: string;
  initial?: CustomEntityTypeDTO;
  trigger: React.ReactNode;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <CustomTypeForm worldId={worldId} initial={initial} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function CustomTypesSection({
  worldId,
  catalog,
  usage,
  entriesByType,
}: {
  worldId: string;
  catalog: WorldTypeCatalog;
  usage: Record<string, number>;
  entriesByType: Record<string, { id: string; name: string }[]>;
}) {
  return (
    <section aria-labelledby="custom-types-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2
            id="custom-types-heading"
            className="font-heading text-lg font-medium text-foreground"
          >
            Types personnalisés
          </h2>
          <p className="text-sm text-muted-foreground">
            Propres à ce monde, rangés dans l&apos;un des huit groupes.
          </p>
        </div>
        <CustomTypeDialog
          worldId={worldId}
          title="Nouveau type"
          trigger={<Button type="button">Nouveau type</Button>}
        />
      </div>

      {catalog.custom.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun type personnalisé pour le moment.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {catalog.custom.map((custom) => {
            const resolved = resolveEntityType(
              { type: "custom", customTypeId: custom.id },
              catalog,
            );
            return (
              <li key={custom.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <span className="flex min-w-0 items-center gap-2">
                  <EntityTypeIcon icon={resolved.icon} />
                  <span className="truncate text-sm font-medium text-foreground">
                    {resolved.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {resolved.group} · {entryCountLabel(usage[customTypeKey(custom.id)] ?? 0)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <CustomTypeDialog
                    worldId={worldId}
                    initial={custom}
                    title={`Modifier le type « ${custom.label} »`}
                    trigger={
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Modifier le type ${custom.label}`}
                      >
                        Modifier
                      </Button>
                    }
                  />
                  <DeleteCustomTypeDialog
                    worldId={worldId}
                    customType={custom}
                    entries={entriesByType[custom.id] ?? []}
                    otherCustomTypes={catalog.custom.filter((other) => other.id !== custom.id)}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

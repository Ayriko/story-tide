"use client";

import { useState } from "react";
import {
  customRelationTypeKey,
  type CustomRelationTypeDTO,
  type WorldRelationTypeCatalog,
} from "@/lib/relation-types";
import type { CustomRelationTypeUsage } from "@/services/relation-type-service";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CustomRelationTypeForm } from "./custom-relation-type-form";
import { DeleteCustomRelationTypeDialog } from "./delete-custom-relation-type-dialog";
import { relationCountLabel } from "./relation-count";

// Boite de dialogue controlee : fermee par le formulaire apres succes.
function CustomRelationTypeDialog({
  worldId,
  initial,
  trigger,
  title,
}: {
  worldId: string;
  initial?: CustomRelationTypeDTO;
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
        <CustomRelationTypeForm
          worldId={worldId}
          initial={initial}
          onSaved={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

export function CustomRelationTypesSection({
  worldId,
  catalog,
  usage,
  usagesByType,
}: {
  worldId: string;
  catalog: WorldRelationTypeCatalog;
  usage: Record<string, number>;
  usagesByType: Record<string, CustomRelationTypeUsage[]>;
}) {
  return (
    <section aria-labelledby="custom-relation-types-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2
            id="custom-relation-types-heading"
            className="font-heading text-lg font-medium text-foreground"
          >
            Types personnalisés
          </h2>
          <p className="text-sm text-muted-foreground">
            Propres à ce monde, symétriques ou dirigés.
          </p>
        </div>
        <CustomRelationTypeDialog
          worldId={worldId}
          title="Nouveau type de relation"
          trigger={<Button type="button">Nouveau type</Button>}
        />
      </div>

      {catalog.custom.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun type personnalisé pour le moment.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {catalog.custom.map((custom) => (
            <li key={custom.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                <span className="truncate text-sm font-medium text-foreground">{custom.label}</span>
                <span className="text-sm text-muted-foreground">
                  {custom.symmetric ? "(symétrique)" : `/ ${custom.inverseLabel ?? ""}`}
                </span>
                <span className="text-xs text-muted-foreground">
                  {relationCountLabel(usage[customRelationTypeKey(custom.id)] ?? 0)}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <CustomRelationTypeDialog
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
                <DeleteCustomRelationTypeDialog
                  worldId={worldId}
                  customType={custom}
                  usages={usagesByType[custom.id] ?? []}
                  catalog={catalog}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

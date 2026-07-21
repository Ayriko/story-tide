"use client";

import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DeleteEntityForm } from "./delete-entity-form";
import { EditEntityForm } from "./edit-entity-form";

// Dialog non controle (KAN-36 P2), declenche par une icone engrenage integree
// au cardHeader dense de la page d'entree (KAN-36 P4, worlds/[slug]/entities/
// [entityId]/page.tsx). Regroupe modifier + zone de danger - avant P2 ces deux
// formulaires vivaient empiles inline sur la page.
export function EntitySettingsDialog({
  worldId,
  worldSlug,
  entityId,
  name,
  type,
  aliases,
}: {
  worldId: string;
  worldSlug: string;
  entityId: string;
  name: string;
  type: string;
  aliases: string[];
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="Paramètres de l'entrée">
          <Settings aria-hidden="true" className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Paramètres de l&apos;entrée</DialogTitle>
        </DialogHeader>

        <EditEntityForm
          worldId={worldId}
          worldSlug={worldSlug}
          entityId={entityId}
          name={name}
          type={type}
          aliases={aliases}
        />

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <h3 className="font-heading text-sm font-medium text-foreground">Zone de danger</h3>
          <DeleteEntityForm worldId={worldId} worldSlug={worldSlug} entityId={entityId} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
import { DeleteWorldForm } from "./delete-world-form";
import { RenameWorldForm } from "./rename-world-form";

// Dialog non controle (KAN-36 P2), declenche par l'icone engrenage de la
// barre haute (world-shell.tsx). Regroupe renommer + zone de danger - avant
// P2 ces deux formulaires vivaient empiles inline sur la page du monde.
export function WorldSettingsDialog({
  worldId,
  worldName,
}: {
  worldId: string;
  worldName: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="Paramètres du monde">
          <Settings aria-hidden="true" className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Paramètres du monde</DialogTitle>
        </DialogHeader>

        <RenameWorldForm worldId={worldId} name={worldName} />

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <h3 className="font-heading text-sm font-medium text-foreground">Zone de danger</h3>
          <DeleteWorldForm worldId={worldId} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

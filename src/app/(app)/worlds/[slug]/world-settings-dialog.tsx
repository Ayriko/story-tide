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
// stayOnWorldsList (quick win 2.4, retour Aymeric) : quand ce dialogue est
// ouvert depuis /worlds (worlds/page.tsx), un renommage ne doit pas envoyer
// sur la page du monde - transmis tel quel a RenameWorldForm, absent =
// comportement d'origine (depuis la page du monde, world-shell.tsx).
export function WorldSettingsDialog({
  worldId,
  worldName,
  stayOnWorldsList = false,
}: {
  worldId: string;
  worldName: string;
  stayOnWorldsList?: boolean;
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

        <RenameWorldForm worldId={worldId} name={worldName} stayOnWorldsList={stayOnWorldsList} />

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <h3 className="font-heading text-sm font-medium text-foreground">Zone de danger</h3>
          <DeleteWorldForm worldId={worldId} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

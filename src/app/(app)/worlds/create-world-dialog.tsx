"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CreateWorldForm } from "./create-world-form";

// Dialog non controle (KAN-36 P2) : Radix gere seul l'ouverture/fermeture
// (Trigger, Esc, clic hors zone) - aucune fermeture programmatique requise,
// createWorldAction redirige au succes (demonte toute la page), reste
// simplement ouvert en cas d'echec (l'erreur s'affiche dans le formulaire).
export function CreateWorldDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button">+ Nouveau monde</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau monde</DialogTitle>
        </DialogHeader>
        <CreateWorldForm />
      </DialogContent>
    </Dialog>
  );
}

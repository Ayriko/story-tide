"use client";

import { cn } from "@/lib/utils";
import { Button, type buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { VariantProps } from "class-variance-authority";
import { CreateEntityForm } from "./create-entity-form";

// Dialog non controle (KAN-36 P2), meme raisonnement que create-world-dialog.tsx.
// Declenche depuis le bas de la sidebar (remplace l'ancre temporaire
// #create-entity-heading posee en P1) ET depuis la chip du dashboard
// (KAN-36 P3, meme precedent que triggerClassName sur UserMenu).
// triggerLabel a un defaut DIFFERENT de "+ Nouvelle entree" cote dashboard
// (passe explicitement par son appelant) : les deux declencheurs sont montes
// SIMULTANEMENT sur la page d'accueil du monde (sidebar + dashboard), un
// meme nom accessible sur les deux casserait `getByRole("button",{name:
// "+ Nouvelle entree"})` (violation "strict mode", plusieurs specs e2e
// existantes) - constate en e2e lors de l'ajout du dashboard, corrige ici
// plutot que de re-scoper 8 specs. triggerVariant (KAN-36 P3-bis) : la
// sidebar garde "outline", le dashboard passe "default" (MINT plein).
// triggerTestId (lexique produit, avant P4) : ce bouton (accessible via son
// TEXTE dans 8 specs e2e) a deja casse deux fois cette session sur un
// changement de libelle - data-testid stable plutot qu'un texte qui
// continuera de bouger avec le wording produit.
export function CreateEntityDialog({
  worldId,
  worldSlug,
  triggerClassName,
  triggerLabel = "+ Nouvelle entrée",
  triggerVariant = "outline",
  triggerTestId = "create-entity-trigger",
}: {
  worldId: string;
  worldSlug: string;
  triggerClassName?: string;
  triggerLabel?: string;
  triggerVariant?: VariantProps<typeof buttonVariants>["variant"];
  triggerTestId?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={triggerVariant}
          className={cn("w-full", triggerClassName)}
          data-testid={triggerTestId}
        >
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle entrée</DialogTitle>
        </DialogHeader>
        <CreateEntityForm worldId={worldId} worldSlug={worldSlug} />
      </DialogContent>
    </Dialog>
  );
}

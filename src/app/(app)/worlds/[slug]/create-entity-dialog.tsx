"use client";

import type { ReactElement } from "react";
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
// Declenche depuis la sidebar ET depuis la chip du dashboard (KAN-36 P3) :
// les deux declencheurs sont montes SIMULTANEMENT sur la page d'accueil du
// monde, d'ou triggerLabel/triggerVariant distincts par appelant et
// triggerTestId stable (evite une collision getByRole "strict mode" entre
// les 8 specs e2e qui ciblaient auparavant le texte du bouton).
// Constellation (KAN-87) : `trigger` remplace le bouton par defaut (bouton
// rond + infobulle) et `open`/`onOpenChange` rendent la boite pilotable par
// le raccourci N ; sans eux, comportement inchange (sidebar).
export function CreateEntityDialog({
  worldId,
  worldSlug,
  triggerClassName,
  triggerLabel = "+ Nouvelle entrée",
  triggerVariant = "outline",
  triggerTestId = "create-entity-trigger",
  trigger,
  open,
  onOpenChange,
}: {
  worldId: string;
  worldSlug: string;
  triggerClassName?: string;
  triggerLabel?: string;
  triggerVariant?: VariantProps<typeof buttonVariants>["variant"];
  triggerTestId?: string;
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            type="button"
            variant={triggerVariant}
            className={cn("w-full", triggerClassName)}
            data-testid={triggerTestId}
          >
            {triggerLabel}
          </Button>
        )}
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

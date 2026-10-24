"use client";

import { useState } from "react";
import { LayoutGrid, Maximize, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function ControlButton({
  label,
  shortcut,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={label} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">{shortcut ? `${label} (${shortcut})` : label}</TooltipContent>
    </Tooltip>
  );
}

// Barre de controles flottante (KAN-87) : vrais boutons, libelle accessible,
// infobulle avec le raccourci (+, -, 0 sans modificateur, actifs seulement
// quand la zone du graphe a le focus - constellation.tsx).
export function GraphControls({
  onZoomIn,
  onZoomOut,
  onFit,
  onReorganize,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReorganize: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={300}>
      <div
        role="toolbar"
        aria-label="Contrôles de la vue"
        aria-orientation="vertical"
        className="flex flex-col gap-0.5 rounded-md border border-border bg-card/90 p-0.5 shadow-lg backdrop-blur-sm"
      >
        <ControlButton label="Zoom avant" shortcut="+" onClick={onZoomIn}>
          <Plus aria-hidden="true" className="size-4" />
        </ControlButton>
        <ControlButton label="Zoom arrière" shortcut="-" onClick={onZoomOut}>
          <Minus aria-hidden="true" className="size-4" />
        </ControlButton>
        <ControlButton label="Ajuster à l'écran" shortcut="0" onClick={onFit}>
          <Maximize aria-hidden="true" className="size-4" />
        </ControlButton>
        <ControlButton label="Réorganiser automatiquement" onClick={() => setConfirmOpen(true)}>
          <LayoutGrid aria-hidden="true" className="size-4" />
        </ControlButton>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Réorganiser la Constellation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Toutes les étoiles sont replacées automatiquement. Vous pourrez annuler juste après.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            {/* AlertDialogAction suffit ici : la reorganisation est locale et
                immediate, la sauvegarde suit en tache de fond. */}
            <AlertDialogAction onClick={onReorganize}>Réorganiser</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}

"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Pin } from "lucide-react";
import { pinWorldAction, type WorldPinState } from "@/actions/world";
import { Button } from "@/components/ui/button";

const initialState: WorldPinState = {};

// Rempli vs contour (jamais la seule couleur, retour bêta) : meme icone Pin,
// fill="currentColor" seulement a l'etat epingle - une difference de forme
// (silhouette pleine/vide), pas seulement de teinte, perceptible sans
// distinguer les couleurs. aria-pressed + aria-label explicite couvrent le
// lecteur d'ecran.
function ToggleButton({ pinned }: { pinned: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="ghost"
      size="icon"
      disabled={pending}
      aria-pressed={pinned}
      aria-label={pinned ? "Désépingler ce monde" : "Épingler ce monde"}
    >
      <Pin aria-hidden="true" className="size-4" fill={pinned ? "currentColor" : "none"} />
    </Button>
  );
}

// Reste sur /worlds (pas de redirection, pinWorldAction) : le formulaire
// porte l'etat AVANT clic dans un champ cache, jamais une simple negation
// cote client - source de verite unique, le service (world-service.ts).
export function PinWorldToggle({ worldId, pinned }: { worldId: string; pinned: boolean }) {
  const [state, formAction] = useActionState(pinWorldAction, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="worldId" value={worldId} />
      <input type="hidden" name="pinned" value={pinned ? "true" : "false"} />
      <ToggleButton pinned={pinned} />
      {state.formError ? (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {state.formError}
        </p>
      ) : null}
    </form>
  );
}

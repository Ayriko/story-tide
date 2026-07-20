"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { deleteWorldAction, type WorldDeleteState } from "@/actions/world";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const initialState: WorldDeleteState = {};

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    // Bouton simple (PAS AlertDialogAction) : AlertDialogAction n'est qu'un
    // Dialog.Close deguise - son clic fermerait la boite IMMEDIATEMENT,
    // avant meme que l'action serveur asynchrone n'ait pu echouer et afficher
    // son erreur dans une boite alors deja fermee. Un Button ordinaire laisse
    // la boite ouverte pendant/apres la soumission : succes = redirect
    // (actions/world.ts) demonte tout, echec = l'erreur reste visible ici.
    <Button type="submit" disabled={pending} aria-busy={pending} variant="destructive">
      {pending ? "Suppression..." : "Confirmer la suppression"}
    </Button>
  );
}

// AlertDialog (Radix : focus trap, Esc, aria) remplace le pattern "confirming
// state + 2 boutons" (KAN-36 P2) - meme garantie qu'avant (jamais de
// window.confirm bloquant, confirmation explicite avant une suppression
// irreversible), fournie nativement par le composant plutot que reimplementee.
export function DeleteWorldForm({ worldId }: { worldId: string }) {
  const [state, formAction] = useActionState(deleteWorldAction, initialState);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline">
          Supprimer ce monde
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer ce monde ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est irréversible : le monde et son contenu seront définitivement supprimés.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form action={formAction}>
          <input type="hidden" name="worldId" value={worldId} />

          {state.formError ? (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {state.formError}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <ConfirmButton />
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

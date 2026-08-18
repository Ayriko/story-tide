"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Champ mot de passe avec bascule afficher/masquer (KAN-52). Partage par les
// trois formulaires d'authentification : une bascule presente ici et absente
// ailleurs se remarquerait immediatement.
//
// Choix d'accessibilite : bouton NATIF dont le libelle change ("Afficher" /
// "Masquer") plutot qu'un libelle fixe avec aria-pressed - un lecteur d'ecran
// annonce alors directement l'action disponible, sans avoir a interpreter un
// etat. `aria-controls` relie explicitement la bascule au champ qu'elle pilote.
// Le bouton porte type="button" : sans lui, il soumettrait le formulaire.
export function PasswordInput({
  id,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type"> & { id: string }) {
  const [visible, setVisible] = useState(false);
  const Icone = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        // Place pour le bouton, sans jamais recouvrir le texte saisi.
        className={cn("pr-9", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((etat) => !etat)}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-controls={id}
        className="absolute top-1/2 right-1 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Icone aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

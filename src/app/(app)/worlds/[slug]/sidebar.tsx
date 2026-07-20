import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { EntitySearchResult } from "@/services/entity-service";
import { EntitySearch } from "./entity-search";

// Sidebar (KAN-36 P1-ter, reference-vvd.md §6) : carte verticale flottante
// (meme langage visuel que la carte centrale - Card, coins arrondis, ombre,
// fond translucide), plus un panneau plein hauteur colle aux bords. Reutilise
// EntitySearch tel quel (KAN-17, recherche + liste par defaut sur
// initialEntities) - aucune nouvelle logique de recherche.
//
// Le repli/depli (largeur animee, Ctrl+B, persistance) vit dans le wrapper
// client world-shell.tsx - ce composant reste un pur rendu de contenu,
// toujours a sa largeur naturelle ; c'est le CONTENEUR autour de lui qui
// anime sa visibilite.
//
// "+ Nouvelle fiche" reste temporairement un lien d'ancrage vers le
// formulaire encore INLINE sur la page (worlds/[slug]/page.tsx) - P1 est le
// shell seul, la bascule en Dialog shadcn est P2a. A remplacer par un vrai
// trigger de Dialog a ce moment-la (ne pas dupliquer le formulaire ici).
//
// Le menu utilisateur ne vit plus ici (deplace dans la TopBar, P1-ter) -
// jamais duplique entre les deux endroits.
export function Sidebar({
  worldId,
  worldSlug,
  entities,
}: {
  worldId: string;
  worldSlug: string;
  entities: EntitySearchResult[];
}) {
  return (
    <Card className="flex h-full w-72 flex-col gap-4 border-none bg-card/70 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl">
      <nav aria-label="Fiches du monde" className="min-h-0 flex-1 overflow-y-auto">
        <EntitySearch worldId={worldId} worldSlug={worldSlug} initialEntities={entities} />
      </nav>

      <Button asChild variant="outline" className="w-full shrink-0">
        <Link href={`/worlds/${worldSlug}#create-entity-heading`}>+ Nouvelle fiche</Link>
      </Button>
    </Card>
  );
}

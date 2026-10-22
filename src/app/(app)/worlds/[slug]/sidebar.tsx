import Link from "next/link";
import { Settings2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { EntityListItem, FolderTreeView } from "@/lib/entity-types";
import { CreateEntityDialog } from "./create-entity-dialog";
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
// "+ Nouvelle fiche" ouvre desormais un Dialog (KAN-36 P2, create-entity-dialog.tsx)
// - remplace l'ancre temporaire #create-entity-heading posee en P1.
//
// Le menu utilisateur ne vit plus ici (deplace dans la TopBar, P1-ter) -
// jamais duplique entre les deux endroits.
export function Sidebar({
  worldId,
  worldSlug,
  entities,
  folderTree,
  unfiledEntities,
}: {
  worldId: string;
  worldSlug: string;
  entities: EntityListItem[];
  folderTree: FolderTreeView[];
  unfiledEntities: EntityListItem[];
}) {
  return (
    <Card className="flex h-full w-72 flex-col gap-4 border-none bg-card/70 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl">
      <nav
        aria-label="Entrées du monde"
        // -mx-1 px-1 : overflow-y-auto force overflow-x a "auto" aussi (regle
        // CSS overflow-x/-y), qui coupe l'anneau de focus (outline-offset-2,
        // 4px de debord) des elements pleine largeur (bouton de groupe, Link
        // d'entree) - la marge compense exactement le debord sans decaler le
        // contenu visuellement.
        className="min-h-0 flex-1 -mx-1 overflow-y-auto px-1 themed-scrollbar"
      >
        <EntitySearch
          worldId={worldId}
          worldSlug={worldSlug}
          initialEntities={entities}
          folderTree={folderTree}
          unfiledEntities={unfiledEntities}
        />
      </nav>

      <CreateEntityDialog worldId={worldId} worldSlug={worldSlug} />

      {/* Acces permanent aux parametres du monde (KAN-81), en pied de
          sidebar sur toutes les pages du monde - remplace l'engrenage de la
          barre haute, avec le menu du titre du dashboard. */}
      <Link
        href={`/worlds/${worldSlug}/settings`}
        className="-mt-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Settings2 aria-hidden="true" className="size-4" />
        Paramètres du monde
      </Link>
    </Card>
  );
}

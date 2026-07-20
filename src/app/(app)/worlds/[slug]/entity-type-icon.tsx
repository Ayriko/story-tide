import {
  BookOpen,
  Leaf,
  MapPin,
  Package,
  Shield,
  StickyNote,
  User,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { entityTypeGroup, type EntityTypeGroup } from "@/lib/entity-schemas";
import { cn } from "@/lib/utils";

// Extrait d'entity-search.tsx (KAN-36 P3) : reutilise par la page serveur du
// dashboard (fiches recentes) en plus de la sidebar - aucun "use client" ici,
// une icone lucide est du SVG pur, rendable en RSC.
//
// Icone PAR GROUPE (8 familles), pas par type individuel - meme rationale que
// la couleur des noeuds du graphe (26 icones distinctes n'apporterait rien de
// plus lisible, cf. entity-schemas.ts). Le libelle textuel du type reste
// affiche a cote (jamais l'icone seule - RGAA, l'info n'est pas dans la
// couleur/forme seule).
const GROUP_ICON: Record<EntityTypeGroup, LucideIcon> = {
  Personnages: User,
  Écologie: Leaf,
  Lieux: MapPin,
  Organisation: Shield,
  Magie: Wand2,
  Lore: BookOpen,
  Objets: Package,
  Divers: StickyNote,
};

export function EntityTypeIcon({ type, className }: { type: string; className?: string }) {
  const group = entityTypeGroup(type);
  const Icon = group ? GROUP_ICON[group] : StickyNote;
  return (
    <Icon aria-hidden="true" className={cn("size-4 shrink-0 text-muted-foreground", className)} />
  );
}

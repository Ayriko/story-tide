import {
  BookOpen,
  Castle,
  Crown,
  Eye,
  Feather,
  Flame,
  Gem,
  KeyRound,
  Leaf,
  MapPin,
  Moon,
  Mountain,
  Package,
  PawPrint,
  Rocket,
  Scroll,
  Shield,
  Ship,
  Skull,
  Sparkles,
  StickyNote,
  Swords,
  User,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import type { EntityTypeIconKey } from "@/lib/entity-types";
import { cn } from "@/lib/utils";

// Extrait d'entity-search.tsx (KAN-36 P3) : reutilise par la page serveur du
// dashboard (fiches recentes) en plus de la sidebar - aucun "use client" ici,
// une icone lucide est du SVG pur, rendable en RSC.
//
// Icone resolue (KAN-81) : celle du GROUPE pour un type natif (8 familles,
// meme rationale que la couleur des noeuds du graphe), celle choisie pour un
// type personnalise (liste fermee CUSTOM_TYPE_ICONS, entity-types.ts). Le
// libelle textuel du type reste affiche a cote (jamais l'icone seule - RGAA,
// l'info n'est pas dans la couleur/forme seule).
export const ENTITY_TYPE_ICON: Record<EntityTypeIconKey, LucideIcon> = {
  user: User,
  leaf: Leaf,
  "map-pin": MapPin,
  shield: Shield,
  wand: Wand2,
  "book-open": BookOpen,
  package: Package,
  "sticky-note": StickyNote,
  crown: Crown,
  swords: Swords,
  castle: Castle,
  mountain: Mountain,
  ship: Ship,
  rocket: Rocket,
  skull: Skull,
  flame: Flame,
  gem: Gem,
  scroll: Scroll,
  feather: Feather,
  moon: Moon,
  sparkles: Sparkles,
  eye: Eye,
  key: KeyRound,
  "paw-print": PawPrint,
};

export function EntityTypeIcon({
  icon,
  className,
}: {
  icon: EntityTypeIconKey;
  className?: string;
}) {
  const Icon = ENTITY_TYPE_ICON[icon];
  return (
    <Icon aria-hidden="true" className={cn("size-4 shrink-0 text-muted-foreground", className)} />
  );
}

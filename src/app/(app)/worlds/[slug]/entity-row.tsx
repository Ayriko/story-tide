import { resolveEntityType } from "@/lib/entity-types";
import { Card } from "@/components/ui/card";
import { EntityTypeIcon } from "./entity-type-icon";
import { useWorldTypeCatalog } from "./world-type-catalog";

// Carte visuelle d'une entite, extraite de la vue Types (entity-search.tsx)
// pour etre partagee par les DEUX nouveaux chemins de KAN-57 (liste plate en
// recherche + feuilles de l'arbre) - la vue Types garde sa propre copie
// inline intacte, jamais touchee par cette extraction (aucune abstraction
// imposee sur du code deja existant et qui fonctionne).
//
// Rendu uniquement depuis des Client Components (entity-search.tsx) : lit le
// catalogue des types du monde (KAN-81) dans le contexte.
export function EntityRow({
  entity,
}: {
  entity: { id: string; name: string; type: string; customTypeId: string | null };
}) {
  const resolved = resolveEntityType(entity, useWorldTypeCatalog());
  return (
    <Card className="flex-row items-center justify-between px-4 py-3 transition-colors hover:bg-accent">
      <span className="flex min-w-0 items-center gap-2">
        <EntityTypeIcon icon={resolved.icon} />
        <span className="truncate text-sm font-medium text-foreground">{entity.name}</span>
      </span>
      <span className="shrink-0 text-xs font-normal text-muted-foreground">{resolved.label}</span>
    </Card>
  );
}

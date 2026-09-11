import { entityTypeLabel } from "@/lib/entity-schemas";
import { Card } from "@/components/ui/card";
import { EntityTypeIcon } from "./entity-type-icon";

// Carte visuelle d'une entite, extraite de la vue Types (entity-search.tsx)
// pour etre partagee par les DEUX nouveaux chemins de KAN-57 (liste plate en
// recherche + feuilles de l'arbre) - la vue Types garde sa propre copie
// inline intacte, jamais touchee par cette extraction (aucune abstraction
// imposee sur du code deja existant et qui fonctionne).
export function EntityRow({ entity }: { entity: { id: string; name: string; type: string } }) {
  return (
    <Card className="flex-row items-center justify-between px-4 py-3 transition-colors hover:bg-accent">
      <span className="flex min-w-0 items-center gap-2">
        <EntityTypeIcon type={entity.type} />
        <span className="truncate text-sm font-medium text-foreground">{entity.name}</span>
      </span>
      <span className="shrink-0 text-xs font-normal text-muted-foreground">
        {entityTypeLabel(entity.type)}
      </span>
    </Card>
  );
}

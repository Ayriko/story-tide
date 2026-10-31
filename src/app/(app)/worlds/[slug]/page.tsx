import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSessionOrRedirect } from "@/lib/auth-session";
import { WorldNotFoundError, getWorldBySlug } from "@/services/world-service";
import { listEntities } from "@/services/entity-service";
import { listWorldRelations } from "@/services/relation-service";
import { listWorldDeclaredRelations } from "@/services/declared-relation-service";
import { getWorldTypeCatalog } from "@/services/entity-type-service";
import { getDefaultBoardLayout } from "@/services/board-service";
import { getWorldRelationTypeCatalog } from "@/services/relation-type-service";
import { buildAccessibleGraphEntries, buildGraphElements } from "@/lib/graph-elements";
import { ENTITY_TYPE_GROUPS } from "@/lib/entity-schemas";
import { resolveEntityType } from "@/lib/entity-types";
import { EntityTypeIcon } from "./entity-type-icon";
import { Constellation } from "./graph/constellation";
import { WorldTitleMenu } from "./world-title-menu";

const RECENT_LIMIT = 5;

// Libelle singulier/pluriel par groupe (KAN-36 P3-bis), pour la ligne de
// compteurs de la carte du monde uniquement ("1 personnage", "3 lieux"...) -
// ENTITY_TYPE_GROUPS (entity-schemas.ts) n'expose que des noms de groupe au
// pluriel/collectif ("Personnages", "Organisation") impropres a un accord
// grammatical direct. Table locale a cet usage textuel, aucune modification
// de entity-schemas.ts.

// Page d'un monde = la Constellation en plein cadre (KAN-87, ADR-0032). Le
// contenu de l'ancien tableau de bord (KAN-36 P3/P3-bis, reference-vvd.md
// « De retour à l'œuvre ») vit dans le panneau lateral repliable, rendu ici
// cote serveur et passe en `panel`. Disposition (places, zoom, cadrage) lue
// dans le tableau par defaut du monde, cree a la demande. Le tri "recent" est
// un tri DE LECTURE fait ici (page), EntityRecord porte deja updatedAt -
// listEntities elle-meme reste triee par createdAt (sidebar/graphe inchanges).
export default async function WorldPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await requireSessionOrRedirect();

  let world;
  try {
    world = await getWorldBySlug(session.user.id, slug);
  } catch (error) {
    if (error instanceof WorldNotFoundError) {
      notFound();
    }
    throw error;
  }

  const [entities, relations, typeCatalog, declaredRelations, layout, relationCatalog] =
    await Promise.all([
      listEntities(session.user.id, world.id),
      listWorldRelations(session.user.id, world.id),
      getWorldTypeCatalog(session.user.id, world.id),
      listWorldDeclaredRelations(session.user.id, world.id),
      getDefaultBoardLayout(session.user.id, world.id),
      getWorldRelationTypeCatalog(session.user.id, world.id),
    ]);

  // Type resolu une fois par entree (KAN-81) : recent, graphe et compteurs
  // lisent la meme resolution.
  const resolvedEntities = entities.map((entity) => ({
    entity,
    resolved: resolveEntityType(entity, typeCatalog),
  }));

  const recent = [...resolvedEntities]
    .sort((a, b) => b.entity.updatedAt.getTime() - a.entity.updatedAt.getTime())
    .slice(0, RECENT_LIMIT);

  const entityInputs = resolvedEntities.map(({ entity, resolved }) => ({
    id: entity.id,
    name: entity.name,
    typeKey: resolved.key,
    typeLabel: resolved.label,
    group: resolved.group,
    icon: resolved.icon,
  }));
  const elements = buildGraphElements(entityInputs, relations, declaredRelations);
  const accessibleEntries = buildAccessibleGraphEntries(entityInputs, relations, declaredRelations);
  // Map -> tableau simple : seule une donnee JSON franchit la frontiere RSC.
  const initialPositions = [...layout.positions].map(([entityId, { x, y }]) => ({
    entityId,
    x,
    y,
  }));

  // Total sous le titre et legende du ciel (une ligne par groupe non vide)
  // dans le menu du titre (KAN-85).
  const countsByGroup = new Map<string, number>();
  for (const { resolved } of resolvedEntities) {
    countsByGroup.set(resolved.group, (countsByGroup.get(resolved.group) ?? 0) + 1);
  }
  const legend = ENTITY_TYPE_GROUPS.map((group) => ({
    group,
    count: countsByGroup.get(group) ?? 0,
  })).filter(({ count }) => count > 0);

  // Titre du monde pose sur le canvas (haut gauche) ; liste des dernieres
  // entrees pour le panneau « Recents ».
  const title = (
    <WorldTitleMenu
      worldName={world.name}
      worldSlug={world.slug}
      total={entities.length}
      legend={legend}
    />
  );
  const recentList =
    recent.length === 0 ? (
      <p className="text-xs text-foreground">Vos entrées apparaîtront ici.</p>
    ) : (
      <ul className="flex flex-col">
        {recent.map(({ entity, resolved }) => (
          <li key={entity.id}>
            <Link
              href={`/worlds/${world.slug}/entities/${entity.id}`}
              className="flex items-center gap-2 rounded-sm py-0.5 text-sm text-foreground hover:text-link focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <EntityTypeIcon icon={resolved.icon} className="size-4 shrink-0" />
              <span className="truncate">{entity.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    );

  return (
    <Constellation
      worldId={world.id}
      worldSlug={world.slug}
      elements={elements}
      entities={entityInputs.map(({ id, name, typeLabel, icon }) => ({
        id,
        name,
        typeLabel,
        icon,
      }))}
      accessibleEntries={accessibleEntries}
      initialViewport={layout.viewport}
      initialPositions={initialPositions}
      relationCatalog={relationCatalog}
      title={title}
      recent={recentList}
    />
  );
}

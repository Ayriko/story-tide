import Link from "next/link";
import { notFound } from "next/navigation";
import { Lightbulb, Maximize2 } from "lucide-react";
import { requireSessionOrRedirect } from "@/lib/auth-session";
import { WorldNotFoundError, getWorldBySlug } from "@/services/world-service";
import { listEntities } from "@/services/entity-service";
import { listWorldRelations } from "@/services/relation-service";
import { buildGraphElements } from "@/lib/graph-elements";
import { ENTITY_TYPE_GROUPS, entityTypeGroup, entityTypeLabel } from "@/lib/entity-schemas";
import type { EntityTypeGroup } from "@/lib/entity-schemas";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CreateEntityDialog } from "./create-entity-dialog";
import { DashboardSearchChip } from "./dashboard-search-chip";
import { EntityTypeIcon } from "./entity-type-icon";
import { GraphView } from "./graph/graph-view";

const RECENT_LIMIT = 8;
// Hauteur partagee par les deux colonnes du corps (KAN-36 P3-bis) - une
// valeur fixe identique des deux cotes plutot qu'un stretch CSS Grid : plus
// simple et deterministe, aucune dependance a un h-full en cascade dans
// GraphView (qui reste, lui, inchange sur /graph).
const PANEL_HEIGHT = "h-[26rem]";

// Rotation statique (KAN-36 P3d), zero infra : un conseil par jour du mois,
// choisi de facon deterministe (pas de state client, pas de risque
// d'hydratation - rendu entierement cote serveur). Registre "tissage"
// (lexique produit, avant P4) pour les astuces qui parlent de liaison
// automatique - "Ignorer ce lien" garde son nom exact (bouton non renomme).
const TIPS = [
  "Les fils se tissent à mesure que vous écrivez.",
  "Tape « @ » dans l'éditeur pour mentionner une entrée existante — le fil se tisse tout seul.",
  "Les alias d'une entrée comptent aussi pour le tissage automatique, pas seulement son nom.",
  "« Ignorer ce lien » défait un fil tissé automatiquement — il ne se retissera pas tout seul au prochain passage.",
];

// Libelle singulier/pluriel par groupe (KAN-36 P3-bis), pour la ligne de
// compteurs en pied de carte uniquement ("1 personnage", "3 lieux"...) -
// ENTITY_TYPE_GROUPS (entity-schemas.ts) n'expose que des noms de groupe au
// pluriel/collectif ("Personnages", "Organisation") impropres a un accord
// grammatical direct. Table locale a cet usage textuel, aucune modification
// de entity-schemas.ts.
const GROUP_LABEL: Record<EntityTypeGroup, { singular: string; plural: string }> = {
  Personnages: { singular: "personnage", plural: "personnages" },
  Écologie: { singular: "être vivant", plural: "êtres vivants" },
  Lieux: { singular: "lieu", plural: "lieux" },
  Organisation: { singular: "organisation", plural: "organisations" },
  Magie: { singular: "élément magique", plural: "éléments magiques" },
  Lore: { singular: "élément de lore", plural: "éléments de lore" },
  Objets: { singular: "objet", plural: "objets" },
  Divers: { singular: "entrée diverse", plural: "entrées diverses" },
};

const shortDateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const longDateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

// Dashboard de monde (KAN-36 P3/P3-bis, reference-vvd.md « De retour à
// l'œuvre ») : remplace le placeholder minimal pose en P1/P2 (lien temporaire
// vers le graphe + paragraphe d'aide). Meme patron de fetch que
// graph/page.tsx (listEntities + listWorldRelations, deja utilises ailleurs -
// aucun nouvel appel de service). Le tri "recent" est un tri DE LECTURE fait
// ici (page), EntityRecord porte deja updatedAt (Entity & { aliases }) -
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

  const [entities, relations] = await Promise.all([
    listEntities(session.user.id, world.id),
    listWorldRelations(session.user.id, world.id),
  ]);

  const recent = [...entities]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, RECENT_LIMIT);

  const entityInputs = entities.map((entity) => ({
    id: entity.id,
    name: entity.name,
    type: entity.type,
  }));
  const elements = buildGraphElements(entityInputs, relations);

  const countsByGroup = new Map<string, number>();
  for (const entity of entities) {
    const group = entityTypeGroup(entity.type) ?? "Divers";
    countsByGroup.set(group, (countsByGroup.get(group) ?? 0) + 1);
  }
  const lastUpdate = entities.reduce<Date | null>(
    (latest, entity) => (!latest || entity.updatedAt > latest ? entity.updatedAt : latest),
    null,
  );

  const tip = TIPS[new Date().getDate() % TIPS.length];

  const footerSegments: string[] = [];
  if (entities.length > 0) {
    footerSegments.push(`${entities.length} ${entities.length === 1 ? "entrée" : "entrées"}`);
    for (const group of ENTITY_TYPE_GROUPS) {
      const count = countsByGroup.get(group) ?? 0;
      if (count === 0) {
        continue;
      }
      const label = count === 1 ? GROUP_LABEL[group].singular : GROUP_LABEL[group].plural;
      footerSegments.push(`${count} ${label}`);
    }
    if (lastUpdate) {
      footerSegments.push(`modifié le ${longDateFormat.format(lastUpdate)}`);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-4xl font-medium text-foreground">{world.name}</h1>
          <p className="text-sm text-muted-foreground">De retour à l&apos;œuvre.</p>
        </div>
        <div className="flex items-center gap-2">
          <CreateEntityDialog
            worldId={world.id}
            worldSlug={world.slug}
            triggerClassName="w-auto"
            triggerLabel="Nouvelle entrée"
            triggerVariant="default"
            triggerTestId="dashboard-create-entity-trigger"
          />
          <DashboardSearchChip />
        </div>
      </div>

      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lightbulb aria-hidden="true" className="size-4 shrink-0" />
        {tip}
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        <section
          aria-labelledby="recent-entities-heading"
          className="flex flex-col gap-3 lg:col-span-1"
        >
          <h2
            id="recent-entities-heading"
            className="font-heading text-lg font-medium text-foreground"
          >
            Dernières entrées
          </h2>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Vos entrées apparaîtront ici.</p>
          ) : (
            <div className={`${PANEL_HEIGHT} overflow-y-auto`}>
              <ul className="flex flex-col gap-2 p-2">
                {recent.map((entity) => (
                  <li key={entity.id}>
                    <Link
                      href={`/worlds/${world.slug}/entities/${entity.id}`}
                      className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <Card className="flex-row items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent">
                        <span className="flex min-w-0 items-center gap-2">
                          <EntityTypeIcon type={entity.type} className="size-5" />
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-medium text-foreground">
                              {entity.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {entityTypeLabel(entity.type)}
                            </span>
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {shortDateFormat.format(entity.updatedAt)}
                        </span>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section
          aria-labelledby="graph-panel-heading"
          className="flex flex-col gap-3 lg:col-span-2"
        >
          <h2 id="graph-panel-heading" className="font-heading text-lg font-medium text-foreground">
            Constellation
          </h2>
          {/* Panneau non interactif au clavier (canvas Cytoscape, affordance
              souris - meme parti pris qu'ADR-0010/0012) : le chemin accessible
              (filtres + liste) reste entier sur /graph, atteint via
              "Agrandir" - pas de duplication ici. */}
          <div className="relative">
            <GraphView
              worldSlug={world.slug}
              elements={elements}
              showFilters={false}
              canvasClassName={`${PANEL_HEIGHT} w-full rounded-md border border-border`}
            />
            <Button asChild variant="ghost" size="icon" className="absolute right-2 top-2 z-10">
              <Link href={`/worlds/${world.slug}/graph`} aria-label="Explorer la constellation">
                <Maximize2 aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          </div>
        </section>
      </div>

      {footerSegments.length > 0 ? (
        <p className="text-sm text-muted-foreground">{footerSegments.join(" · ")}</p>
      ) : null}
    </div>
  );
}

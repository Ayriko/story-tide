import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSessionOrRedirect } from "@/lib/auth-session";
import { WorldNotFoundError, getWorldBySlug } from "@/services/world-service";
import { listEntities } from "@/services/entity-service";
import { listWorldRelations } from "@/services/relation-service";
import { buildAccessibleGraphEntries, buildGraphElements } from "@/lib/graph-elements";
import { Button } from "@/components/ui/button";
import { GraphAccessibleDisclosure } from "./graph-accessible-disclosure";
import { GraphView } from "./graph-view";

export default async function GraphPage({ params }: { params: Promise<{ slug: string }> }) {
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

  const entityInputs = entities.map((entity) => ({
    id: entity.id,
    name: entity.name,
    type: entity.type,
  }));
  const elements = buildGraphElements(entityInputs, relations);
  const accessibleEntries = buildAccessibleGraphEntries(entityInputs, relations);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        {/* Vue "agrandissement plein cadre" (KAN-36 P5a) - bouton retour
            visible plutot que le lien discret des autres headers (page.tsx de
            la fiche, KAN-36 P4) : cette vue se comporte comme un mode
            immersif dedie, pas un document parmi d'autres. */}
        <Button asChild variant="outline" size="sm">
          <Link href={`/worlds/${world.slug}`}>
            <ArrowLeft aria-hidden="true" className="size-4" />
            {world.name}
          </Link>
        </Button>
        <h1 className="font-heading text-2xl font-medium text-foreground">Constellation</h1>
      </div>

      <GraphView
        worldSlug={world.slug}
        elements={elements}
        canvasClassName="h-[calc(100vh-20rem)] min-h-[28rem] w-full rounded-lg border border-border"
      />

      <GraphAccessibleDisclosure worldSlug={world.slug} entries={accessibleEntries} />
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSessionOrRedirect } from "@/lib/auth-session";
import { WorldNotFoundError, getWorldBySlug } from "@/services/world-service";
import { listEntities } from "@/services/entity-service";
import { listWorldRelations } from "@/services/relation-service";
import { buildGraphElements } from "@/lib/graph-elements";
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

  const elements = buildGraphElements(
    entities.map((entity) => ({ id: entity.id, name: entity.name, type: entity.type })),
    relations,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/worlds/${world.slug}`}
          className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        >
          ← {world.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Graphe</h1>
      </div>

      <GraphView worldSlug={world.slug} elements={elements} />
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSessionOrRedirect } from "@/lib/auth-session";
import { WorldNotFoundError, getWorldBySlug } from "@/services/world-service";
import { EntityNotFoundError, getEntity } from "@/services/entity-service";
import { buildDictionary } from "@/services/linker-service";
import { getIgnoredTargetIds } from "@/services/relation-service";
import { entityTypeLabel } from "@/lib/entity-schemas";
import { EMPTY_CONTENT, parseContent } from "@/lib/tiptap-content";
import { EditEntityForm } from "./edit-entity-form";
import { DeleteEntityForm } from "./delete-entity-form";
import { EntityEditor } from "./entity-editor";

export default async function EntityPage({
  params,
}: {
  params: Promise<{ slug: string; entityId: string }>;
}) {
  const { slug, entityId } = await params;
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

  let entity;
  try {
    entity = await getEntity(session.user.id, world.id, entityId);
  } catch (error) {
    if (error instanceof EntityNotFoundError) {
      notFound();
    }
    throw error;
  }

  // Revalidation defensive : entity.content est un Json Prisma generique,
  // toujours ecrit via parseContent() par construction, mais on ne fait pas
  // confiance aveuglement a une ligne existante (ex. donnee corrompue/legacy).
  let initialContent;
  try {
    initialContent = parseContent(entity.content);
  } catch {
    initialContent = EMPTY_CONTENT;
  }

  // Dictionnaire + cibles ignorees : necessaires au surlignage live cote
  // client (tiptap-link-highlight.ts) - meme dictionnaire que celui utilise
  // par le worker (buildDictionary), pour que ce qui est surligne soit
  // coherent avec les Relation origin=AUTO reellement ecrites.
  const [dictionary, ignoredTargetIds] = await Promise.all([
    buildDictionary(world.id),
    getIgnoredTargetIds(session.user.id, world.id, entity.id),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <Link
          href={`/worlds/${world.slug}`}
          className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        >
          ← {world.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          {entity.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {entityTypeLabel(entity.type)}
        </p>
      </div>

      <section
        aria-labelledby="content-heading"
        className="flex flex-col gap-2 border-t border-zinc-200 pt-6 dark:border-zinc-800"
      >
        <h2 id="content-heading" className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Contenu
        </h2>
        <EntityEditor
          worldId={world.id}
          worldSlug={world.slug}
          entityId={entity.id}
          initialContent={initialContent}
          dictionary={dictionary}
          ignoredTargetIds={ignoredTargetIds}
        />
      </section>

      <section
        aria-labelledby="edit-entity-section-heading"
        className="flex flex-col gap-6 border-t border-zinc-200 pt-6 dark:border-zinc-800"
      >
        <h2
          id="edit-entity-section-heading"
          className="text-lg font-semibold text-zinc-950 dark:text-zinc-50"
        >
          Paramètres
        </h2>
        <EditEntityForm
          worldId={world.id}
          worldSlug={world.slug}
          entityId={entity.id}
          name={entity.name}
          type={entity.type}
          aliases={entity.aliases}
        />
        <DeleteEntityForm worldId={world.id} worldSlug={world.slug} entityId={entity.id} />
      </section>
    </div>
  );
}

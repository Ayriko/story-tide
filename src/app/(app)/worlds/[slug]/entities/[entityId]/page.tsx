import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSessionOrRedirect } from "@/lib/auth-session";
import { WorldNotFoundError, getWorldBySlug } from "@/services/world-service";
import { EntityNotFoundError, getEntity, listEntities } from "@/services/entity-service";
import { buildDictionary } from "@/services/linker-service";
import {
  getIgnoredTargetIds,
  listIncomingLinks,
  listOutgoingLinks,
} from "@/services/relation-service";
import { entityTypeLabel } from "@/lib/entity-schemas";
import { EMPTY_CONTENT, parseContent } from "@/lib/tiptap-content";
import { EditEntityForm } from "./edit-entity-form";
import { DeleteEntityForm } from "./delete-entity-form";
import { EntityEditor } from "./entity-editor";
import { LinkedEntities } from "./linked-entities";

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
  // La liste "Entites liees" est une vue PERSISTEE (Relation en base, AUTO et
  // MANUAL confondues) tandis que le surlignage dans l'editeur est une vue
  // LIVE (scan du texte courant) - un leger decalage est possible tant que le
  // worker n'a pas traite le dernier job d'enfilage (les deux convergent au
  // repos, spec §4.4).
  const [dictionary, ignoredTargetIds, linkedEntities, backlinks, worldEntities] =
    await Promise.all([
      buildDictionary(world.id),
      getIgnoredTargetIds(session.user.id, world.id, entity.id),
      listOutgoingLinks(session.user.id, world.id, entity.id),
      listIncomingLinks(session.user.id, world.id, entity.id),
      listEntities(session.user.id, world.id),
    ]);
  // Mentions manuelles @ (KAN-22) : liste des entites du monde proposees par
  // la popup de suggestion (entity-editor.tsx), meme convention que
  // `dictionary` - deja chargee avec la page, aucun appel reseau a la frappe.
  const mentionSuggestionEntities = worldEntities.map((worldEntity) => ({
    id: worldEntity.id,
    label: worldEntity.name,
  }));

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
          entities={mentionSuggestionEntities}
        />
      </section>

      <section
        aria-labelledby="linked-entities-heading"
        className="flex flex-col gap-2 border-t border-zinc-200 pt-6 dark:border-zinc-800"
      >
        <h2
          id="linked-entities-heading"
          className="text-lg font-semibold text-zinc-950 dark:text-zinc-50"
        >
          Entités liées
        </h2>
        <LinkedEntities
          worldSlug={world.slug}
          links={linkedEntities}
          label="Entités liées"
          emptyLabel="Aucune entité liée pour l'instant."
        />
      </section>

      <section
        aria-labelledby="backlinks-heading"
        className="flex flex-col gap-2 border-t border-zinc-200 pt-6 dark:border-zinc-800"
      >
        <h2
          id="backlinks-heading"
          className="text-lg font-semibold text-zinc-950 dark:text-zinc-50"
        >
          Mentionné par
        </h2>
        <LinkedEntities
          worldSlug={world.slug}
          links={backlinks}
          label="Mentionné par"
          emptyLabel="Aucune fiche ne mentionne cette entité pour l'instant."
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

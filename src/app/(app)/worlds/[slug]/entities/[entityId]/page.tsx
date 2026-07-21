import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSessionOrRedirect } from "@/lib/auth-session";
import { WorldNotFoundError, getWorldBySlug } from "@/services/world-service";
import { EntityNotFoundError, getEntity, listEntities } from "@/services/entity-service";
import { buildDictionary } from "@/services/linker-service";
import {
  getIgnoredTargetIds,
  listIgnoredTargets,
  listIncomingLinks,
  listOutgoingLinks,
} from "@/services/relation-service";
import { entityTypeLabel } from "@/lib/entity-schemas";
import { EMPTY_CONTENT, parseContent } from "@/lib/tiptap-content";
import { EntityTypeIcon } from "../../entity-type-icon";
import { EntityEditor } from "./entity-editor";
import { EntitySettingsDialog } from "./entity-settings-dialog";
import { IgnoredLinks } from "./ignored-links";
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
  const [dictionary, ignoredTargetIds, linkedEntities, backlinks, ignoredTargets, worldEntities] =
    await Promise.all([
      buildDictionary(world.id),
      getIgnoredTargetIds(session.user.id, world.id, entity.id),
      listOutgoingLinks(session.user.id, world.id, entity.id),
      listIncomingLinks(session.user.id, world.id, entity.id),
      listIgnoredTargets(session.user.id, world.id, entity.id),
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
    <div className="flex flex-col gap-8">
      <Link
        href={`/worlds/${world.slug}`}
        className="w-fit text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        ← {world.name}
      </Link>

      {/* cardHeader dense (KAN-36 P4, reference-vvd.md §3) : remplace le
          header minimal de P2 (titre + sous-titre texte + gear a part). */}
      <div className="relative flex flex-col gap-3 rounded-lg border border-border bg-card p-6">
        {/* Coin haut-droit reel de la carte (positionnement absolu, pas un
            simple flex-col a cote du texte) - independant de l'emplacement de
            couverture, qui reste sous ce bouton. */}
        <div className="absolute right-4 top-4">
          <EntitySettingsDialog
            worldId={world.id}
            worldSlug={world.slug}
            entityId={entity.id}
            name={entity.name}
            type={entity.type}
            aliases={entity.aliases}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-3 pr-12">
          <h1 className="font-heading text-3xl font-medium text-foreground">{entity.name}</h1>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
            <EntityTypeIcon type={entity.type} className="size-3.5 text-primary-foreground" />
            {entityTypeLabel(entity.type)}
          </span>
          {entity.aliases.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {entity.aliases.map((alias) => (
                <span
                  key={alias}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {alias}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <EntityEditor
        worldId={world.id}
        worldSlug={world.slug}
        entityId={entity.id}
        initialContent={initialContent}
        dictionary={dictionary}
        ignoredTargetIds={ignoredTargetIds}
        entities={mentionSuggestionEntities}
      />

      <section
        aria-labelledby="linked-entities-heading"
        className="flex flex-col gap-2 border-t border-border pt-4"
      >
        <h2
          id="linked-entities-heading"
          className="font-heading text-sm font-medium text-foreground"
        >
          Renvois
        </h2>
        <LinkedEntities
          worldSlug={world.slug}
          links={linkedEntities}
          label="Renvois"
          emptyLabel="Aucune entité liée pour l'instant."
          ignoreContext={{ worldId: world.id, worldSlug: world.slug, entityId: entity.id }}
        />
      </section>

      <section
        aria-labelledby="backlinks-heading"
        className="flex flex-col gap-2 border-t border-border pt-4"
      >
        <h2 id="backlinks-heading" className="font-heading text-sm font-medium text-foreground">
          Échos
        </h2>
        <LinkedEntities
          worldSlug={world.slug}
          links={backlinks}
          label="Échos"
          emptyLabel="Aucune entrée ne mentionne cette entité pour l'instant."
        />
      </section>

      <section
        aria-labelledby="ignored-links-heading"
        className="flex flex-col gap-2 border-t border-border pt-4"
      >
        <h2 id="ignored-links-heading" className="font-heading text-sm font-medium text-foreground">
          Liens ignorés
        </h2>
        <IgnoredLinks
          worldId={world.id}
          worldSlug={world.slug}
          entityId={entity.id}
          targets={ignoredTargets}
        />
      </section>
    </div>
  );
}

import { notFound } from "next/navigation";
import { requireSessionOrRedirect } from "@/lib/auth-session";
import { WorldNotFoundError, getWorldBySlug } from "@/services/world-service";
import {
  getRelationTypeUsage,
  getWorldRelationTypeCatalog,
  listCustomRelationTypeUsages,
} from "@/services/relation-type-service";
import { CustomRelationTypesSection } from "./custom-relation-types-section";
import { NativeRelationTypesSection } from "./native-relation-types-section";

// Onglet « Types de relations » (KAN-84, ADR-0031), meme patron que
// l'onglet « Types d'entrees » : la page lit, les ecritures passent par
// src/actions/world-settings.ts (appartenance revalidee cote service).
export default async function WorldSettingsRelationsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
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

  const [catalog, usage, usagesByType] = await Promise.all([
    getWorldRelationTypeCatalog(session.user.id, world.id),
    getRelationTypeUsage(session.user.id, world.id),
    listCustomRelationTypeUsages(session.user.id, world.id),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <CustomRelationTypesSection
        worldId={world.id}
        catalog={catalog}
        usage={usage}
        usagesByType={usagesByType}
      />
      <NativeRelationTypesSection worldId={world.id} catalog={catalog} usage={usage} />
    </div>
  );
}

import { notFound } from "next/navigation";
import { requireSessionOrRedirect } from "@/lib/auth-session";
import { WorldNotFoundError, getWorldBySlug } from "@/services/world-service";
import {
  getTypeUsage,
  getWorldTypeCatalog,
  listCustomTypeEntries,
} from "@/services/entity-type-service";
import { CustomTypesSection } from "./custom-types-section";
import { NativeTypesSection } from "./native-types-section";

// Onglet « Types d'entrees » (KAN-81, ADR-0030) : masquer des types natifs,
// creer/modifier/supprimer des types personnalises. Toutes les ecritures
// passent par src/actions/world-settings.ts (appartenance revalidee cote
// service) - cette page ne fait que lire.
export default async function WorldSettingsTypesPage({
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

  const [catalog, usage, entriesByType] = await Promise.all([
    getWorldTypeCatalog(session.user.id, world.id),
    getTypeUsage(session.user.id, world.id),
    listCustomTypeEntries(session.user.id, world.id),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <CustomTypesSection
        worldId={world.id}
        catalog={catalog}
        usage={usage}
        entriesByType={entriesByType}
      />
      <NativeTypesSection worldId={world.id} catalog={catalog} usage={usage} />
    </div>
  );
}

import { z } from "zod";

// Type = donnee (String en base), pas un enum Prisma - ajouter un type ne
// demande pas de migration, seulement d'etendre cette liste + la reference.
// Les 5 ids historiques (character/place/faction/object/event) sont
// conserves a l'identique (KAN-18, extension 5 -> 26 types, cadrage 19/07).
export const ENTITY_TYPES = [
  "character",
  "fauna",
  "flora",
  "monster",
  "place",
  "city",
  "region",
  "landmark",
  "country",
  "kingdom",
  "faction",
  "order",
  "lineage",
  "magic-system",
  "spell",
  "ritual",
  "deity",
  "event",
  "legend",
  "prophecy",
  "era",
  "object",
  "weapon",
  "armor",
  "artifact",
  "note",
] as const;

export const ENTITY_TYPE_GROUPS = [
  "Personnages",
  "Écologie",
  "Lieux",
  "Organisation",
  "Magie",
  "Lore",
  "Objets",
  "Divers",
] as const;

export type EntityTypeGroup = (typeof ENTITY_TYPE_GROUPS)[number];

type EntityTypeMeta = { label: string; group: EntityTypeGroup };

// Source de verite unique (label + groupe) - le regroupement sert : la
// couleur des noeuds du graphe (par groupe, pas par type - 26 teintes serait
// illisible, C2.2.3), le filtre du graphe (fieldset par groupe), et le
// selecteur de type a la creation (combobox groupe).
export const ENTITY_TYPE_REFERENCE: Record<(typeof ENTITY_TYPES)[number], EntityTypeMeta> = {
  character: { label: "Personnage", group: "Personnages" },
  fauna: { label: "Faune", group: "Écologie" },
  flora: { label: "Flore", group: "Écologie" },
  monster: { label: "Monstre", group: "Écologie" },
  place: { label: "Lieu", group: "Lieux" },
  city: { label: "Ville", group: "Lieux" },
  region: { label: "Région", group: "Lieux" },
  landmark: { label: "Point de repère", group: "Lieux" },
  country: { label: "Pays", group: "Organisation" },
  kingdom: { label: "Royaume", group: "Organisation" },
  faction: { label: "Faction", group: "Organisation" },
  order: { label: "Ordre", group: "Organisation" },
  lineage: { label: "Lignée", group: "Organisation" },
  "magic-system": { label: "Système magique", group: "Magie" },
  spell: { label: "Sort", group: "Magie" },
  ritual: { label: "Rituel", group: "Magie" },
  deity: { label: "Divinité", group: "Lore" },
  event: { label: "Événement", group: "Lore" },
  legend: { label: "Légende", group: "Lore" },
  prophecy: { label: "Prophétie", group: "Lore" },
  era: { label: "Ère", group: "Lore" },
  object: { label: "Objet", group: "Objets" },
  weapon: { label: "Arme", group: "Objets" },
  armor: { label: "Armure", group: "Objets" },
  artifact: { label: "Artéfact", group: "Objets" },
  note: { label: "Note", group: "Divers" },
};

// Types groupes dans l'ordre stable de ENTITY_TYPE_GROUPS - source unique
// reutilisee par les <optgroup> des formulaires, le combobox de type et les
// filtres du graphe (fieldset/legend par groupe).
export function groupedEntityTypes(): {
  group: EntityTypeGroup;
  types: (typeof ENTITY_TYPES)[number][];
}[] {
  return ENTITY_TYPE_GROUPS.map((group) => ({
    group,
    types: ENTITY_TYPES.filter((type) => ENTITY_TYPE_REFERENCE[type].group === group),
  }));
}

const aliasesSchema = z
  .array(z.string())
  .default([])
  .transform((aliases) =>
    Array.from(new Set(aliases.map((alias) => alias.trim()).filter((alias) => alias.length > 0))),
  );

export const createEntitySchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis.").max(100, "100 caractères maximum."),
  type: z.enum(ENTITY_TYPES, "Type invalide."),
  aliases: aliasesSchema,
});

// Meme forme que la creation : le type peut etre change apres coup.
export const updateEntitySchema = createEntitySchema;

export const searchEntitiesSchema = z.object({
  query: z.string().trim().min(1, "Saisir un terme.").max(100, "100 caractères maximum."),
});

// Entity.type est un String Prisma libre (donnee, pas schema) : rien ne
// garantit statiquement qu'une valeur lue en base correspond a une cle connue
// de ENTITY_TYPE_REFERENCE. Lookup tolerant a une valeur inconnue plutot
// qu'un cast qui masquerait le risque.
export function entityTypeLabel(type: string): string {
  return (ENTITY_TYPE_REFERENCE as Record<string, EntityTypeMeta | undefined>)[type]?.label ?? type;
}

// undefined pour un type inconnu (donnee legacy/inattendue) - pas de groupe
// "Divers" implicite qui masquerait le probleme.
export function entityTypeGroup(type: string): EntityTypeGroup | undefined {
  return (ENTITY_TYPE_REFERENCE as Record<string, EntityTypeMeta | undefined>)[type]?.group;
}

export type EntityType = (typeof ENTITY_TYPES)[number];
export type CreateEntityInput = z.infer<typeof createEntitySchema>;
export type UpdateEntityInput = z.infer<typeof updateEntitySchema>;
export type SearchEntitiesInput = z.infer<typeof searchEntitiesSchema>;

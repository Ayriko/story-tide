import { z } from "zod";

// Type = donnee (String en base), pas un enum Prisma - ajouter un type ne
// demande pas de migration, seulement d'etendre cette liste + les labels UI.
export const ENTITY_TYPES = ["character", "place", "faction", "object", "event"] as const;

export const ENTITY_TYPE_LABELS: Record<(typeof ENTITY_TYPES)[number], string> = {
  character: "Personnage",
  place: "Lieu",
  faction: "Faction",
  object: "Objet",
  event: "Événement",
};

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
// de ENTITY_TYPE_LABELS. Lookup sur en tolerant une valeur inconnue plutot
// qu'un cast qui masquerait le risque.
export function entityTypeLabel(type: string): string {
  return (ENTITY_TYPE_LABELS as Record<string, string>)[type] ?? type;
}

export type EntityType = (typeof ENTITY_TYPES)[number];
export type CreateEntityInput = z.infer<typeof createEntitySchema>;
export type UpdateEntityInput = z.infer<typeof updateEntitySchema>;
export type SearchEntitiesInput = z.infer<typeof searchEntitiesSchema>;

import { z } from "zod";
import { ENTITY_TYPE_GROUPS, ENTITY_TYPES } from "./entity-schemas";
import { CUSTOM_TYPE_ICONS, parseTypeKey } from "./entity-types";

// Frontiere du parametrage des types d'un monde (KAN-81, ADR-0030). La NFC
// du libelle et son unicite (casse/accents, contre natifs et personnalises)
// relevent du service, comme pour les noms d'entites (ADR-0020).
export const customTypeSchema = z.object({
  label: z.string().trim().min(1, "Le libellé est requis.").max(40, "40 caractères maximum."),
  group: z.enum(ENTITY_TYPE_GROUPS, "Groupe invalide."),
  icon: z.enum(CUSTOM_TYPE_ICONS, "Icône invalide."),
});

export const nativeTypeVisibilitySchema = z.object({
  type: z.enum(ENTITY_TYPES, "Type invalide."),
  hidden: z.boolean(),
});

// Carte de reaffectation : entityId -> cle de type cible (native ou
// `custom:<id>`, jamais stockee telle quelle). La forme de la cle est
// validee ici ; l'existence de la cible dans le monde et la couverture
// EXACTE des entrees du type, dans le service.
export const reassignMapSchema = z.record(
  z.string().min(1),
  z.string().refine((key) => parseTypeKey(key) !== null, "Type cible invalide."),
);

export type CustomTypeInput = z.infer<typeof customTypeSchema>;
export type ReassignMap = z.infer<typeof reassignMapSchema>;

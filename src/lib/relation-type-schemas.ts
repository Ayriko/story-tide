import { z } from "zod";
import { RELATION_TYPES, parseRelationChoice, parseRelationTypeKey } from "./relation-types";

// Frontiere des types et des relations declarees (KAN-84, ADR-0031). La NFC
// des libelles et leur unicite (casse/accents, contre natifs, inverses et
// personnalises) relevent du service (ADR-0020, ADR-0030).

const labelField = z
  .string()
  .trim()
  .min(1, "Le libellé est requis.")
  .max(40, "40 caractères maximum.");

// Libelle inverse : requis pour un type dirige, interdit pour un symetrique
// (meme regle que le CHECK CustomRelationType_symmetric_check). Champ vide
// poste par le formulaire = absent.
export const customRelationTypeSchema = z
  .object({
    label: labelField,
    symmetric: z.boolean("Choisis le sens de la relation."),
    inverseLabel: z
      .string()
      .trim()
      .max(40, "40 caractères maximum.")
      .transform((value) => (value === "" ? null : value)),
  })
  .superRefine((input, context) => {
    if (!input.symmetric && input.inverseLabel === null) {
      context.addIssue({
        code: "custom",
        path: ["inverseLabel"],
        message: "Le libellé inverse est requis pour une relation dirigée.",
      });
    }
    if (input.symmetric && input.inverseLabel !== null) {
      context.addIssue({
        code: "custom",
        path: ["inverseLabel"],
        message: "Une relation symétrique n'a pas de libellé inverse.",
      });
    }
  });

export const nativeRelationTypeVisibilitySchema = z.object({
  type: z.enum(RELATION_TYPES, "Type invalide."),
  hidden: z.boolean(),
});

// Carte de reaffectation : relationId -> cle de type cible (native ou
// `custom:<id>`). Forme validee ici ; existence dans le monde, meme nature
// (symetrique/dirige) et couverture EXACTE des relations, dans le service.
export const relationReassignMapSchema = z.record(
  z.string().min(1),
  z.string().refine((key) => parseRelationTypeKey(key) !== null, "Type cible invalide."),
);

// Choix poste par le select de type depuis une fiche (`<cle>|<point de vue>`).
export const relationChoiceSchema = z.string().transform((value, context) => {
  const choice = parseRelationChoice(value);
  if (!choice) {
    context.addIssue({ code: "custom", message: "Choisis un type de relation." });
    return z.NEVER;
  }
  return choice;
});

export const declaredRelationSchema = z.object({
  otherId: z.string().min(1, "Choisis une entrée."),
  choice: relationChoiceSchema,
});

export type CustomRelationTypeInput = z.infer<typeof customRelationTypeSchema>;
export type RelationReassignMap = z.infer<typeof relationReassignMapSchema>;

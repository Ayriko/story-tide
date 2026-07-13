import { z } from "zod";

export const createWorldSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis.").max(100, "100 caractères maximum."),
});

// Meme forme que la creation : seul le nom est editable, le slug est toujours
// derive cote service (jamais saisi par l'utilisateur).
export const updateWorldSchema = createWorldSchema;

export type CreateWorldInput = z.infer<typeof createWorldSchema>;
export type UpdateWorldInput = z.infer<typeof updateWorldSchema>;

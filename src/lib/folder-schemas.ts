import { z } from "zod";

export const createFolderSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis.").max(100, "100 caractères maximum."),
  parentId: z.string().trim().min(1).nullable().default(null),
});

// Meme forme que la creation : seul le nom est editable.
export const renameFolderSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis.").max(100, "100 caractères maximum."),
});

// null = racine du monde. Distinct de renameFolderSchema - deplacer ne
// modifie jamais le nom dans la meme requete (une action UI = un effet).
export const moveFolderSchema = z.object({
  parentId: z.string().trim().min(1).nullable(),
});

export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type RenameFolderInput = z.infer<typeof renameFolderSchema>;
export type MoveFolderInput = z.infer<typeof moveFolderSchema>;

import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis."),
  email: z.string().trim().min(1, "L'e-mail est requis.").email("Adresse e-mail invalide."),
  password: z.string().min(8, "8 caractères minimum.").max(128, "128 caractères maximum."),
});

export const loginSchema = z.object({
  email: z.string().trim().min(1, "L'e-mail est requis.").email("Adresse e-mail invalide."),
  password: z.string().min(1, "Le mot de passe est requis."),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

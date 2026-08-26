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

// Demande de reinitialisation : seule l'adresse est saisie. Aucune contrainte
// supplementaire volontairement - la reponse est identique que le compte
// existe ou non (OWASP A07), donc une validation plus stricte ne revelerait
// rien de plus mais degraderait le message d'erreur.
export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, "L'e-mail est requis.").email("Adresse e-mail invalide."),
});

// Choix du nouveau mot de passe. Memes bornes que registerSchema : une regle
// de robustesse differente entre l'inscription et la reinitialisation serait
// un moyen detourne de contourner la plus stricte des deux.
//
// Confirmation exigee ICI seulement (pas a l'inscription) : au moment du
// reset, une faute de frappe rebloque immediatement l'utilisateur, qui doit
// refaire toute la demande - alors qu'a l'inscription elle se rattrape en
// retentant la connexion.
export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "8 caractères minimum.").max(128, "128 caractères maximum."),
    passwordConfirm: z.string().min(1, "Confirmez le mot de passe."),
  })
  .refine((valeurs) => valeurs.password === valeurs.passwordConfirm, {
    // Erreur portee par le champ de confirmation : c'est lui que l'utilisateur
    // doit corriger, pas le mot de passe qu'il vient de choisir.
    path: ["passwordConfirm"],
    message: "Les mots de passe ne correspondent pas.",
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

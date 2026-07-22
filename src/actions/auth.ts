"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth";
import { auth } from "@/lib/auth";
import { loginSchema, registerSchema } from "@/lib/auth-schemas";
import { seedIntroWorld } from "@/services/intro-world-service";
import type { ZodError } from "zod";

export type AuthActionState = {
  errors?: Partial<Record<"name" | "email" | "password", string>>;
  formError?: string;
  // Valeurs soumises, reaffichees apres une erreur (React reinitialise les champs non
  // controles d'un <form action> des que l'action se resout, meme en cas d'erreur -
  // cf. plan). Jamais de password ici : on ne redepose pas un secret tape.
  values?: Partial<Record<"name" | "email", string>>;
};

function stringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function fieldErrorsFrom(error: ZodError): AuthActionState["errors"] {
  const errors: AuthActionState["errors"] = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (field === "name" || field === "email" || field === "password") {
      errors[field] ??= issue.message;
    }
  }
  return errors;
}

export async function registerAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const values = { name: stringField(formData, "name"), email: stringField(formData, "email") };

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: fieldErrorsFrom(parsed.error), values };
  }

  let userId: string;
  try {
    const result = await auth.api.signUpEmail({ body: parsed.data });
    userId = result.user.id;
  } catch (error) {
    if (error instanceof APIError && error.body?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
      return { errors: { email: "Un compte existe déjà avec cette adresse e-mail." }, values };
    }
    return { formError: "Inscription impossible pour le moment. Réessayez.", values };
  }

  // Monde d'introduction "Atheraus" (KAN-35) : cree par defaut, sautable via
  // la case a cocher du formulaire (opt-out, decision Aymeric). Un echec est
  // loggue (jamais avale) mais ne bloque pas l'inscription - le monde de
  // demonstration est une amelioration de l'onboarding, pas une condition
  // d'integrite du compte (meme politique que l'enfilage du job de liaison
  // dans saveEntityContentAction).
  const skipIntroWorld = formData.get("skipIntroWorld") !== null;
  if (!skipIntroWorld) {
    try {
      await seedIntroWorld(userId);
    } catch (error) {
      console.error("[auth] Seed du monde d'introduction échoué :", error);
    }
  }

  redirect("/");
}

// Toujours rediriger vers /login, meme si signOut echoue (session deja
// expiree, race condition) : le formulaire n'expose pas d'etat d'erreur, et
// il n'y a rien de mieux a faire cote UI qu'y renvoyer l'utilisateur. La
// cause reelle n'est jamais avalee (regle CLAUDE.md).
export async function logoutAction(): Promise<void> {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch (error) {
    console.error("[auth] Déconnexion échouée :", error);
  }
  redirect("/login");
}

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const values = { email: stringField(formData, "email") };

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: fieldErrorsFrom(parsed.error), values };
  }

  try {
    await auth.api.signInEmail({ body: parsed.data });
  } catch (error) {
    if (error instanceof APIError) {
      // Message generique : ne jamais reveler si c'est l'e-mail ou le mot de
      // passe qui est incorrect (OWASP A07 - pas d'enumeration de comptes).
      return { formError: "E-mail ou mot de passe incorrect.", values };
    }
    return { formError: "Connexion impossible pour le moment. Réessayez.", values };
  }

  redirect("/");
}

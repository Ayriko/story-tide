"use server";

import { redirect } from "next/navigation";
import { APIError } from "better-auth";
import { auth } from "@/lib/auth";
import { loginSchema, registerSchema } from "@/lib/auth-schemas";
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

  try {
    await auth.api.signUpEmail({ body: parsed.data });
  } catch (error) {
    if (error instanceof APIError && error.body?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
      return { errors: { email: "Un compte existe déjà avec cette adresse e-mail." }, values };
    }
    return { formError: "Inscription impossible pour le moment. Réessayez.", values };
  }

  redirect("/");
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

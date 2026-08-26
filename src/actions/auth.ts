"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth";
import { env } from "@/env";
import { auth } from "@/lib/auth";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/auth-schemas";
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
    // Repli generique : la cause reelle est loguee, jamais avalee (regle
    // CLAUDE.md). Un "impossible pour le moment" sans trace serveur a deja
    // coute un diagnostic complet (dev-log 2026-07-14), et de nouveau le
    // 2026-08-17 - une base de dev sans migrations produisait ce message sans
    // la moindre ligne de log. Uniquement ici, dans la branche inattendue :
    // surtout pas dans le cas metier "compte deja existant" traite au-dessus.
    console.error("[auth] Inscription échouée :", error);
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
    // Repli generique (panne reelle : base injoignable, etc.) - cause loguee,
    // jamais avalee. Pas de log dans la branche APIError ci-dessus : un
    // mauvais mot de passe est un cas metier attendu, pas un incident.
    console.error("[auth] Connexion échouée :", error);
    return { formError: "Connexion impossible pour le moment. Réessayez.", values };
  }

  redirect("/");
}

export type ForgotPasswordActionState = {
  errors?: Partial<Record<"email", string>>;
  formError?: string;
  values?: Partial<Record<"email", string>>;
  sent?: boolean;
};

export async function requestPasswordResetAction(
  _prevState: ForgotPasswordActionState,
  formData: FormData,
): Promise<ForgotPasswordActionState> {
  const values = { email: stringField(formData, "email") };

  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    const emailIssue = parsed.error.issues.find((issue) => issue.path[0] === "email");
    return { errors: { email: emailIssue?.message ?? "Adresse e-mail invalide." }, values };
  }

  try {
    await auth.api.requestPasswordReset({
      body: {
        email: parsed.data.email,
        // Page qui recevra le jeton valide (Better Auth y redirige apres
        // verification) ou `?error=INVALID_TOKEN` si le lien est perime.
        redirectTo: `${env.BETTER_AUTH_URL}/reset-password`,
      },
    });
  } catch (error) {
    // Cause reelle loguee (SMTP injoignable, identifiants refuses...), mais le
    // message rendu reste le meme que dans le cas nominal : un echec d'envoi ne
    // doit pas devenir un oracle permettant de distinguer une adresse connue
    // d'une adresse inconnue.
    console.error("[auth] Demande de réinitialisation échouée :", error);
    return { sent: true, values };
  }

  return { sent: true, values };
}

export type ResetPasswordActionState = {
  errors?: Partial<Record<"password" | "passwordConfirm", string>>;
  formError?: string;
};

export async function resetPasswordAction(
  _prevState: ResetPasswordActionState,
  formData: FormData,
): Promise<ResetPasswordActionState> {
  const token = stringField(formData, "token");

  if (!token) {
    return { formError: "Ce lien de réinitialisation est invalide ou a expiré." };
  }

  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });

  if (!parsed.success) {
    // Le jeton n'est PAS consomme tant que la saisie est invalide : l'utilisateur
    // peut corriger sans avoir a redemander un lien.
    const errors: ResetPasswordActionState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const champ = issue.path[0];
      if (champ === "password" || champ === "passwordConfirm") {
        errors[champ] ??= issue.message;
      }
    }
    return { errors };
  }

  try {
    await auth.api.resetPassword({ body: { newPassword: parsed.data.password, token } });
  } catch (error) {
    if (error instanceof APIError) {
      // Cas metier attendu : jeton expire, deja consomme, ou fabrique.
      return { formError: "Ce lien de réinitialisation est invalide ou a expiré." };
    }
    console.error("[auth] Réinitialisation du mot de passe échouée :", error);
    return { formError: "Réinitialisation impossible pour le moment. Réessayez." };
  }

  // Pas de connexion automatique : un lien recu par courrier ne doit pas
  // suffire a ouvrir une session (convention GitHub/GitLab, arbitrage du
  // 2026-08-17). L'utilisateur ressaisit le mot de passe qu'il vient de choisir.
  redirect("/login?reinitialise=1");
}

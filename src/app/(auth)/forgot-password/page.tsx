import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { AuthCard } from "../auth-card";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default async function ForgotPasswordPage() {
  const session = await getServerSession();
  if (session) {
    redirect("/");
  }

  return (
    <AuthCard>
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Mot de passe oublié</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Indiquez votre adresse : nous vous envoyons un lien pour en choisir un nouveau.
        </p>
      </div>
      <ForgotPasswordForm />
    </AuthCard>
  );
}

import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "@/lib/auth";
import { AuthCard } from "../auth-card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Connexion",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reinitialise?: string }>;
}) {
  const session = await getServerSession();
  if (session) {
    redirect("/");
  }

  // Retour depuis /reset-password : confirmer que le changement a bien eu lieu,
  // sinon l'utilisateur se retrouve sur la page de connexion sans savoir si son
  // nouveau mot de passe a ete enregistre (KAN-52).
  const { reinitialise } = await searchParams;

  return (
    <AuthCard active="login">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Connexion</h1>
        <p className="mt-1 text-sm text-muted-foreground">Content de vous revoir.</p>
      </div>
      {reinitialise ? (
        <p role="status" className="rounded-md bg-primary/10 px-3 py-2 text-sm text-foreground">
          Mot de passe modifié. Connectez-vous avec votre nouveau mot de passe.
        </p>
      ) : null}
      <LoginForm />
    </AuthCard>
  );
}

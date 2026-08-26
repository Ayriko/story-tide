import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { AuthCard } from "../auth-card";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

// Contrat Better Auth : le lien du message pointe vers l'endpoint de
// verification, qui redirige ICI avec `?token=...` si le jeton est valide, ou
// `?error=INVALID_TOKEN` s'il est expire, deja consomme ou fabrique.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const session = await getServerSession();
  if (session) {
    redirect("/");
  }

  const { token } = await searchParams;

  if (!token) {
    return (
      <AuthCard>
        <div>
          <h1 className="font-heading text-2xl font-medium text-foreground">Lien expiré</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ce lien de réinitialisation n&apos;est plus valable. Les liens expirent au bout
            d&apos;une heure et ne peuvent servir qu&apos;une seule fois.
          </p>
        </div>
        <Link
          href="/forgot-password"
          className="rounded-sm text-sm text-foreground underline underline-offset-4 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Demander un nouveau lien
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Nouveau mot de passe</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choisissez un nouveau mot de passe pour votre compte.
        </p>
      </div>
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}

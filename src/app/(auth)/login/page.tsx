import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "@/lib/auth";
import { AuthCard } from "../auth-card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Connexion",
};

export default async function LoginPage() {
  const session = await getServerSession();
  if (session) {
    redirect("/");
  }

  return (
    <AuthCard active="login">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Connexion</h1>
        <p className="mt-1 text-sm text-muted-foreground">Content de vous revoir.</p>
      </div>
      <LoginForm />
    </AuthCard>
  );
}

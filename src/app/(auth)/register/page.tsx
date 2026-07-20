import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "@/lib/auth";
import { AuthCard } from "../auth-card";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Inscription",
};

export default async function RegisterPage() {
  const session = await getServerSession();
  if (session) {
    redirect("/");
  }

  return (
    <AuthCard active="register">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Créer un compte</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quelques secondes pour commencer à écrire.
        </p>
      </div>
      <RegisterForm />
    </AuthCard>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Connexion — Story Tide",
};

export default async function LoginPage() {
  const session = await getServerSession();
  if (session) {
    redirect("/");
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Connexion</h1>
      <LoginForm />
      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        Pas encore de compte ?{" "}
        <Link href="/register" className="font-medium underline underline-offset-2">
          Creer un compte
        </Link>
      </p>
    </>
  );
}

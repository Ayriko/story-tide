import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "@/lib/auth";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Inscription — Story Tide",
};

export default async function RegisterPage() {
  const session = await getServerSession();
  if (session) {
    redirect("/");
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Creer un compte</h1>
      <RegisterForm />
      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        Deja un compte ?{" "}
        <Link href="/login" className="font-medium underline underline-offset-2">
          Se connecter
        </Link>
      </p>
    </>
  );
}

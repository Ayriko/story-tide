import { notFound, redirect } from "next/navigation";
import { prisma } from "@/db/client";
import { UserRole } from "@/generated/prisma/client";
import { getServerSession } from "@/lib/auth";

export class UnauthenticatedError extends Error {
  constructor() {
    super("Session requise.");
    this.name = "UnauthenticatedError";
  }
}

// Pour les Server Actions : leve une erreur typee (jamais de acces non
// authentifie qui continue silencieusement - OWASP A01/A07). L'action
// l'attrape pour retourner un etat forme (redirect /login) ou re-propage.
export async function requireSession() {
  const session = await getServerSession();
  if (!session) {
    throw new UnauthenticatedError();
  }
  return session;
}

// Pour les pages/layouts (RSC) : redirige directement plutot que de lever.
// Next.js peut evaluer layout et page enfant en parallele avant qu'un
// redirect() du layout ne coupe le rendu des enfants - si la page appelait
// requireSession() elle-meme, l'UnauthenticatedError intermediaire remonte
// non rattrapee dans les logs serveur (bruit) meme si la reponse finale
// (redirection) reste correcte. redirect() ici est reconnu par Next comme
// un flux de controle normal, pas une erreur applicative.
export async function requireSessionOrRedirect() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

// --- Garde d'administration (KAN-72, ADR-0029) ---
//
// Un visiteur anonyme et un utilisateur standard recoivent la MEME reponse
// qu'une ressource inexistante (patron A01 "introuvable") : rien ne distingue
// "/admin n'existe pas" de "pas pour vous".
export class AdminNotFoundError extends Error {
  constructor() {
    super("Introuvable.");
    this.name = "AdminNotFoundError";
  }
}

// Le role se relit en base a CHAQUE appel, jamais depuis la session : un
// changement de role prend effet au prochain appel, pas a la prochaine
// connexion.
export async function isAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user?.role === UserRole.ADMIN;
}

// Pour les Server Actions sous /admin : erreur typee, identique pour un
// anonyme et pour un compte standard.
export async function requireAdmin() {
  const session = await getServerSession();
  if (!session || !(await isAdmin(session.user.id))) {
    throw new AdminNotFoundError();
  }
  return session;
}

// Pour les pages et layouts sous /admin : 404 de Next. A appeler dans CHAQUE
// page et layout, jamais seulement dans le layout (Next peut rendre layout et
// page en parallele).
export async function requireAdminOrNotFound() {
  const session = await getServerSession();
  if (!session || !(await isAdmin(session.user.id))) {
    notFound();
  }
  return session;
}

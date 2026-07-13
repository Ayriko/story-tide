import { redirect } from "next/navigation";
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

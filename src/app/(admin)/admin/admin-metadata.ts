import type { Metadata } from "next";
import { requireAdminOrNotFound } from "@/lib/auth-session";

// Metadonnees des pages /admin, gardees elles aussi (KAN-72, OWASP A01) : un
// `export const metadata` statique est resolu par Next independamment du
// rendu, donc servi MEME quand la page repond 404 - le <title>
// "Administration" trahirait l'existence de la route a un anonyme. Ici, un
// non-administrateur declenche notFound() avant qu'un titre ne soit rendu,
// et recoit le <title> de la 404 standard.
//
// noindex/nofollow : /admin ne doit jamais etre indexe (OWASP A05). Pas de
// robots.txt qui le listerait : un Disallow public revelerait son existence.
//
// `title` omis pour le layout : un titre pose par un layout intermediaire
// ferait perdre aux pages le gabarit "%s — Story Tide" du layout racine.
export async function adminMetadata(title?: string): Promise<Metadata> {
  await requireAdminOrNotFound();
  return { ...(title ? { title } : {}), robots: { index: false, follow: false } };
}

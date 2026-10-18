import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth-session";

// Garde de /admin AVANT le routage (KAN-72, ADR-0029, OWASP A01).
//
// Pourquoi ici et pas seulement dans les pages : notFound() appele depuis un
// layout ou une page rend bien un statut 404, mais pas le meme document
// qu'une route inexistante (coquille d'erreur de Next, charge RSC qui nomme
// le segment "(admin)") - un `curl` suffirait a distinguer "/admin existe".
// En reecrivant la requete d'un non-administrateur vers une route qui
// n'existe pas, la reponse EST la 404 standard de l'application, pour les
// pages comme pour les Server Actions (POST vers /admin/...).
//
// Les gardes de layout, de pages et d'actions (requireAdminOrNotFound /
// requireAdmin) restent en place : defense en profondeur, ce fichier seul ne
// protege rien si son matcher est un jour modifie.
//
// Le role est relu en base a chaque requete (isAdmin), jamais depuis la session.

// Chemin volontairement absent de src/app : sa seule fonction est de ne
// correspondre a aucune route.
const NOT_FOUND_PATH = "/introuvable";

export async function proxy(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (session && (await isAdmin(session.user.id))) {
      return NextResponse.next();
    }
  } catch (error) {
    // Ferme par defaut : une panne (base injoignable) ne doit ni ouvrir
    // /admin ni repondre 500 la ou une route inexistante repond 404.
    console.error("[admin] Vérification du rôle échouée dans le proxy :", error);
  }
  return NextResponse.rewrite(new URL(NOT_FOUND_PATH, request.url));
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};

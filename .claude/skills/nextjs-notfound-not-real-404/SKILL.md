---
name: nextjs-notfound-not-real-404
description: >
  Rendre une route protégée indistinguable d'une route inexistante dans Next.js
  App Router (patron 404-identique, OWASP A01). Déclencheurs : notFound(),
  404, __next_error__, page d'erreur différente, curl distingue la route,
  segment visible dans la charge RSC, garde dans le layout, route admin
  cachée, proxy.ts, middleware, NextResponse.rewrite, matcher, defense en
  profondeur, layout et page rendus en parallèle.
---

# `notFound()` depuis un layout ≠ vraie 404

## Le symptôme

`/admin` pour un anonyme répond bien **404**, mais le document n'est pas celui
d'une route inexistante : `<html id="__next_error__">`, pas de titre « 404 »,
et la charge RSC nomme le segment `(admin)`. Un `curl` sur `/admin` puis sur
`/admix` suffit à voir que l'une des deux routes existe.

## La cause

`notFound()` appelé **depuis un layout ou une page qui existe** rend la
coquille d'erreur de Next pour ce segment, pas la page 404 générique de
l'application. Le statut est le bon, le contenu trahit la route.

## La solution (src/proxy.ts, KAN-72)

Réécrire la requête d'un non-autorisé vers un chemin qui n'existe pas, avant
le routage :

```ts
const NOT_FOUND_PATH = "/introuvable"; // volontairement absent de src/app

export async function proxy(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (session && (await isAdmin(session.user.id))) {
      return NextResponse.next();
    }
  } catch (error) {
    // fermé par défaut : une panne ne doit ni ouvrir la route ni répondre 500
    console.error("[admin] Vérification du rôle échouée dans le proxy :", error);
  }
  return NextResponse.rewrite(new URL(NOT_FOUND_PATH, request.url));
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
```

- **Garder** les gardes de layout, de pages et d'actions
  (`requireAdminOrNotFound` / `requireAdmin`) : le proxy seul ne protège rien
  si son matcher change, et Next peut rendre layout et page en parallèle.
- **Groupe de routes séparé** (`(admin)` à part de `(app)`) si le layout
  existant redirige l'anonyme vers `/login` : une redirection trahit aussi la
  route.
- Rôle relu en base à chaque requête, jamais depuis la session.

## Limite connue

La réécriture laisse un en-tête `x-middleware-rewrite: /introuvable`, absent
d'une 404 ordinaire (documenté dans ADR-0029, non corrigé).

## Règle

Vérifier un 404-identique **au `curl`**, pas au navigateur :
`curl.exe -s -o NUL -w "%{http_code}"` sur la route protégée et sur une route
inexistante, puis comparer les corps.

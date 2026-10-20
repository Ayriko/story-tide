---
name: nextjs-static-metadata-leaks-404
description: >
  Titre ou métadonnées d'une page protégée servis malgré une 404 dans Next.js
  App Router. Déclencheurs : export const metadata, generateMetadata, <title>
  qui fuit, title servi à un anonyme, notFound et metadata, robots noindex,
  route cachée, 404-identique, OWASP A01, gabarit de titre perdu, layout
  intermédiaire title.
---

# `export const metadata` statique fuit sur une 404

## Le symptôme

`/admin` répond 404 à un anonyme, mais la réponse contient
`<title>Administration</title>` : la route existe, et le titre le dit.

## La cause

Next résout les métadonnées **indépendamment du rendu** du layout ou de la
page. Un `export const metadata = { title: "Administration" }` est servi même
quand la garde de la page appelle `notFound()`.

## La solution (src/app/(admin)/admin/admin-metadata.ts, KAN-72)

Toujours `generateMetadata`, qui appelle la garde **avant** de rendre quoi que
ce soit :

```ts
export async function adminMetadata(title?: string): Promise<Metadata> {
  await requireAdminOrNotFound();
  return { ...(title ? { title } : {}), robots: { index: false, follow: false } };
}

// layout.tsx — pas de title, sinon les pages perdent le gabarit "%s — Story Tide"
export function generateMetadata() { return adminMetadata(); }

// page.tsx
export function generateMetadata() { return adminMetadata("Administration"); }
```

- Sur le **layout et chaque page** du segment protégé.
- `noindex, nofollow` dans les métadonnées, **pas** de `Disallow: /admin` dans
  `robots.txt` : un fichier public qui liste la route révèle son existence.
- Pas de `title` dans un layout intermédiaire : il écrase le gabarit du layout
  racine pour toutes les pages en dessous.

## Règle

Sous un segment protégé, `export const metadata` est interdit. Le test de la
garde vérifie aussi le `<title>` de la réponse 404.

---
name: stretched-link-playwright-click
description: >
  Ligne de tableau ou carte entièrement cliquable par un lien étiré
  (pseudo-élément ::after absolute inset-0), et tests Playwright qui
  échouent en cliquant dessus. Déclencheurs : lien étiré, stretched link,
  after:absolute after:inset-0, ligne cliquable, tr relative, "subtree
  intercepts pointer events", "Timeout 30000ms exceeded", locator.click,
  hover, actionnabilité Playwright, boundingBox, page.mouse.click.
---

# Lien étiré : le bon motif d'UI, et comment le cliquer en e2e

## Le motif (src/app/(admin)/admin/users/page.tsx, KAN-72)

Ligne entière cliquable **sans** gestionnaire de clic : le seul lien de la
ligne est étiré dessus par son pseudo-élément, rattaché au `<tr>` en
`position: relative`.

```tsx
<TableRow key={user.id} className="group relative hover:bg-foreground/5">
  <TableCell>
    <Link href={`/admin/users/${user.id}`} className={`after:absolute after:inset-0 ${LINK_CLASSNAME}`}>
      {user.email}
    </Link>
  </TableCell>
  …
</TableRow>
```

Un seul arrêt clavier par ligne, un vrai `<a>`. Préféré à une colonne « Voir
la fiche » (deux liens par ligne). `hover:bg-accent` y est invisible sur une
carte : `hover:bg-foreground/5`.

## Le symptôme en test

```
<a …> from <td …> subtree intercepts pointer events
…
Timeout 30000ms exceeded.
```

sur `locator.click()` ou `hover()` d'une **cellule** de la ligne.

## La cause

Le `::after` recouvre toute la ligne : c'est le but. Le contrôle
d'actionnabilité de Playwright voit qu'un autre élément recevrait le clic et
refuse, puis réessaie jusqu'au timeout. Ce n'est pas un défaut de l'UI.

## La solution (e2e/admin.spec.ts)

Cliquer aux coordonnées, comme un vrai pointeur :

```ts
const cellule = await page.getByRole("cell", { name: "Admin Vue Test", exact: true }).boundingBox();
if (!cellule) throw new Error("cellule du nom introuvable dans la liste");
await page.mouse.click(cellule.x + cellule.width / 2, cellule.y + cellule.height / 2);
await page.waitForURL(/\/admin\/users\/[^/]+$/);
```

Pour tester la navigation clavier, cibler le lien lui-même
(`getByRole("link", { name: email, exact: true })`).

## Règle

Ne pas « réparer » le lien étiré pour faire passer le test (`pointer-events`,
`force: true`) : le test doit cliquer comme l'utilisateur. Vérifié sous
Chromium seulement ; Safari reste à contrôler (repli : colonne de lien).

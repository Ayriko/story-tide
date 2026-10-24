---
name: playwright-dialog-exit-duplicate-button
description: >
  Violation du mode strict Playwright sur un bouton dont le nom existe dans une
  modale qui vient de se fermer. Déclencheurs : strict mode violation,
  resolved to 2 elements, « Annuler », AlertDialog, Dialog Radix, animation de
  sortie, toast avec Annuler, Réorganiser automatiquement, modale encore dans
  le DOM.
---

# Une modale Radix reste dans le DOM pendant son animation de sortie

## Le symptôme

KAN-87 (24/10/2026). Après « Réorganiser automatiquement » → confirmation, le
test cliquait sur « Annuler » du toast :

```
strict mode violation: getByRole('button', { name: 'Annuler', exact: true }) resolved to 2 elements
```

## La cause

L'`AlertDialog` de confirmation a aussi un bouton « Annuler ». Pendant son
animation de sortie, il est encore dans le DOM et accessible : deux boutons
portent le même nom.

## La solution

Attendre que la modale ait disparu avant de chercher le bouton suivant :

```ts
// e2e/constellation.spec.ts
const confirmation = page.getByRole("alertdialog");
await confirmation.getByRole("button", { name: "Réorganiser", exact: true }).click();
await expect(confirmation).toBeHidden();
await page.getByRole("button", { name: "Annuler", exact: true }).click();
```

Quand le cas se représente sans animation en jeu, chercher en plus le bouton
dans son conteneur (la région du toast, `role="status"`).

## Règle

Après toute fermeture de modale : `toBeHidden()` sur la modale avant
l'interaction suivante. Un nom de bouton générique (« Annuler », « Fermer »)
se cherche toujours dans son conteneur.

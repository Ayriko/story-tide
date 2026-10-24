---
name: playwright-stable-positions-before-click
description: >
  Clic e2e Playwright par coordonnées (canvas, Cytoscape, page.mouse) qui
  tombe à côté de sa cible. Déclencheurs : page.mouse.click, dblclick sur une
  étoile, canvas, Constellation, position lue trop tôt, décalage après
  hydratation, sidebar qui s'ouvre après le chargement, transition CSS,
  clic qui ouvre la carte au lieu de la fiche, constellation.spec.ts.
---

# Attendre des positions à l'écran stables avant de cliquer par coordonnées

## Le symptôme

KAN-87 (24/10/2026). Un double-clic sur une étoile devait ouvrir sa fiche ; il
ouvrait la carte de sélection d'une autre zone, ou rien. Intermittent.

## La cause

La position est lue (via le crochet `window.__storyTideConstellation`) dès que
le graphe est prêt. Mais la sidebar s'ouvre juste **après l'hydratation**
(préférence stockée dans le navigateur, transition de 200 ms) et décale tout le
canvas de 288 px. Le clic part sur l'ancienne position.

## La solution

Attendre que les positions à l'écran ne bougent plus entre deux lectures :

```ts
async function attendrePositionsStables(page: Page) {
  const lire = () =>
    page.evaluate(() =>
      JSON.stringify(
        (window.__storyTideConstellation?.nodes() ?? []).map(({ clientX, clientY }) => [
          Math.round(clientX),
          Math.round(clientY),
        ]),
      ),
    );
  let precedent = "";
  await expect
    .poll(async () => {
      const courant = await lire();
      const stable = courant === precedent;
      precedent = courant;
      return stable;
    })
    .toBe(true);
}
```

À appeler après `networkidle`, avant toute lecture de coordonnées.

## Règle

Tout clic par coordonnées : positions relues **après** stabilisation, jamais
mises en cache d'une lecture antérieure. Le vrai correctif produit (préférence
lue côté serveur, sans saut) est prévu en C2 ; ce helper reste utile pour
toute transition.

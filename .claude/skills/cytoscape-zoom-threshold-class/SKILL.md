---
name: cytoscape-zoom-threshold-class
description: >
  Afficher ou masquer quelque chose dans Cytoscape à partir d'un niveau de zoom
  (libellés d'arête, détails). Déclencheurs : min-zoomed-font-size, libellés
  visibles au mauvais zoom, seuil de zoom, devicePixelRatio, écran haute
  densité, libellés d'arête toujours affichés, cy.zoom(), Constellation,
  graph-view.tsx, is-zoomed-in, EDGE_LABEL_MIN_ZOOM.
---

# `min-zoomed-font-size` n'est pas un seuil de zoom fiable

## Le symptôme

KAN-87 (24/10/2026). Les libellés d'arête devaient n'apparaître qu'à fort
zoom. Avec `min-zoomed-font-size` réglé pour un seuil de 1,5, ils étaient déjà
visibles à 1,27. Sur un écran haute densité, ils l'auraient été encore plus
tôt.

## La cause

Cytoscape compare la taille de police **à l'écran** au seuil, après avoir
arrondi son facteur de zoom à la puissance de deux supérieure et multiplié par
`devicePixelRatio`. Le seuil réel dépend donc de l'écran et tombe par paliers.

## La solution

Ne pas utiliser `min-zoomed-font-size` comme seuil. Poser une classe selon le
zoom réel, en lot, et la recalculer sur l'événement `zoom` :

```ts
function syncZoomedLabels(cy: Core) {
  const zoomedIn = cy.zoom() >= EDGE_LABEL_MIN_ZOOM;
  cy.batch(() => {
    cy.edges().forEach((edge) => edge.toggleClass("is-zoomed-in", zoomedIn));
  });
}
cy.on("zoom", () => syncZoomedLabels(cy));
```

Style : `selector: "edge.is-label-visible, edge.is-zoomed-in"` → libellé
affiché (le survol pose `is-label-visible`).

## Règle

Tout comportement « à partir du zoom X » passe par `cy.zoom()` et une classe.
Le seuil se vérifie en mesurant (zoom obtenu après « ajuster », opacité du
libellé), pas à l'œil sur un seul écran.

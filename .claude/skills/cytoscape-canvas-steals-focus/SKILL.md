---
name: cytoscape-canvas-steals-focus
description: >
  Raccourcis clavier d'une zone Cytoscape qui ne répondent plus après un clic
  dans le canvas. Déclencheurs : raccourcis + - 0 sans effet, onKeyDown jamais
  appelé, focus perdu au clic, tabIndex sur le conteneur du graphe,
  document.activeElement = body, Cytoscape mousedown, onPointerUpCapture,
  Constellation clavier.
---

# Cytoscape retire le focus au `mousedown`

## Le symptôme

KAN-87 (24/10/2026). La zone du graphe est focusable (`tabIndex={0}`) et
écoute `+`, `-`, `0` et `N`. Au clavier, ça marche. Après le moindre clic dans
le canvas, plus aucune touche ne répond : `document.activeElement` est `body`.

## La cause

Cytoscape gère ses propres événements souris sur son canvas et fait perdre le
focus à l'élément focusé au `mousedown`. Le conteneur React ne le reprend
jamais.

## La solution

Rendre le focus à la zone au relâchement, en phase de capture pour passer
avant Cytoscape :

```tsx
<div
  ref={zoneRef}
  tabIndex={0}
  onKeyDown={handleKeys}
  onPointerUpCapture={() => zoneRef.current?.focus({ preventScroll: true })}
>
```

`preventScroll: true` évite que la page saute.

## Règle

Toute zone clavier qui contient un canvas Cytoscape : tester les raccourcis
**après un clic dans le canvas**, pas seulement après une tabulation.

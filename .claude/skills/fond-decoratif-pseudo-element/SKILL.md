---
name: fond-decoratif-pseudo-element
description: Poser un fond décoratif (grille, blur, dégradé, texture) derrière un contenu rendu par une lib tierce qui gère son propre DOM (Cytoscape, canvas, cartes, éditeurs). Mots-clés — fond, background, blur, grille, calque, overlay, z-index, canvas, cytoscape, position absolute, on ne voit plus rien.
---

# Fond décoratif : pseudo-élément, jamais des calques frères en absolu

**Leçon (21/07/2026, graphe Cytoscape)** : deux `<div>` frères en `position:absolute`
(fond flouté + conteneur de montage) ont cassé l'affichage complet du graphe.
Une lib qui insère ses propres éléments DOM ne garantit rien sur l'empilement
face à des frères positionnés.

**Patron sûr** : un seul conteneur + `::before` en CSS :

```css
.graph-canvas::before {
  content: "";
  position: absolute;
  inset: 0;
  /* grille / dégradé / blur ici */
  pointer-events: none;
}
```

Le `::before` est **toujours peint avant les enfants réels** de l'élément : le
canvas inséré par la lib peint naturellement par-dessus, sans aucun z-index à
gérer, et le fond ne capte pas les événements (`pointer-events: none`).

Générique : vaut pour toute lib à DOM autonome (Cytoscape, Leaflet, éditeurs).

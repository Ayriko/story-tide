---
name: cytoscape-selector-no-user-value
description: >
  Filtre ou recherche Cytoscape construit avec une valeur saisie par
  l'utilisateur dans un sélecteur chaîne. Déclencheurs : cy.nodes('[typeKey =
  "…"]'), sélecteur Cytoscape, échappement, guillemet, antislash, libellé perso,
  filtre sans effet, erreur de sélecteur, type d'entrée personnalisé, typeKey,
  data(), graph-view.tsx.
---

# Jamais de valeur utilisateur dans un sélecteur chaîne Cytoscape

## Le symptôme

KAN-81 (20/10/2026). Le filtre par type de la Constellation n'avait aucun
effet pour un type personnalisé dont le libellé contenait `"` ou `\`. Aucune
erreur visible.

## La cause

Le parseur de sélecteurs chaîne de Cytoscape (`cy.nodes('[typeKey = "…"]')`)
n'offre pas d'échappement fiable pour ces caractères. Une valeur qui vient de
l'utilisateur (libellé, clé dérivée d'un libellé, nom d'entrée) casse le
sélecteur ou le fait correspondre à autre chose.

## La solution

Itérer et comparer les données :

```ts
cy.nodes().forEach((node) => {
  const visible = !hiddenTypes.has(node.data("typeKey"));
  node.style("display", visible ? "element" : "none");
});
```

Ou `cy.nodes().filter((node) => node.data("typeKey") === key)`.

## Règle

Sélecteur chaîne autorisé seulement avec des constantes du code (classes,
noms de propriétés). Dès qu'une valeur vient des données : `forEach` / `filter`
sur `data()`. Test unitaire avec un libellé contenant `"` et `\`.

---
name: unicode-test-normalize-not-escape
description: >
  Écrire un test qui a besoin d'une chaîne Unicode décomposée (NFD) ou d'un
  caractère combinant précis. Déclencheurs : test NFD, test NFC, ́,
  échappement Unicode dans un test, accent combinant, test qui passe à tort,
  normalizeForMatch, labelKey, libellé NFC, outil d'édition qui convertit les
  échappements.
---

# Fabriquer du NFD avec `.normalize("NFD")`, jamais avec un échappement littéral

## Le symptôme

KAN-84 (22/10/2026). Un test devait vérifier qu'un libellé saisi en NFD était
ramené en NFC. Il était écrit avec `"Vénérateur de"`. Après
passage par les outils d'édition, le fichier contenait en réalité
`"Vénérateur de"` en NFC : le test ne testait plus rien et passait.

## La cause

Les outils d'écriture de fichiers peuvent convertir les échappements `\uXXXX`
en caractères, puis l'éditeur ou le formateur recompose les accents. La forme
Unicode d'un littéral dans un fichier source n'est pas fiable.

## La solution

Produire la forme voulue à l'exécution :

```ts
const nfd = "Vénérateur de".normalize("NFD");
expect(nfd).not.toBe(nfd.normalize("NFC")); // garde-fou : c'est bien du NFD
```

## Règle

Tout test NFC/NFD : la chaîne décomposée est construite par
`.normalize("NFD")`, et un garde-fou vérifie qu'elle diffère de sa forme NFC.
Voir aussi `unicode-normalize-index-remap` pour le moteur de liaison.

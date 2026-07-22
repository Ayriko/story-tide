---
name: card-flex-col-layout
description: Ajustement de layout à l'intérieur d'un composant Card du design system (aligner sur une ligne, inline, badge à côté d'un titre, justify-between sans effet, items-center qui centre bizarrement). Mots-clés — Card, layout, flex, inline, ligne, alignement, tailwind-merge, design system, empilé, centré.
---

# Layout dans une Card : lire ses classes de base AVANT d'itérer

**Leçon (22/07/2026, 3 itérations perdues)** : `Card` (`src/components/ui/card.tsx`)
a `flex flex-col` **câblé dans ses classes de base**. Conséquences :

- Un `justify-between` ou `items-center` ajouté par l'appelant agit en contexte
  **colonne** : `items-center` centre horizontalement au lieu d'aligner sur la
  ligne — l'empilement vertical persiste quoi qu'on ajoute.
- `tailwind-merge` ne retire le `flex-col` de base **que si l'appelant passe
  explicitement `flex-row`** dans son `className`.

**Règle générale** : avant tout ajustement de layout dans un composant du design
system (Card, Dialog, etc.), ouvrir le composant de base et lire ses classes.
Une direction de flex, un gap ou un padding par défaut y est souvent câblé — c'est
lui qu'il faut overrider explicitement, pas contourner à l'aveugle. Trois variantes
essayées sans lire la base = signal d'arrêt.

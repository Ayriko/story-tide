---
name: tiptap-decoration-attrs-private
description: >
  Inspecter en test les attributs d'une Decoration ProseMirror/Tiptap sans caster
  sur un champ privé non typé. Déclencheurs : Decoration.type.attrs, "Property 'type'
  does not exist on type 'Decoration'", TS2339 Decoration, @tiptap/pm/view types,
  Decoration.inline spec argument, decoration.spec, plugin ProseMirror décorations,
  tester un mark/décoration, attrs non exposés, 4e argument Decoration.inline.
---

# Attributs d'une `Decoration` en test : passer par `spec`, pas par `.type`

## Le piège

Pour vérifier en test qu'une décoration porte le bon `targetId` (ou autre attribut),
on est tenté de lire `decoration.type.attrs`. Mais `Decoration.type` **n'est pas
exposé par les types publics** de `@tiptap/pm/view` :

```
TS2339: Property 'type' does not exist on type 'Decoration'.
```

…alors que `.type.attrs` existe bel et bien à l'exécution (vérifiable via
`node -e`). C'est un champ interne : le lire en test oblige à caster sur un champ
privé, fragile et non typé.

## La solution

`Decoration.inline(from, to, attrs, spec)` prend un **4ᵉ argument `spec`** optionnel,
lui **public et typé**. Y dupliquer l'info à inspecter :

```ts
Decoration.inline(
  from, to,
  { class: "entity-link", "data-target-id": targetId },  // attrs (rendu DOM)
  { targetId },                                           // spec (public, lisible en test)
);
```

En test :

```ts
expect(deco.spec.targetId).toBe("entity-42");   // ✅ typé, pas de cast
```

## Règle

Ne jamais lire `decoration.type.attrs` en test (champ interne non typé). Dupliquer
la donnée à asserter dans `spec`, le seul canal public de `Decoration.inline`.

---
name: set-destructure-typing
description: >
  Piège TypeScript avec noUncheckedIndexedAccess sur une destructuration
  positionnelle depuis un Set (ou tout itérable). Déclencheurs : "const [x] = mySet",
  "T | undefined", destructuration Set, noUncheckedIndexedAccess, itérable,
  set.size === 1, accès positionnel, spread [...set][0], Aho-Corasick,
  aho-corasick.ts, TypeScript strict, premier élément d'un Set.
---

# noUncheckedIndexedAccess sur une destructuration depuis un `Set`

## Le piège

Avec `noUncheckedIndexedAccess` activé, une destructuration positionnelle depuis
un itérable type le premier élément `T | undefined` — **même juste après un
contrôle `.size === 1`** :

```ts
const s: Set<string> = ...;
if (s.size === 1) {
  const [x] = s;      // x: string | undefined  ← alors qu'on sait qu'il y a 1 élément
}
```

TypeScript ne relie pas statiquement `s.size === 1` à l'accès positionnel : pour
lui, itérer un `Set` peut toujours ne rien rendre. Le compilateur casse alors
tout usage de `x` comme un `string`.

## La solution

Convertir en tableau puis indexer explicitement, avec un `as T` et un commentaire
justificatif :

```ts
// size === 1 garanti par le contrôle ci-dessus, non visible statiquement pour TS
const x = [...s][0] as string;
```

## Pourquoi

Même famille de piège que les accès tableau déjà rencontrés dans
`aho-corasick.ts`, résolus de la même façon. Ne pas désactiver
`noUncheckedIndexedAccess` pour contourner : le cast local + commentaire garde le
garde-fou actif partout ailleurs.

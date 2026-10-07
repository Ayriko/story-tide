---
name: use-server-module-async-only
description: >
  Erreur d'import trompeuse sur un fichier Next.js marqué "use server" (server
  actions). Déclencheurs : "use server", "The export X was not found in
  module", "The module has no exports at all", server action, constante
  exportée, export const, actions/auth.ts, messages d'erreur partagés entre
  action et composant, Next.js App Router.
---

# Un module `"use server"` n'exporte que des fonctions asynchrones

## Le symptôme

```
The export loginAction was not found in module [project]/src/actions/auth.ts
[app-ssr] (ecmascript). The module has no exports at all.
```

L'erreur pointe une action qui existe bel et bien, et un import sans rapport.

## La cause

Un fichier `"use server"` est compilé en manifeste d'actions : **chaque export
doit être une fonction `async`**. Une constante exportée (un objet de
messages, une regex, une config) invalide tout le module, et Next signale le
problème sur le premier import rencontré, pas sur la constante.

## La solution

Déplacer tout ce qui n'est pas une action dans un module ordinaire :

```ts
// src/lib/auth-messages.ts   (pas de "use server")
export const AUTH_MESSAGES = { … };

// src/actions/auth.ts
"use server";
import { AUTH_MESSAGES } from "@/lib/auth-messages";
export async function loginAction(…) { … }
```

## Règle

Dans `src/actions/*`, uniquement des `export async function`. Les constantes,
schémas Zod et messages vivent dans `src/lib/`. Quand « le module n'a aucun
export » alors qu'il en a, chercher un export non-fonction.

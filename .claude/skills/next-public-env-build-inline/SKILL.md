---
name: next-public-env-build-inline
description: >
  Code réservé aux tests (crochet e2e, outil de debug) protégé par
  process.env.NEXT_PUBLIC_* et retrouvé dans le bundle de prod. Déclencheurs :
  NEXT_PUBLIC_, élimination de code mort, dead code, tree-shaking, crochet e2e
  dans .next/static, window.__storyTideConstellation, variable d'env absente au
  build, next.config.ts env, inlining des variables publiques, code de test en
  production.
---

# Une `NEXT_PUBLIC_*` absente au build n'est PAS remplacée : la branche reste

## Le symptôme

KAN-87 (24/10/2026). Le crochet e2e de la Constellation était protégé par :

```ts
if (process.env.NEXT_PUBLIC_E2E_HOOKS === "1") {
  window.__storyTideConstellation = …;
}
```

Le plan supposait que, sans la variable au build, Next remplacerait la
condition par `undefined === "1"` et que le minifieur supprimerait la branche.
Après `npm run build`, `grep -rl "__storyTideConstellation" .next/static`
trouvait pourtant le code.

## La cause

Next n'inline une variable `NEXT_PUBLIC_*` que si elle **existe** au moment du
build. Absente, l'expression `process.env.NEXT_PUBLIC_E2E_HOOKS` reste telle
quelle dans le bundle client : la condition n'est pas constante, la branche est
gardée.

## La solution

Déclarer la variable dans `next.config.ts`, avec une valeur par défaut :

```ts
env: {
  NEXT_PUBLIC_E2E_HOOKS: process.env.NEXT_PUBLIC_E2E_HOOKS ?? "",
},
```

Elle vaut alors toujours une chaîne au build (`""` en prod, `"1"` dans le
`webServer.env` de `playwright.config.ts`), est inlinée, et la branche morte
disparaît.

## Règle

Tout code client gardé par une `NEXT_PUBLIC_*` « de test » : variable déclarée
dans `next.config.ts` `env` avec un défaut, puis preuve après build :
`grep -rl "<symbole du crochet>" .next/static` → aucun résultat. Ne jamais
affirmer l'élimination sans ce grep.

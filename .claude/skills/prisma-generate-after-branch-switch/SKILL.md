---
name: prisma-generate-after-branch-switch
description: >
  tsc ou vitest rouge juste après un changement de branche git, avec des erreurs
  Prisma sur des champs qui existent (ou n'existent plus) dans le schéma.
  Déclencheurs : "missing the following properties", "Object literal may only
  specify known properties", client Prisma périmé, src/generated/prisma, git
  checkout, git switch, merge de main, typecheck rouge sans modification,
  prisma generate, schema.prisma changé sur une autre branche.
---

# Client Prisma périmé après un changement de branche

## Le symptôme

`npm run typecheck` (ou les tests) échoue sur `main` ou sur une branche fraîche
sans qu'on ait touché au code : `missing the following properties …
contentVersion, scannedVersion` (ou l'inverse : une propriété « inconnue »
qui est pourtant dans `schema.prisma`).

## La cause

`src/generated/prisma/` n'est **pas versionné**. Il a été généré par
`postinstall` ou un `prisma generate` **depuis la branche d'avant**. Un
`git checkout` change `prisma/schema.prisma` mais ne régénère rien : le
client reflète l'ancien schéma.

## La solution

```bash
npx prisma generate
```

À lancer après **tout** changement de branche (ou `git pull` / merge) qui
touche `prisma/schema.prisma`. `git diff --stat <avant>..<après> -- prisma/`
dit si c'est le cas.

## Règle

Avant de diagnostiquer un typecheck rouge « inexpliqué » : `git log -1 --
prisma/schema.prisma` et `npx prisma generate`. Si ça passe, il n'y avait pas
de bug. En session d'agent, enchaîner systématiquement `git switch …` et
`npx prisma generate` dans le même pas.

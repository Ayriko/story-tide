---
name: env-var-seven-places
description: >
  Ajout ou renommage d'une variable d'environnement dans le schéma Zod
  (src/env.ts) qui fait tomber la CI étage par étage. Déclencheurs : src/env.ts,
  schéma Zod env, "Invalid input: expected string, received undefined",
  env.test.ts, playwright.config.ts webServer.env, ci.yml env:, Dockerfile
  stage builder, compose environment:, .env.example, .env.e2e.example,
  nouvelle variable SMTP_, variable d'env manquante en CI.
---

# Une variable d'env ajoutée = sept endroits à répercuter

## Le symptôme

Le code marche en local, puis la CI tombe en cascade : `test` (`SMTP_HOST:
Invalid input: expected string, received undefined`), `build`, `e2e`, puis
`docker build`, puis le déploiement. Chaque étage découvre un endroit oublié.

## La cause

Le schéma Zod de `src/env.ts` est strict : toute variable qu'il exige doit
exister dans **chaque** contexte d'exécution, et ces contextes listent les
variables explicitement.

## La solution — la liste, à parcourir en entier

1. `.env.example` — documentation + valeur locale.
2. `.env.e2e.example` — jeu e2e.
3. `src/env.test.ts` — jeu de variables de référence du test du schéma.
4. `playwright.config.ts` — `webServer.env` liste les variables une à une.
5. `.github/workflows/ci.yml` — bloc `env:` global (sert `test`, `build`, `e2e`).
6. `Dockerfile`, stage `builder` — placeholders non secrets pour `next build`.
7. `deploy/compose.staging.yml` et `compose.prod.yml` — blocs `environment:`
   de `app` / `worker` (+ les `.env.<env>` sur le VPS, hors repo).

`grep -rn "<VARIABLE_VOISINE>" --include=*.yml --include=*.ts --include=Dockerfile
--include=.env*` donne la liste exacte pour ce repo.

## Règle

Pas « faire attention » : un seul grep sur une variable voisine, puis les sept
fichiers dans le même commit. La réponse structurelle (test compose ↔ schéma
Zod, `docker build` en CI) reste à poser.

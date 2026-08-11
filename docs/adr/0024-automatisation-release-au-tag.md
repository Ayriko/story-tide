# ADR-0024 — Automatisation de la release au tag : script local + garde-fou CD

- **Statut** : accepté
- **Date** : 2026-08-11
- **Décideur** : Aymeric (MOE)

## Contexte et problème

KAN-44. À 3 reprises documentées, un tag est parti incohérent avec le dépôt :

- `v1.2.0` et `v1.2.1` ont été tagués alors que leur contenu était encore sous
  `## [Unreleased]` dans `CHANGELOG.md` — confirmé par `git show
  v1.2.1:CHANGELOG.md`, donc faux **au moment même du tag**, pas une
  négligence après coup.
- `package.json` `version` (lue par `GET /api/health`, supervision C4.1.2)
  est restée figée à `0.1.0` (scaffold `create-next-app`) de `v1.0.0-rc.1` à
  `v1.2.0` inclus — production a annoncé une fausse version pendant plusieurs
  itérations.
- Le correctif ponctuel de `d71f38f` n'a tenu qu'un tag : au tag `v1.2.1`
  suivant, `package.json` était déjà redésynchronisé.

Cause commune : la bascule `[Unreleased]` → section datée et le bump de
version sont deux gestes **manuels**, documentés comme tels dans `docs/cd.md`
(« à mettre à jour manuellement […] pas encore automatisé »). Tant qu'ils le
restent, ils se réoublieront — cf. dev-log 2026-07-24 (audit final avant
`v1.2.2`, où ce trou de process a été explicitement caractérisé). Le premier
tag `v1.3.0` est prévu le 13/08 : il faut retirer ces deux gestes des mains
humaines avant.

## Options envisagées

- **A — Commit de rattrapage par la CI** (écartée) : laisser la CD elle-même
  corriger `package.json`/`CHANGELOG.md` puis committer sur `main` après
  détection d'une incohérence au tag. Rejetée : un tag doit pointer sur un
  commit qui contient **déjà** son CHANGELOG et sa version — un commit de
  rattrapage après coup crée un tag qui pointe sur un état incohérent (le
  code livré et taggé n'est pas celui décrit par le CHANGELOG au même SHA), un
  bot committe sur `main` en dehors de toute revue, et l'incohérence n'est de
  toute façon détectée qu'après que l'image a potentiellement déjà commencé à
  builder. Le problème est traité en aval au lieu d'être empêché en amont.
- **B — Script local seul, sans garde-fou CD** (écartée) : `npm run release`
  rend le geste correct facile mais n'empêche rien si quelqu'un tague à la
  main (`git tag -a` direct, toujours possible, documenté comme procédure de
  secours). Aucune garantie structurelle.
- **C — Script local + garde-fou CD, garde-fou réutilisant le module de
  vérification** (retenue) : `scripts/release.ts` rend le geste correct
  facile (bascule CHANGELOG, sync `package.json`/`package-lock.json`, commit,
  tag annoté). Le job `release-consistency` de `cd.yml` rejoue exactement la
  même fonction pure (`verifyRelease`, `src/lib/release/verify.ts`) sur le tag
  poussé, avant `build-push` — un tag incohérent n'est jamais construit ni
  déployé. Une seule implémentation de la règle, testée par Vitest,
  consommée par les deux étages : aucune dérive possible entre « ce que le
  script produit » et « ce que la CD accepte ».

## Décision

Deux étages complémentaires (KAN-44) :

1. **`scripts/release.ts`** (`npm run release -- X.Y.Z[-rc.N] [--dry-run]`) :
   vérifie l'arbre propre et `main` à jour, bascule `[Unreleased]` en
   `## [X.Y.Z] - AAAA-MM-JJ` (tag final uniquement — un `-rc.N` ne touche
   jamais au CHANGELOG), synchronise `package.json` et `package-lock.json`
   via `npm version --no-git-tag-version`, crée le commit
   `chore(release): vX.Y.Z` et le tag annoté. Ne pousse jamais — Aymeric garde
   la main sur `git push`. `--dry-run` exécute tous les contrôles sans rien
   écrire.
2. **Job `release-consistency`** dans `cd.yml`, avant `build-push` (qui en
   dépend via `needs:`) : exécute `scripts/release.ts --verify
   "$GITHUB_REF_NAME"`, qui délègue la décision à `verifyRelease`
   (`src/lib/release/verify.ts`, pure, testée). Échoue le workflow si
   `package.json.version` ≠ version du tag (rc compris), si un tag final n'a
   pas de section `## [X.Y.Z]`, si un tag final laisse `[Unreleased]` non vide,
   si le tag n'est pas annoté, ou si son commit n'appartient pas à
   `origin/main`.

Logique pure isolée dans `src/lib/release/{version,changelog,verify}.ts`
(testée à 100 % par Vitest) ; `scripts/release.ts` ne fait que l'I/O (git,
fs, `npm version`) — même patron d'invocation que `prisma/seed/run.ts` et
`npm run worker` (`node --import tsx`, hors `src/`, alias `@/`).

**Changement de politique assumé** : un tag `-rc.N` synchronise désormais
`package.json` (`docs/cd.md` excluait volontairement les rc « pour éviter le
bruit »). Bénéfice : `/api/health` sur staging annonce enfin la rc exacte en
recette, conformément au brief KAN-44 (« rc compris »). En contrepartie, les
rc n'ont plus leur propre section CHANGELOG dédiée (contrairement à
`v1.2.0-rc.1`/`v1.1.0-rc.*` historiquement) — leur contenu atterrit dans la
section de la version finale qui les suit.

## Conséquences

- **Positives** : les 3 récidives documentées deviennent structurellement
  impossibles à reproduire pour un tag qui transite par `npm run release` —
  et impossibles à *déployer* même en cas de tag manuel incohérent (le
  garde-fou bloque avant `build-push`). Une seule source de vérité pour la
  règle (module `src/lib/release`), couverte par le seuil de couverture
  bloquant (`src/lib`) au même titre que le reste du code métier.
- **Négatives / à surveiller** : le garde-fou échoue **après** que le tag est
  poussé sur `origin` (il bloque le déploiement, pas la pose du tag) — la
  procédure de reprise (`docs/manuels/mise-a-jour.md`) est : supprimer le tag
  distant, corriger, re-taguer. Jamais de commit de rattrapage (option A,
  explicitement écartée). Le job `release-consistency` ajoute environ 60 s
  (`npm ci`) à chaque tag poussé — jugé négligeable face au coût d'un
  redéploiement incohérent en production.

## Compétence(s) servie(s)

C2.1.1 (chaîne CD, qualité) ; C2.2.1 (architecture — logique pure testée,
I/O isolée dans un script) ; C2.2.2 (tests — `src/lib/release` couvert par le
seuil bloquant) ; C2.4.1 (traçabilité — cause et décision documentées).

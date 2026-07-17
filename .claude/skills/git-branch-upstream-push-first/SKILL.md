---
name: git-branch-upstream-push-first
description: >
  Éviter qu'un push parte directement sur main parce qu'une nouvelle branche a
  hérité de main comme upstream. Déclencheurs : branche créée depuis origin/main,
  push direct sur main sans PR, upstream hérité, branch.<nom>.merge = refs/heads/main,
  git config branch merge, "feat/... jamais apparue sur GitHub", pas de branche/PR
  dédiée, git push -u origin, tracking branch, upstream d'une branche, erreur de
  création de branche.
---

# Toujours `git push -u origin <branche>` en premier après création d'une branche

## Le piège

Une branche créée depuis `origin/main` peut **hériter `origin/main` comme
upstream** au lieu d'elle-même :

```
branch.feat/ma-branche.merge = refs/heads/main   # ← devrait finir par /ma-branche
```

Résultat : un `git push` (sans argument) pousse les commits **directement sur
`origin/main`**, sans jamais créer la branche ni la PR sur GitHub. Le travail
n'est pas perdu, mais il n'y a ni branche dédiée ni revue — et « ma branche
n'apparaît pas sur GitHub » est le symptôme.

## Diagnostic

```bash
git config --get branch.<nom>.merge
# doit finir par /<nom>, PAS /main
```

## La solution

Après **chaque** création de branche, avant tout commit, poser explicitement
l'upstream :

```bash
git switch -c feat/ma-branche
git push -u origin feat/ma-branche   # ← première commande, fixe le bon upstream
```

`-u` (`--set-upstream`) attache la branche locale à `origin/feat/ma-branche`. Tous
les `git push` suivants iront au bon endroit, et la PR pourra être ouverte.

## Règle

`git push -u origin <branche>` est la **première** commande fournie après la
création d'une branche, jamais un `git push` nu tant que l'upstream n'est pas
vérifié.

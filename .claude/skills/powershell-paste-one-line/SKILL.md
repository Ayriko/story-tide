---
name: powershell-paste-one-line
description: >
  Commandes shell à exécuter dans PowerShell 5.1 sous Windows (git, npm, docker)
  depuis un prompt ou un bloc rendu par un agent. Déclencheurs : PowerShell,
  collage multi-lignes, seule la première ligne s'exécute, && non reconnu,
  "The token '&&' is not a valid statement separator", fichier absent du commit,
  git add git commit git push, Windows terminal, bloc de commandes.
---

# PowerShell 5.1 : une ligne par étape, `;` entre commandes

## Le symptôme

Un bloc de plusieurs commandes collé dans PowerShell 5.1 n'exécute que la
première ligne. Résultat typique : un `git add` parti, le `git commit` et le
`git push` jamais lancés — ou un fichier qui manque dans le commit (cas réel :
`entree-devlog-2026-10-07.md` absent du commit `docs` de la PR Silo).

## La cause

Le collage multi-lignes de PowerShell 5.1 ne traite pas le bloc comme un
script. Par ailleurs `&&` n'existe pas en 5.1 (seulement en PowerShell 7+) :
`git add . && git commit` est une erreur de syntaxe.

## La solution

- **Une seule ligne par étape** quand on rend des commandes à coller.
- Chaîner avec `;` quand il faut vraiment une ligne : `git add -A; git commit
  -m "…"; git push origin main`. Attention : `;` ne s'arrête pas sur une
  erreur, contrairement à `&&`.
- Pour une vraie condition d'arrêt : `git add -A; if ($?) { git commit -m "…" }`.

## Règle

Quand on écrit pour PowerShell : pas de bloc multi-lignes, pas de `&&`, pas de
`\` de continuation. Les blocs bash restent pour Git Bash / le VPS.

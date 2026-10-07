---
name: changelog-unreleased-merge-conflict
description: >
  Conflit git sur CHANGELOG.md quand deux branches ont chacune ajouté une entrée
  sous [Unreleased] (Keep a Changelog). Déclencheurs : CHANGELOG.md UU, both
  modified, conflit CHANGELOG, [Unreleased], Ajouté/Modifié/Corrigé, merge de
  main dans une branche feature, git show :2: :3:, fichier vidé pendant la
  résolution, marqueurs de conflit absents.
---

# Conflit `CHANGELOG.md` sur `[Unreleased]` entre branches parallèles

## Le symptôme

Au merge de `main` dans une branche (ou l'inverse), `CHANGELOG.md` passe en
`UU`. Dans le pire cas vu (07/10/2026), la copie de travail s'est retrouvée
**sans marqueurs `<<<<<<<` et sans aucune des deux entrées** : les deux
contributions avaient disparu.

## La cause

Keep a Changelog concentre tout le travail en cours sous une seule section
`[Unreleased]`. Deux branches qui y ajoutent chacune une sous-section
(« Modifié » d'un côté, « Corrigé » de l'autre) touchent les mêmes lignes :
git ne sait pas fusionner, et un outil de résolution mal manié peut vider la
zone au lieu de la garder.

## La solution

Ne jamais reconstituer de mémoire. Les deux versions sont dans l'index :

```bash
git show :2:CHANGELOG.md > /tmp/ours.md     # branche courante
git show :3:CHANGELOG.md > /tmp/theirs.md   # branche fusionnée
```

1. Reprendre `[Unreleased]` avec **les deux** sous-sections, dans l'ordre Keep
   a Changelog : Ajouté · Modifié · Déprécié · Retiré · Corrigé · Sécurité.
2. Vérifier que tout ce qui suit (`[x.y.z] - date` et plus bas) est identique
   dans `:2:` et `:3:` ; sinon prendre la version la plus récente.
3. `git add CHANGELOG.md` puis terminer le merge.

## Règle

Une branche = une entrée sous `[Unreleased]`, jamais une réécriture de ce qui
y est déjà. Au merge, résoudre `CHANGELOG.md` **en premier** et à partir de
l'index, pas de la copie de travail.

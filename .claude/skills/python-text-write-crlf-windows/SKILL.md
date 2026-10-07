---
name: python-text-write-crlf-windows
description: >
  Script Python de réécriture de fichiers (patch, remplacement, génération)
  lancé sous Windows qui convertit silencieusement les fins de ligne en CRLF.
  Déclencheurs : open(p, "w"), newline, CRLF, "CRLF will be replaced by LF",
  git diff tout le fichier, Prettier format:check rouge après un script, mode
  texte Windows, tr -cd '\r', sed -i 's/\r$//', réécriture par script.
  Complète gitattributes-eol-normalize.
---

# `open(p, "w")` en Python sous Windows écrit du CRLF

## Le symptôme

Après un script Python qui a réécrit des fichiers, git signale
`warning: in the working copy of '…', CRLF will be replaced by LF` sur chacun,
et `format:check` rougit. Le diff semble toucher toutes les lignes.

## La cause

En mode texte, Python traduit `\n` en fin de ligne native de la plateforme
(`\r\n` sous Windows) à l'écriture, même si le fichier lu était en LF.

## La solution

Toujours fixer `newline` à la lecture **et** à l'écriture :

```python
s = open(p, encoding="utf-8", newline="").read()
assert "\r" not in s            # garde-fou : le fichier était en LF
open(p, "w", encoding="utf-8", newline="").write(s2)
```

Vérifier : `tr -cd '\r' < fichier | wc -c` doit donner `0`. Réparer un
fichier déjà converti : `sed -i 's/\r$//' fichier`.

## Règle

Un script qui réécrit un fichier du repo passe `newline=""` ou n'est pas
lancé. Pour un patch ponctuel, préférer l'outil d'édition de l'agent, qui ne
touche pas aux fins de ligne.

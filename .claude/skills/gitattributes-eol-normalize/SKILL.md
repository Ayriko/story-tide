---
name: gitattributes-eol-normalize
description: >
  Drift de fins de ligne CRLF/LF entre Windows et une CI Linux qui fait rougir
  Prettier / format:check de façon récurrente. Déclencheurs : CRLF, LF,
  .gitattributes, core.autocrlf, "LF will be replaced by CRLF", Prettier endOfLine,
  format:check rouge, fins de ligne Windows CI Linux, git renormalize, eol=lf,
  normalisation fins de ligne.
---

# Normaliser les fins de ligne (CRLF/LF) — `.gitattributes`

## Le symptôme

`format:check` (Prettier) rouge de façon récurrente, warnings Git répétés
`LF will be replaced by CRLF`. Le fichier passe côté Windows local mais échoue en
CI Linux (ou l'inverse).

## La cause

`core.autocrlf=true` **sans `.gitattributes`** : Git convertit les fins de ligne à
la volée selon la plateforme, ce qui crée un drift CRLF/LF entre le poste Windows
et la CI Linux. Prettier voit alors des fins de ligne différentes de celles
attendues.

## La solution (les 4 réglages ensemble)

1. **`.gitattributes`** à la racine :
   ```
   * text=auto eol=lf
   ```
2. **Désactiver autocrlf** : `git config core.autocrlf false`
3. **Prettier** : `"endOfLine": "lf"` dans la config.
4. **Renormaliser l'existant** une fois : `git add --renormalize .` puis commit.

## Règle

`eol=lf` partout = une seule vérité (LF) pour Windows *et* CI Linux. Poser le
`.gitattributes` **dès l'init du repo** évite le drift plutôt que de le corriger
après coup.

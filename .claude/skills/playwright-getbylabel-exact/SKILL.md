---
name: playwright-getbylabel-exact
description: >
  Tests Playwright qui cassent en bloc après l'ajout d'un libellé accessible
  (aria-label, bouton afficher/masquer, tooltip) contenant le texte d'un
  autre libellé. Déclencheurs : getByLabel, getByRole name, "strict mode
  violation", "resolved to 2 elements", exact: true, correspondance partielle,
  aria-label, Testing Library vs Playwright, accessibilité casse les tests.
---

# `getByLabel` de Playwright matche **partiellement** par défaut

## Le symptôme

`strict mode violation: getByLabel('Mot de passe') resolved to 2 elements` —
14 tests e2e tombés d'un coup après l'ajout d'un bouton « Afficher le mot de
passe ».

## La cause

Les locators Playwright (`getByLabel`, `getByRole({ name })`, `getByText`)
font une correspondance **partielle et insensible à la casse** par défaut.
Testing Library, elle, est exacte par défaut : les tests unitaires ne voient
rien, seuls les e2e cassent.

## La solution

```ts
page.getByLabel("Mot de passe", { exact: true })
page.getByRole("button", { name: "Afficher le mot de passe", exact: true })
```

Passer `exact: true` partout où un libellé peut être le préfixe d'un autre
(16 occurrences corrigées d'un coup le 08/09/2026).

## Règle

Dans les e2e, `exact: true` sur tout `getByLabel` / `getByRole` dont le texte
est un mot courant du domaine. Quand on ajoute un libellé accessible, grep
son texte dans `e2e/` avant de lancer la suite.

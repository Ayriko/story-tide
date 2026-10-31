---
name: react19-form-action-reset
description: >
  Formulaire React 19 branché sur une Server Action par <form action> dont
  l'état saisi disparaît ou se désynchronise. Déclencheurs : case à cocher qui
  ne bascule qu'au second clic, checkbox contrôlée, interrupteur, form action,
  réinitialisation du formulaire après succès, choix perdu après une erreur,
  select remis à zéro, useOptimistic, useTransition, onSubmit, NativeTypeToggle,
  boîte « Nouvelle relation ».
---

# React 19 réinitialise un `<form action>` après l'action

## Les symptômes

- KAN-81 (20/10/2026) : l'interrupteur « Proposer le type » (case contrôlée
  dans un `<form action>`) ne basculait qu'au **second** clic. Le serveur avait
  bien enregistré ; le test jsdom était vert.
- KAN-87 (24/10/2026) : dans la boîte « Nouvelle relation », une erreur
  « Cette relation existe déjà. » aurait effacé le type et le sens choisis.

## La cause

Avec React 19, un `<form action={…}>` est **réinitialisé** à la fin de
l'action. Les champs non contrôlés reviennent à leur `defaultValue`, et un
état contrôlé se retrouve en décalage avec le DOM.

## Les solutions

- **Bascule simple** (interrupteur, case) : pas de formulaire, un bouton +
  `useOptimistic`, l'action appelée dans `startTransition`.
- **Formulaire dont il faut garder la saisie en cas d'erreur** : `onSubmit`
  avec `event.preventDefault()`, état React, action appelée dans
  `useTransition` ; l'erreur s'affiche sans toucher aux champs.
- `<form action>` reste bien pour un formulaire qu'on veut justement vider
  après succès et dont les erreurs ne coûtent rien à ressaisir.

## Règle

Jamais de case contrôlée dans un `<form action>`. Recette manuelle : basculer
deux fois de suite, et provoquer une erreur serveur pour vérifier que la
saisie reste.

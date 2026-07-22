---
name: renommage-grep-final
description: À exécuter à la FIN de tout renommage global, changement de lexique, wording, find-and-replace multi-fichiers, ou inventaire délégué à des agents/sous-tâches. Mots-clés — renommage, rename, lexique, wording, occurrences, inventaire, agents, grep, exhaustif.
---

# Renommage : le grep final non filtré est obligatoire

**Leçon (20/07/2026)** : 3 agents d'inventaire en parallèle sur `src/**` et `e2e/**`
ont raté `create-entity-form.test.tsx` (3 occurrences) — les tests de composants
n'étaient dans aucun scope. Retrouvé uniquement par un grep manuel large fait par
prudence avant les gates.

**Règle** : un inventaire par agents/scopes a des angles morts que le prompt n'a pas
anticipés. Avant de déclarer un renommage complet :

```bash
grep -rn --include="*" -iE '\bancien-terme\b' .   # TOUT le repo, aucun filtre de type
```

- `\b` (mot entier) + `-i` : évite les faux positifs type « affiche » pour « fiche ».
- Vérifier aussi : tests de composants (`*.test.tsx`), specs e2e, docs/, messages
  d'erreur dans services/actions, README, CHANGELOG.
- Les assertions de texte des tests se mettent à jour **dans le même commit** que
  le code — rien ne reste rouge entre deux commits.
- Corollaire : ne jamais écrire « c'est fait/commité » sans vérifier
  (`git show --stat <sha>`, `git status`).

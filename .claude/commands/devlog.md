---
description: Clôture de session — propose une entrée dev-log complète, prête à coller
---

La session de travail se termine. Produis une **proposition d'entrée dev-log**, prête à
copier-coller. Le fichier `dev-log.md` vit HORS du repo : tu ne crées ni ne modifies
aucun fichier — tu proposes du texte, c'est Aymeric qui le colle.

## Avant d'écrire, passe la session en revue et collecte :
- Ce qui a été **réellement fait** (étapes du plan terminées / entamées, commits préparés
  avec leurs messages, fichiers créés/modifiés — reste factuel, ne gonfle rien).
- Les **décisions prises** : quoi, pourquoi, quelles alternatives écartées, et qui a
  tranché (Aymeric ou proposition validée). Une décision sans justification ne vaut rien.
- Les **gotchas** : tout ce qui a surpris, cassé, ou demandé un contournement — avec le
  message d'erreur EXACT (copié, pas paraphrasé) et la solution. C'est le contenu à plus
  forte valeur du dev-log (et la matière première des futures skills).
- Les **commandes** non triviales utilisées qui resserviront (avec un commentaire d'usage).
- L'état des **garde-fous qualité** en fin de session : lint / typecheck / tests /
  couverture — passent ou pas, et le chiffre de couverture si disponible.
- Le **mapping certification** : quelles compétences C2.x (voire C3.x/C4.x) la session
  a fait avancer, et quelles docs du repo ont été touchées en conséquence
  (/docs/*, ADR, CHANGELOG, cahier-recettes).
- Ce qui reste **ouvert** : tâches non finies, questions à trancher par Aymeric,
  prochaine étape logique.

## Format de sortie — EXACTEMENT cette structure :

```markdown
### Session — AAAA-MM-JJ — <titre court : l'objectif de la session>

**Thèmes abordés :**
- <sujets traités, 1 ligne chacun>

**Décisions prises :**
- <décision — justification courte — alternatives écartées — qui a tranché>
- (si aucune : « Aucune — session d'exécution pure. »)

**Éléments notables / appris (gotchas) :**
- <erreur exacte → cause → solution> / <surprise, subtilité, piège évité>
- (candidat skill si le piège est susceptible de se reproduire : le signaler)

**Commandes utiles de la session :**
- `<commande>` — <à quoi elle sert> (omettre la section si rien de notable)

**Livrables produits :**
- <fichiers/features/docs livrés + commits associés + état des gates :
  lint ✅/❌ · typecheck ✅/❌ · tests ✅/❌ · couverture XX %>

**Avancement certification :**
- <C2.x.y : ce qui a concrètement avancé + doc repo mise à jour en face>

**À faire / suite :**
- <reste à faire, questions ouvertes pour Aymeric, prochaine étape logique>
- Reporter cette entrée dans dev-log.md (hors repo) + redéposer dans le projet Claude.
- Mettre à jour le board Jira (stories touchées → bonne colonne).
```

## Règles
- **Français**, factuel, dense — pas de remplissage, pas d'auto-congratulation.
- **Append-only** : tu proposes UNE entrée datée du jour ; jamais de réécriture de
  l'existant, jamais de résumé des sessions passées.
- Si la session a produit une **décision technique structurante** (choix d'outil, de
  patron, de config non triviale), propose EN PLUS de l'entrée une ligne au format de la
  table « Décisions techniques » du dev-log :
  `| AAAA-MM-JJ | **décision** | alternatives | justification |`
- Si un bug/piège vaut d'être retrouvé vite, propose EN PLUS une ligne au format de la
  table « Erreurs rencontrées & Solutions » :
  `| AAAA-MM-JJ | symptôme (message exact) | cause | solution |`
- Termine par un rappel d'une ligne si des choses n'ont PAS été committées.
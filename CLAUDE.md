# Story Tide — CLAUDE.md

## Contexte
Story Tide : plateforme SaaS de worldbuilding (wiki d'entités + éditeur riche + graphe de
relations + LIAISON AUTOMATIQUE des entités via un automate Aho-Corasick maison — c'est LE
différenciateur produit). Projet de certification RNCP39583 (Expert en développement
logiciel, Bac+5). Studio fictif commanditaire : Tidemark Studio. Développeur : Aymeric
(lead dev / référent technique). **Rendu Bloc 2 : 24 juillet 2026** = code source + dossier
30 pages. La spécification complète et le planning font foi :
`/docs/spec-technique-bloc2.md` — la lire avant toute tâche non triviale.

## Enjeu certification — 4 critères ÉLIMINATOIRES, non négociables
1. **C2.2.1 Architecture** : monolithe Next.js en couches strictes + worker séparé.
   Patrons nommés et respectés (ports & adapters pour queue/storage).
2. **C2.2.2 Tests** : les tests unitaires doivent couvrir la majorité du code.
   Toute feature arrive AVEC ses tests. Seuil de couverture CI bloquant (≥80 % sur
   src/lib + src/services). Ne jamais baisser le seuil pour faire passer un build.
3. **C2.2.3 Sécurité + accessibilité** : OWASP Top 10 (mapping tenu à jour dans
   /docs/securite-owasp.md à CHAQUE mesure codée) + RGAA (HTML sémantique, clavier,
   focus visible, contrastes, labels — dès le premier composant).
4. **C2.3.1 Recette** : /docs/cahier-recettes.md tenu à jour quand une
   fonctionnalité est livrée. Nomenclature TST-<CAT>-<NNN> (AUT, MND, ENT, LNK, GRF,
   SEC, QOT), 6 champs par scénario (Description, Objectif, Préconditions, Étapes,
   Résultat attendu, Critères d'acceptation), cas passants ET cas d'échec, scénarios
   sécurité dédiés. Bogues : P0 <24h / P1 <72h / P2 planifié, correctif toujours
   accompagné d'un test de non-régression.

## Stack (ACTÉE — ne pas remettre en cause sans accord explicite d'Aymeric)
TypeScript strict · Next.js App Router (RSC + Server Actions, PAS de tRPC, PAS de backend
séparé) · Tailwind (dark mode par défaut) · Tiptap pur (PAS BlockNote/Lexical) ·
Cytoscape.js · PostgreSQL + Prisma · Better Auth (email+mdp, sessions en base) ·
pg-boss derrière l'interface JobQueue (PAS de Redis/BullMQ) · MinIO via interface Storage
(SDK S3) · Zod à toutes les frontières · Vitest + Testing Library + Playwright (smoke) ·
Docker/Compose multi-stage non-root · Traefik · GitHub Actions → ghcr.io → SSH pull sur
VPS OVH. Aho-Corasick : implémentation MAISON dans src/lib/linker (zéro dépendance).
3 environnements : dev local · staging sur le VPS (sous-domaine Traefik, images X.Y.Z-rc.N,
données de test) · production (images X.Y.Z, tags annotés). La recette s'exécute sur staging.
Seuils qualité/perf (C2.1.1, bloquants) : lint 0 warning · couverture ≥80 % sur src/lib +
src/services (rapport en artefact CI + commentaire de PR) · p95 API < 500 ms · liaison auto
visible < 5 s après debounce · taux d'erreur < 1 %.

## Architecture — règles dures
- Couches : app/ (UI) → src/actions (frontière : Zod + session) → src/services
  (métier + AUTORISATION) → src/db (Prisma). Jamais de Prisma importé dans app/.
- Toute Server Action : 1) parse Zod, 2) session vérifiée, 3) appartenance au monde
  vérifiée en service, 4) erreurs typées (jamais de throw brut vers le client).
- src/lib/linker : TS pur, aucune dépendance — 100 % testé unitairement.
- Les services dépendent des interfaces JobQueue/Storage, jamais des implémentations.
- Une Relation origin=MANUAL n'est JAMAIS écrasée par un re-scan automatique.
- Entity.aliases[] fait partie du dictionnaire de liaison au même titre que name.

## Qualité & workflow
- **Git : Aymeric garde la main.** Claude ne lance JAMAIS `git commit`, `git push`,
  `git merge`, `git tag` ni aucune commande qui écrit dans l'historique. Claude prépare :
  il indique quels fichiers stager, fournit le message de commit conventionnel prêt à
  copier, et la commande exacte à lancer — c'est Aymeric qui l'exécute. (`git status`,
  `git diff`, `git log` en lecture : autorisés.)
- Conventional commits (feat/fix/test/docs/chore). Branches feat/* courtes, PR
  auto-relues avec description quoi/pourquoi/preuve de test. Hook Husky pre-commit
  (lint + typecheck sur fichiers stagés). CHANGELOG.md format Keep a Changelog
  (Ajouté/Modifié/Corrigé/Supprimé) tenu à chaque version, tags annotés.
- TS strict : pas de `any`, pas de `as` de complaisance, pas de `@ts-ignore` sans
  justification en commentaire.
- Lint + typecheck + tests DOIVENT passer avant tout commit. Ne jamais committer du
  code qui casse la CI. Ne jamais désactiver un test pour "avancer".
- Secrets : uniquement en variables d'env validées par Zod au démarrage. Jamais en dur.
- Accessibilité : composants interactifs = éléments natifs (button, a, label) d'abord ;
  ARIA seulement en complément. Vérifier la navigation clavier de tout nouveau composant.
- Definition of Done d'une feature : code + tests + authz vérifiée + a11y vérifiée +
  entrée cahier de recettes + docs impactées mises à jour (manuel, OWASP, ADR si décision).
- Documentation : décisions d'architecture → ADR dans /docs/adr/ (contexte, options,
  décision, conséquences). Manuels dans /docs/ tenus au fil de l'eau (C2.4.1).
- À la fin de chaque session : proposer une entrée pour dev-log.md (ne jamais réécrire
  l'existant, uniquement ajouter).

## Principes de travail (adapté de Karpathy)
1. **Réfléchir avant de coder** : annoncer explicitement ses hypothèses ; si plusieurs
   interprétations existent, les présenter au lieu d'en choisir une en silence ; si une
   approche plus simple existe, le dire ; si quelque chose est flou, s'arrêter et demander.
2. **Simplicité d'abord** : le minimum de code qui résout le problème. Pas de feature non
   demandée, pas d'abstraction pour du code à usage unique, pas de configurabilité
   spéculative. Test : « un senior dirait-il que c'est sur-compliqué ? » → simplifier.
3. **Modifications chirurgicales** : ne toucher que ce que la tâche exige. Pas de refactor
   ni de "nettoyage" du code adjacent ; respecter le style existant ; le code mort
   pré-existant se signale, ne se supprime pas. Chaque ligne du diff doit se tracer à la
   demande. Nettoyer uniquement les orphelins créés par SES propres changements.
4. **Exécution pilotée par l'objectif** : transformer les tâches en critères vérifiables
   (« corrige le bug » → « écris un test qui le reproduit, puis fais-le passer »). Pour le
   multi-étapes : plan bref au format `étape → vérif`. (Tâches triviales : jugement.)

## Interdits
- Introduire microservices, Redis, tRPC, monorepo, BlockNote, ou toute techno hors
  stack actée sans demander.
- Modifier les ancres chiffrées du Bloc 1 (84 j/h, ~40 k€, budgets figés).
- Élargir le périmètre S30 (cartes, timelines, import/export, secrets, wiki public,
  Stripe = HORS livrable — refuser poliment et noter au backlog).
- Livrer une feature sans ses tests.
- Exécuter soi-même commit/push/merge/tag (voir règle Git ci-dessus).
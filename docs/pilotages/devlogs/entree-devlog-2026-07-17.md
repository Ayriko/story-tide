### Session — 2026-07-17 — Surlignage des liaisons (KAN-19, suite) + audit MVP via Jira

**Thèmes abordés :**
- Diagnostic et correction d'un bug d'upstream Git (branche `feat/linker-services`
  jamais apparue sur GitHub) découvert en tout début de session.
- Surlignage live des mentions d'entités dans l'éditeur (KAN-19, suite) : moteur
  partagé serveur/client, remapping de positions, plugin ProseMirror, navigation
  Ctrl/Cmd+clic, liste accessible « Entités liées », preuve e2e bout en bout.
- Audit de l'état réel du MVP via accès direct au board Jira (connecteur
  Atlassian), en réponse à une question de priorisation d'Aymeric.

**Décisions prises :**
- **Ambiguïté résolue en amont d'une fonction pure partagée** (`resolveLinks`,
  `src/lib/linker/resolve-links.ts`) plutôt que dupliquée entre le worker et le
  surlignage client — garantit que ce qui est surligné est exactement ce qui
  devient une `Relation`, par construction. Décision d'implémentation, pas de
  choix soumis à Aymeric.
- **Scan LIVE côté client plutôt que positions persistées par le worker**
  (ADR-0010) — retenu par Aymeric parmi 3 options présentées (positions serveur
  persistées, mark ProseMirror persisté, re-scan client). Justification : retour
  visuel instantané sans dépendre du worker ; le test de passage à l'échelle déjà
  écrit (200 entités × 100 000 caractères, ~15 ms) couvre le risque perf.
- **Navigation Ctrl/Cmd+clic (souris) + liste accessible séparée (clavier/lecteur
  d'écran)** — tranché par Aymeric via question à choix (3 options : Ctrl/Cmd+clic,
  bulle au survol, clic simple navigue). Un `contenteditable` ne peut pas rendre le
  surlignage cliquable au clavier sans risquer de casser l'édition normale.
- **Deux requêtes à select plat plutôt qu'un join Prisma imbriqué** dans
  `listOutgoingLinks` (`relation-service.ts`) — le skill projet
  `prisma-mock-partial-select` documente le piège de typage des mocks sur un
  select imbriqué (`target: { select: {...} } }`) ; la version à deux requêtes
  reste testable avec les factories `make<Model>` déjà établies, sans cast.
- **Worker réel démarré par `e2e/global-setup.ts`** (via `spawn` + fonction de
  teardown retournée par `globalSetup`) plutôt qu'un mock du job de liaison en
  e2e — nécessaire pour que la liste « Entités liées » (alimentée par une vraie
  `Relation` en base) soit vérifiable en conditions réelles, pas seulement le
  surlignage live (qui ne dépend pas du worker).
- **Backlinks (KAN-24) choisis comme prochain chantier**, avant le graphe
  Cytoscape (KAN-25) — décision d'Aymeric parmi 4 options présentées (backlinks
  rapide / graphe / finir Playwright-CI / passe visuelle), après l'audit Jira
  révélant que le graphe et les quotas sont encore à zéro alors que planifiés
  cette semaine dans la spec.

**Éléments notables / appris (gotchas) :**
- **Bug d'upstream Git** : `feat/linker-services` créée depuis `origin/main` avait
  hérité `origin/main` comme upstream (`branch.feat/linker-services.merge =
  refs/heads/main`, vérifiable via `git config --get branch.<nom>.merge`), donc le
  `git push` a poussé les 3 commits **directement sur `origin/main`** sans jamais
  créer de branche/PR dédiée sur GitHub — pas une manip d'Aymeric, une erreur de
  création de branche de ma part. Corrigé : toujours fournir `git push -u origin
  <branche>` comme **première** commande après la création d'une branche, avant
  tout commit. Mémorisé (`branche-upstream-push-first.md`) pour ne pas reproduire.
- **`Decoration.type.attrs` n'est pas exposé par les types publics de
  `@tiptap/pm/view`** : `TS2339: Property 'type' does not exist on type
  'Decoration'.` malgré un `.type.attrs` bien réel à l'exécution (vérifié via
  `node -e`). Seule `decoration.spec` (le 4ᵉ argument optionnel de
  `Decoration.inline(from, to, attrs, spec)`) est publique et typée — le
  `targetId` y est dupliqué pour permettre l'inspection en test sans caster sur
  un champ privé.
- **`Playwright globalSetup` peut retourner une fonction de teardown**, appelée
  après tous les tests (confirmé en lisant `playwright/lib/runner/*.js` :
  `createGlobalSetupTask` stocke le retour de `globalSetup` et, en phase
  `teardown`, l'appelle `if (typeof globalSetupResult === "function")`) — pas
  documenté explicitement dans le `.d.ts` mais bien réel. Utilisé pour démarrer/
  arrêter le worker pendant tout le run e2e.
- **`npm run test:e2e 2>&1 | tail -150` masque toute sortie jusqu'à la fin** :
  `tail` sans `-f` doit lire tout le flux avant de savoir quelles sont les 150
  dernières lignes, donc rien ne s'affiche avant la fin du process. Un premier
  run est resté à 0 octet de sortie pendant 13+ minutes, ce qui ressemblait à un
  vrai blocage (worker mal démarré, boucle de poll infinie...). Diagnostic :
  relancé sans le pipe `tail` → le run réel a pris 17,8 s (2/2 tests verts). Piège
  à éviter : ne jamais piper un run potentiellement long vers `tail -N` sans `-f`
  si on veut du feedback en direct ; candidat pour une note rapide, pas
  forcément un skill dédié (usage ponctuel de diagnostic).
- **Vérification empirique par script jetable avant d'écrire les tests
  permanents**, réutilisée deux fois cette session (remapping de positions,
  décorations du plugin) : un `tsx` de quelques dizaines de lignes contre le
  vrai schéma ProseMirror/`EditorState`, supprimé après usage — a évité d'écrire
  des tests sur une hypothèse fausse (ex. le cas de liste imbriquée, plusieurs
  niveaux de blocs, qui aurait pu produire des séparateurs en trop).
- **Audit Jira direct** (connecteur Atlassian, accès lecture+écriture confirmé) a
  révélé un écart entre la mémoire de session et l'état réel du board : KAN-24
  (backlinks) et KAN-25 (graphe) n'étaient pas ceux qu'on pensait avoir avancés ;
  KAN-11/KAN-12 (Storage, Auth) marqués « En cours » sur Jira alors que terminés
  dans le code — statuts probablement obsolètes, signalés à Aymeric plutôt que
  corrigés directement (action de modification d'un système partagé, jamais sans
  confirmation).

**Commandes utiles de la session :**
- `git config --get branch.<nom>.merge` — révèle l'upstream réel d'une branche
  (doit finir par `/<nom>`, pas `/main`) ; diagnostic direct du bug d'upstream.
- `node -e "..."` (introspection runtime d'un module, ex. `Decoration.inline(...)`)
  — utile quand les types déclarés (`.d.ts`) et le comportement réel divergent.
- `npx tsx <script>.ts` puis suppression immédiate — vérification empirique
  jetable contre du code réel avant d'écrire des tests permanents.

**Livrables produits :**
- `src/lib/linker/resolve-links.ts` + tests (extraction pure, partagée worker/client).
- `src/lib/tiptap-positions.ts` + tests (remapping `plainText` ↔ ProseMirror).
- `src/lib/tiptap-link-highlight.ts` + tests (plugin ProseMirror de surlignage).
- `src/services/relation-service.ts` + tests (`getIgnoredTargetIds`, `listOutgoingLinks`).
- `entity-editor.tsx`, `page.tsx`, `linked-entities.tsx` (nouveau) : câblage UI,
  Ctrl/Cmd+clic, liste accessible.
- `e2e/link-highlight.spec.ts` (nouveau) + `e2e/global-setup.ts` (worker réel démarré).
- `docs/adr/0010-surlignage-liaisons-scan-client.md` (nouveau) + index ADR à jour.
- `docs/cahier-recettes.md` (`TST-LNK-004`), `docs/spec-technique-bloc2.md` (§4.4
  point 5), `docs/accessibilite-rgaa.md` (split souris/clavier), `CHANGELOG.md`.
- 5 commits (tous confirmés committés et poussés par Aymeric) :
  `refactor: extraire resolveLinks...`, `feat: remapping positions...`,
  `feat: surlignage live des mentions...`, `feat: liste accessible des entités
  liées...`, `test: e2e surlignage + liste liée ; docs...`.
- Gates en fin de session : lint ✅ (0 warning) · typecheck ✅ · tests ✅
  (174 tests unitaires) · couverture 98,72 % (seuil bloquant 80 %) · build ✅ ·
  e2e ✅ (2/2, vérifié en conditions réelles avec le vrai worker).

**Avancement certification :**
- **C2.2.1** : modules purs `src/lib` (resolve-links, tiptap-positions,
  tiptap-link-highlight) réutilisés serveur (worker) et client (éditeur) sans
  dupliquer la logique métier.
- **C2.2.2** : 174 tests, couverture 98,72 % sur `src/lib`+`src/services` (seuil
  80 % maintenu) ; wiring framework pur (Extension Tiptap, hook
  `props.decorations`) explicitement exclu de la couverture unitaire, comme la
  convention déjà établie pour les wrappers SDK fins — couvert par l'e2e à la
  place.
- **C2.2.3** : séparation documentée surlignage (affordance souris) / liste
  accessible (clavier, lecteur d'écran) — `docs/accessibilite-rgaa.md`, ADR-0010.
- **C2.3.1** : `TST-LNK-004` au cahier de recettes.
- **C2.4.1** : ADR-0010 (alternatives explicitées, décision justifiée).

**À faire / suite :**
- **Backlinks (KAN-24)** : prochain chantier, plan déjà écrit et approuvé —
  `listIncomingLinks` symétrique à `listOutgoingLinks`, section « Mentionné par ».
- **Graphe Cytoscape (KAN-25)** : zéro ligne de code à ce jour, marqué « graphe
  obligatoire » dans le périmètre S30 de la spec, planifié cette semaine
  (16-18/07) — le plus gros chantier restant avant le 24/07.
- **Quotas freemium (KAN-18)**, **recherche basique (KAN-17)**, **upload d'images
  (KAN-16)** : non commencés.
- **Mentions manuelles @ (reste de KAN-22)**, **UI ignorer/délier une occurrence
  (KAN-23)** : le moteur les supporte déjà côté données (`LinkIgnore`), aucune UI.
- **Câblage CI du smoke Playwright (reste de KAN-34)** : fait en local, pas dans
  GitHub Actions.
- **CD vers le VPS OVH (KAN-10)** : pas commencé, VPS pas encore commandé.
- **Statuts Jira à vérifier par Aymeric** : KAN-11 (Storage/MinIO) et KAN-12
  (Better Auth) marqués « En cours » alors que terminés dans le code.
- Reporter cette entrée dans `dev-log.md` (hors repo) + redéposer dans le projet Claude.
- Mettre à jour le board Jira (KAN-19 et sous-tâches liées au surlignage → Done ;
  KAN-11/KAN-12 à vérifier ; KAN-24 à passer en cours au démarrage des backlinks).

---

## Décisions techniques

| Date | Décision | Alternatives | Justification |
|---|---|---|---|
| 2026-07-16 | Push -u en première commande à la création de toute branche | Créer la branche puis pousser en fin de tâche | Bug découvert : upstream hérité de `origin/main` a fait pousser des commits directement dans main sans branche GitHub dédiée |
| 2026-07-16 | Re-scan live côté client (ADR-0010) pour le surlignage | Positions serveur persistées ; mark ProseMirror persisté | Retour instantané sans dépendre du worker ; pas d'impact sur le schéma de contenu partagé |
| 2026-07-16 | Ctrl/Cmd+clic (souris) + liste accessible séparée (clavier) | Clic simple navigue ; bulle au survol | Un contenteditable ne peut pas rendre un clic simple à la fois navigable et éditable sans conflit |
| 2026-07-16 | Deux requêtes Prisma à select plat plutôt qu'un join imbriqué (`listOutgoingLinks`) | `select: { target: { select: {...} } } }` en un seul `findMany` | Évite le piège de typage des mocks sur select imbriqué (skill `prisma-mock-partial-select`) |
| 2026-07-16 | Worker réel démarré par `e2e/global-setup.ts` (spawn + teardown) | Mocker le job de liaison en e2e | La liste « Entités liées » dépend d'une vraie `Relation` écrite par le worker, pas testable sans lui |

## Erreurs rencontrées & Solutions

| Date | Symptôme exact | Cause | Solution |
|---|---|---|---|
| 2026-07-16 | Aucune branche `feat/linker-services` sur GitHub malgré 3 commits locaux | `branch.feat/linker-services.merge = refs/heads/main` (upstream hérité de `origin/main` à la création) | `git push -u origin <branche>` comme première commande de toute nouvelle branche |
| 2026-07-16 | `TS2339: Property 'type' does not exist on type 'Decoration'.` | `Decoration.type.attrs` existe à l'exécution mais n'est pas dans les types publics de `@tiptap/pm/view` | Dupliquer la donnée dans `spec` (4ᵉ argument de `Decoration.inline`), seule partie publique typée |
| 2026-07-16 | `npm run test:e2e \| tail -150` : 0 octet de sortie pendant 13+ minutes | `tail` sans `-f` doit atteindre l'EOF avant d'afficher quoi que ce soit | Relancer sans le pipe `tail` pour du feedback en direct ; run réel : 17,8 s, 2/2 verts |

⚠️ Rien en attente de commit à la clôture de cette session : les 5 commits du
surlignage KAN-19 sont tous confirmés committés et poussés par Aymeric. Le plan
des backlinks (KAN-24) est approuvé mais **le code n'est pas encore écrit** — à
faire à la prochaine reprise.

---

### Session — 2026-07-17 — Backlinks + vidage colonne WIP (KAN-11/12/34) + mentions manuelles @ (KAN-22)

**Thèmes abordés :**
- Backlinks (KAN-24) : `listIncomingLinks` + section « Mentionné par ».
- Colonne WIP Jira pleine (4/4) : vidage complet avant d'attaquer le graphe
  Cytoscape (KAN-25) — clôture de KAN-11 (S3), KAN-12 (déconnexion), KAN-34
  (câblage CI e2e), et achèvement de KAN-22 (mentions manuelles @, les 5 étapes).
- Instabilité récurrente de l'extension Claude in Chrome (timeouts d'injection
  de script) ayant bloqué plusieurs vérifications navigateur dans la session.
- Diagnostic post-merge d'un « Mentionné par » vide malgré un alias correspondant
  — finalement pas un bug de code.

**Décisions prises :**
- **4 tickets WIP traités en une session, pas une sélection partielle** —
  choisi par Aymeric via question à choix multiple, plutôt que de n'en traiter
  qu'un ou deux avant le graphe.
- **Séquencement du plus petit au plus gros** (KAN-11 → KAN-12 → KAN-34 →
  KAN-22), chacun sur sa propre branche/PR — proposition validée implicitement
  par Aymeric en poursuivant sans objection ; permet de libérer un créneau WIP
  à chaque merge plutôt qu'attendre la fin des quatre.
- **Rendu de la mention manuelle sans préfixe `@` visible** — demandé par
  Aymeric après un test manuel (« le `@` pourrait être retiré une fois la
  liaison faite ») ; implémenté directement dans `renderHTML` plutôt qu'un
  retrait après coup, plus simple que redouté.
- **`renderText: () => ""` sur le node `mention`** — décision technique pour
  éviter que le libellé d'une mention manuelle ne réapparaisse dans le
  `plainText` scanné par le worker AUTO (auto-détection de sa propre mention).
  Voir ADR-0011.
- **Réconciliation des `Relation MANUAL` synchrone** (dans l'action de
  sauvegarde), contrairement au scan AUTO asynchrone — une mention manuelle est
  une intention explicite et peu nombreuse par fiche, le diff reste dans le
  budget perf fait en ligne. Voir ADR-0011.
- **Bug `global-setup.ts` (workers e2e orphelins) explicitement NON corrigé**
  cette session — nettoyé manuellement à chaque occurrence plutôt que d'élargir
  le périmètre de KAN-22 à une correction d'infrastructure e2e sans lien direct.

**Éléments notables / appris (gotchas) :**
- **`@tiptap/suggestion` ferme la popup au premier espace tapé dans la requête**
  (`allowSpaces` vaut `false` par défaut, le regex de correspondance interne
  exclut `\s`). Trouvé par le test e2e (`manual-mention.spec.ts` tapait un nom
  composé complet avant de sélectionner) — **jamais reproduit manuellement**
  par Aymeric, qui sélectionnait sans taper d'espace. Corrigé par
  `allowSpaces: true`. Preuve concrète de la valeur du test e2e par rapport à
  la recette manuelle.
- **Un test « unitaire » peut taper une vraie base de dev sans le signaler** :
  `entity-content.test.ts` n'avait pas de mock pour `@/services/relation-service`
  (ajouté cette session) — les appels à `reconcileManualMentions` atteignaient
  la VRAIE `@/db/client` ; comme le Postgres dev tournait déjà (Docker up pour
  une vérification navigateur), les requêtes échouaient contre une base réelle
  sans donnée attendue, mais l'échec était avalé par le `try/catch` non-fatal
  de l'action — les tests passaient donc « par accident », sans jamais
  vérifier le vrai comportement. Corrigé en ajoutant le mock manquant. Piège
  générique (tout `try/catch` non-fatal masque un mock manquant) — candidat
  skill si ça se reproduit.
- **Faux blocage e2e distinct du piège `tail` de la session précédente** : un
  run Playwright est resté bloqué ~7-8 min sans aucune sortie (pas même le
  bandeau `dotenvx` habituel). Cette fois **pas** un artefact de pipe — de
  vrais process `tsx src/worker/index.ts` orphelins de runs e2e précédents
  (le `worker.kill()` de `global-setup.ts` ne tue pas toute l'arborescence de
  process sous Windows avec `spawn(..., { shell: true })`) tenaient des
  connexions ouvertes sur `story_tide_e2e`, bloquant le `DROP SCHEMA public
  CASCADE` du prochain `global-setup.ts`. Diagnostiqué via
  `wmic process where "name='node.exe'" get ProcessId,CommandLine` (filtré sur
  `worker/index`), résolu en tuant les PID orphelins. Distinction utile : un
  vrai blocage a un état observable (connexions ouvertes, verrou DB) ; un faux
  blocage n'en a aucun.
- **`next dev` refuse de démarrer un second serveur pour le même projet, même
  sur un port différent** : `⨯ Another next dev server is already running`
  pointant vers le port 3000 alors que Playwright tentait de démarrer son
  `webServer` sur le port 3100 — verrou par **projet**, pas par port. A
  bloqué un run e2e tant que le serveur dev resté ouvert (port 3000) n'a pas
  été tué.
- **`npm run worker` échoue hors contexte Next** (`tsx src/worker/index.ts`
  seul ne charge pas `.env`, contrairement à `next dev`/`next build`) :
  `Variables d'environnement invalides : DATABASE_URL: Invalid input: expected
  string, received undefined` (+ 9 autres). Contournement ponctuel :
  `npx tsx --require dotenv/config src/worker/index.ts`.
- **« Mentionné par » vide malgré un alias correspondant → pas un bug** :
  Aymeric avait raison de soupçonner l'alias, mais la vraie cause était que
  **aucun worker ne tournait sur la base de dev** pendant ses tests manuels —
  les jobs `entity-linking` restaient à l'état `created` dans `pgboss.job`
  (`completed_on: null`), jamais consommés. `resolveLinks`/le dictionnaire
  fonctionnaient correctement (vérifié en rejouant la résolution manuellement).
  Diagnostiqué par script jetable (dictionnaire, matches, `resolveLinks`,
  requête directe sur `pgboss.job`) plutôt que supposé ; résolu en démarrant le
  worker manuellement, qui a traité les 3 jobs en attente.
- **Extension Claude in Chrome instable toute la session** (timeouts
  d'injection de script, y compris sur `example.com`) — recherché par Aymeric,
  cause probable = timeout du service worker MV3 / boucle de reconnexion CDP
  (bugs connus de l'extension, pas du code du projet). Mémorisé
  (`chrome-extension-service-worker-timeout.md`) : essayer `/chrome reconnect`
  puis fermer Claude Desktop avant un redémarrage complet de Chrome.

**Commandes utiles de la session :**
- `wmic process where "name='node.exe'" get ProcessId,CommandLine` — liste les
  process Node avec leur ligne de commande complète, seul moyen fiable
  d'identifier lequel est un worker/serveur orphelin avant de le tuer.
- `taskkill //PID <pid> //F` — tuer un process orphelin identifié (utilisé une
  dizaine de fois cette session pour des workers e2e/dev server orphelins).
- `npx tsx --require dotenv/config src/worker/index.ts` — lancer le worker
  manuellement en dehors de `next dev`/Docker, avec `.env` chargé.
- Requête directe sur `pgboss.job` (`SELECT id, name, state, data, created_on,
  completed_on FROM pgboss.job WHERE name = 'entity-linking' ...`) — vérifier
  si un job de liaison a réellement été consommé par un worker.

**Livrables produits :**
- **KAN-24 (backlinks)** : `relation-service.ts` (`listIncomingLinks`),
  `linked-entities.tsx` généralisé, section « Mentionné par » — PR mergée.
- **KAN-11 (clôture S3)** : `src/lib/storage/s3-adapter.test.ts` (nouveau),
  doc point d'extension OVH (`spec-technique-bloc2.md` §4.1) — PR mergée.
- **KAN-12 (déconnexion)** : `logoutAction` (`src/actions/auth.ts`), bouton
  header (`layout.tsx`), `auth.test.ts` (nouveau), `TST-AUT-008` — PR mergée,
  vérifiée manuellement par Aymeric dans un vrai navigateur.
- **KAN-34 (câblage CI e2e)** : job `e2e` dans `.github/workflows/ci.yml`
  (service `postgres:16`), `playwright.config.ts` (`trace: "retain-on-failure"`)
  — PR mergée, job vert confirmé sur GitHub.
- **KAN-22 (mentions manuelles @, 5/5 étapes)** :
  - Étape 1 : node `mention` (`tiptap-extensions.ts`), `tiptap-mention-attrs.ts`
    (nouveau, constantes partagées avec le surlignage), validation
    `assertSafeAttributes`.
  - Étape 2 : popup de suggestion (`mention-list.tsx` + test, `ReactRenderer`
    + `@tiptap/suggestion`), `filterMentionSuggestions` (pur, testé).
  - Étape 3 : `reconcileManualMentions` + `extractMentionedEntityIds`,
    câblage dans `saveEntityContentAction`.
  - Étape 4 : rendu + navigation — acquis par réutilisation, vérifié
    manuellement par Aymeric (Ctrl/Cmd+clic fonctionnel dès l'étape 2/3).
  - Étape 5 : `e2e/manual-mention.spec.ts` (nouveau, a trouvé le bug
    `allowSpaces`), `docs/adr/0011-mentions-manuelles-reconciliation.md`
    (nouveau), `TST-LNK-006`, mises à jour OWASP/RGAA/spec/CHANGELOG.
  - 4 commits, PR mergée.
- Gates en fin de session : lint ✅ (0 warning) · typecheck ✅ · tests ✅
  (217 tests unitaires) · couverture 98,33 % (seuil bloquant 80 %) · build ✅ ·
  e2e ✅ (3/3 réel : smoke, surlignage, mentions manuelles).

**Avancement certification :**
- **C2.2.1** : `reconcileManualMentions` reprend le même patron diff
  ajout/suppression que `scanAndLinkEntity` (KAN-19) sans dupliquer la logique ;
  constantes DOM partagées entre surlignage et mentions (`tiptap-mention-attrs.ts`).
- **C2.2.2** : 217 tests, couverture 98,33 % maintenue ; un vrai trou
  d'isolation de test trouvé et corrigé (mock manquant faisant taper la vraie
  base dev), documenté ci-dessus.
- **C2.2.3** : popup de mention entièrement clavier (`listbox`/`option`,
  `aria-activedescendant`, cf. `accessibilite-rgaa.md`) ; revalidation serveur
  des id mentionnés contre le monde réel avant écriture (OWASP A01, ligne
  étendue dans `securite-owasp.md`).
- **C2.3.1** : `TST-LNK-006` au cahier de recettes ; bug `allowSpaces` trouvé
  et corrigé par le test e2e avant toute mise en recette manuelle.
- **C2.4.1** : ADR-0011 (mentions manuelles : rendu, coexistence AUTO/MANUAL,
  réconciliation synchrone, `allowSpaces`).

**À faire / suite :**
- **Graphe Cytoscape (KAN-25)** : prochain chantier, plus gros morceau restant
  avant le 24/07 — toujours à zéro ligne de code.
- **Quotas freemium (KAN-18)**, **recherche basique (KAN-17)**, **upload
  d'images (KAN-16)**, **UI ignorer/délier une occurrence (KAN-23)** : non
  commencés.
- **CD vers le VPS OVH (KAN-10)** : pas commencé, VPS pas encore commandé.
- **Bug workers e2e orphelins** (`global-setup.ts`, `worker.kill()`
  n'atteint pas toute l'arborescence sous Windows) : identifié, contourné
  manuellement plusieurs fois, **pas corrigé** — à traiter si ça continue de
  gêner les runs e2e locaux.
- Reporter cette entrée (les deux blocs du jour) dans `dev-log.md` (hors dépôt)
  + redéposer dans le projet Claude.
- Mettre à jour le board Jira : KAN-24, KAN-11, KAN-12, KAN-34, KAN-22 → Done ;
  KAN-25 à passer en cours au démarrage du chantier graphe.

---

## Décisions techniques

| Date | Décision | Alternatives | Justification |
|---|---|---|---|
| 2026-07-17 | 4 branches/PR indépendantes pour vider la colonne WIP, plus petit au plus gros | Une seule grosse PR ; traiter un seul ticket | Libère un créneau WIP à chaque merge plutôt qu'attendre la fin des quatre |
| 2026-07-17 | Rendu de la mention sans préfixe `@` | Garder `@Label` (comportement par défaut de l'extension) | Cohérence visuelle avec le surlignage AUTO, demandé par Aymeric après test manuel |
| 2026-07-17 | `renderText: () => ""` sur le node mention | Laisser le comportement par défaut (`"@Label"`) | Évite l'auto-détection AUTO de sa propre mention manuelle via `plainText` |
| 2026-07-17 | Réconciliation `Relation MANUAL` synchrone à la sauvegarde | Enfiler un job asynchrone comme pour AUTO | Intention explicite, peu de mentions par fiche ; reste dans le budget perf en ligne |
| 2026-07-17 | Revalidation serveur des id mentionnés contre le monde avant écriture | Faire confiance aux id envoyés par le client | OWASP A01 : un id d'un autre monde ne doit jamais pouvoir créer un lien |

## Erreurs rencontrées & Solutions

| Date | Symptôme exact | Cause | Solution |
|---|---|---|---|
| 2026-07-17 | Popup de suggestion se ferme dès qu'un espace est tapé dans la requête | `allowSpaces` vaut `false` par défaut dans `@tiptap/suggestion` (regex exclut `\s`) | `allowSpaces: true` dans la config `suggestion` |
| 2026-07-17 | `entity-content.test.ts` passait sans jamais vérifier `reconcileManualMentions` | Mock manquant pour `@/services/relation-service` ; l'appel réel touchait la vraie base dev (Docker up), échec avalé par le `try/catch` non-fatal | Ajouter `vi.mock("@/services/relation-service", ...)` |
| 2026-07-17 | Run e2e bloqué ~7-8 min sans aucune sortie | Workers `tsx src/worker/index.ts` orphelins (kill incomplet sous Windows) tenant des connexions ouvertes, bloquant `DROP SCHEMA` du `global-setup.ts` suivant | Identifier via `wmic process ... get ProcessId,CommandLine` puis `taskkill //PID <pid> //F` |
| 2026-07-17 | `⨯ Another next dev server is already running` (port 3000) au lancement du `webServer` e2e (port 3100) | Verrou Next.js par **projet**, pas par port | Tuer le serveur dev existant avant de lancer l'e2e localement |
| 2026-07-17 | « Mentionné par » n'affichait pas une mention détectée via alias | Aucun worker ne tournait sur la base de dev — jobs `entity-linking` restés à l'état `created` dans `pgboss.job` | Démarrer le worker manuellement (`npx tsx --require dotenv/config src/worker/index.ts`) |

⚠️ Rien en attente de commit à la clôture de cette session : les 4 PR (KAN-24,
KAN-11, KAN-12, KAN-34) et la PR KAN-22 (mentions manuelles, 4 commits) sont
toutes confirmées committées, poussées et mergées par Aymeric.

---

### Session — 2026-07-17 — Graphe Cytoscape (KAN-25) + garde-fous ignorer/délier (KAN-23)

**Thèmes abordés :**
- Analyse du concurrent vvd.world déposée par Aymeric (2 fichiers : ADR externe
  proposant react-flow, entrée design `reference-vvd.md`) — périmètre limité au
  graphe pour cette session, le reste (couleurs/typo/architecture éditeur)
  différé à un futur ticket de reprise du front.
- Graphe de relations (KAN-25, dernier morceau obligatoire du périmètre S30) :
  décision de rendu, implémentation complète, e2e, docs.
- Point d'étape avec Aymeric sur la priorisation des tickets restants avant le
  24/07.
- Garde-fous « ignorer/délier une relation AUTO » (KAN-23, 2 étapes) : service,
  Server Actions, UI, e2e, docs — PR mergée.
- Diagnostic d'un faux blocage Playwright sous Windows (pipe stdout hérité par
  un worker orphelin).

**Décisions prises :**
- **Cytoscape.js dès le MVP, sans phase de migration prévue** (ADR-0012) —
  tranché par Aymeric via question à choix, contre la proposition externe
  react-flow (SVG/DOM pour le MVP puis migration canvas). Justification :
  Cytoscape rend déjà nativement sur un seul `<canvas>`, donc le problème de
  perf DOM que react-flow chercherait à contourner par une migration ultérieure
  ne se pose pas — l'audit vvd reste utile pour la **forme** (canvas + filtres
  + navigation cliquable), pas pour la conclusion technique.
- **`layout: { name: "cose", animate: false }`** plutôt qu'un `layout.stop()`
  synchronisé avec le cleanup React — supprime par construction la classe de
  bug (aucune frame différée possible après démontage), pas seulement un
  correctif ponctuel.
- **Priorisation post-KAN-25 : finir KAN-16/17/18/23 avant le VPS/CD (KAN-10)**
  — choisi par Aymeric parmi les options présentées, malgré le risque de
  planning déjà signalé (la fenêtre VPS est censée être en cours d'après la
  spec) ; risque explicitement gardé en tête pour resurgir plus tard, pas
  silencieusement abandonné.
- **KAN-23 retenu comme premier chantier** (le plus petit des 4 tickets
  restants, 4 SP) — choisi par Aymeric.
- **Une seule mécanique « Ignorer ce lien » pour les deux formulations du
  ticket** (« ignorer une occurrence », « délier une relation AUTO ») — déduit
  du schéma `LinkIgnore` (`@@unique([entityId, targetId])`, ignore par **paire
  source→cible**, pas par occurrence précise dans le texte), pas une
  clarification demandée à Aymeric : les deux formulations se résument à la
  même écriture.
- **`getEntity` (pas seulement `getWorld`) pour les nouvelles fonctions**
  (`ignoreLink`, `unignoreLink`, `listIgnoredTargets`) — ferme un gap
  d'autorisation identifié dans des fonctions voisines pré-existantes
  (`listOutgoingLinks`, `listIncomingLinks`, `getIgnoredTargetIds`,
  `reconcileManualMentions`, `listWorldRelations` ne vérifient que
  l'appartenance du monde au propriétaire, jamais que `entityId` appartient à
  `worldId`) sans corriger rétroactivement ce code voisin — hors périmètre
  chirurgical du ticket, signalé à Aymeric plutôt que corrigé silencieusement.

**Éléments notables / appris (gotchas) :**
- **Cytoscape + jsdom : `Could not create canvas of type 2d`** — jsdom n'a pas
  de contexte canvas 2D natif sans le paquet `canvas`. Confirmé que
  `GraphView` ne peut pas être monté en test unitaire RTL ; accepté comme
  limite inhérente (même précédent que le wiring `ReactRenderer`/`renderHTML`
  de Tiptap), vérification déférée à l'e2e.
- **Race condition du layout `cose` de Cytoscape** : anime par défaut sur
  plusieurs `requestAnimationFrame` ; si le composant démonte pendant
  l'animation (navigation), une frame différée s'exécute après `cy.destroy()`
  et plante (`Cannot read properties of null (reading 'notify')`), reproduit
  par `e2e/graph.spec.ts`. Voir décision `animate: false` ci-dessus.
- **Faux blocage Playwright, variante inédite du piège des workers orphelins
  déjà documenté (`windows-orphan-node-e2e-cleanup`)** : un run de
  `e2e/link-ignore.spec.ts` piped vers `tail -150` est resté silencieux ~15 min
  alors que le test avait réussi en 26,6 s (`1 passed`, retrouvé dans le
  fichier de sortie une fois débloqué). Cause : `global-setup.ts` spawn le
  worker avec `stdio: "inherit"` — le vrai process `node.exe` du worker hérite
  du bout écriture du pipe vers `tail` ; `worker.kill()` ne tue que le wrapper
  shell sous Windows (piège déjà connu), le vrai process survit et garde le
  pipe ouvert **indéfiniment**, même longtemps après la fin réelle du test.
  Diagnostiqué par l'état observable plutôt que par déduction : `wmic process
  ...` puis confirmation de l'âge du process worker via `Get-CimInstance
  Win32_Process -Filter "ProcessId=<pid>" | Select CreationDate` (le worker
  datait bien du run en cours, pas un résidu antérieur). Résolu par
  `taskkill //PID <pid> //F //T` sur toute l'arborescence. Confirmé sur un run
  complet (5 specs) sans pipe cette fois : l'orphelin réapparaît
  systématiquement, le pipe n'étant qu'un facteur aggravant, pas la cause
  racine. Skill `windows-orphan-node-e2e-cleanup` mis à jour avec ce cas.

**Commandes utiles de la session :**
- `Get-CimInstance Win32_Process -Filter "ProcessId=<pid>" | Select
  ProcessId,ParentProcessId,CreationDate,CommandLine` — confirme qu'un process
  suspect date bien du run en cours avant de le tuer.
- PowerShell, fonction récursive `Get-Descendants($ppid)` sur
  `Get-CimInstance Win32_Process -Filter "ParentProcessId=$ppid"` — parcourt
  l'arborescence de process quand `wmic` seul ne suffit pas à relier
  parent/enfant.
- `taskkill //PID <pid> //F //T` — tue tout un sous-arbre de process orphelins
  (`//T` en plus du `//F` habituel).
- Lancer `npx playwright test` en tâche de fond **sans** `| tail -N` quand
  possible : évite le piège du pipe qui reste ouvert indéfiniment à cause d'un
  orphelin.

**Livrables produits :**
- **KAN-25 (graphe)** : `src/lib/graph-elements.ts` (`buildGraphElements`,
  `buildAccessibleGraphEntries`, fonctions pures testées isolément),
  `listWorldRelations` (`relation-service.ts`), `graph-view.tsx` (rendu
  Cytoscape, filtrage par type sans recréer l'instance, `GraphAccessibleList`),
  `data-testid="graph-canvas"`, `e2e/graph.spec.ts` (nouveau), ADR-0012 (+
  index ADR), `TST-GRF-001` à `003`, entrée RGAA dédiée, spec technique §2
  point 7 marqué **Fait**, CHANGELOG — PR mergée.
- **KAN-23 (garde-fous ignorer/délier), 2 étapes** :
  - Étape 1 : `relation-service.ts` (`ignoreLink`, `unignoreLink`,
    `listIgnoredTargets`, type `IgnoredTarget`), `src/actions/link-ignore.ts`
    (nouveau), 15 tests `relation-service.test.ts` + 8 tests
    `link-ignore.test.ts`.
  - Étape 2 : `linked-entities.tsx` (bouton « Ignorer ce lien » par entrée
    `origin=AUTO`, côté sortant uniquement), `ignored-links.tsx` (nouveau,
    section « Liens ignorés » + « Ne plus ignorer »), `page.tsx` (câblage),
    `e2e/link-ignore.spec.ts` (nouveau), `TST-LNK-007`, `securite-owasp.md`
    (A01 étendu, gap pré-existant signalé), spec technique §2 point 5 marqué
    **Fait**, CHANGELOG.
  - PR mergée (confirmée par Aymeric).
- `.claude/skills/windows-orphan-node-e2e-cleanup/SKILL.md` mis à jour.
- Gates en fin de session : lint ✅ (0 warning) · typecheck ✅ · tests ✅
  (249 tests unitaires) · couverture 98,52 % (seuil bloquant 80 %) · build ✅ ·
  e2e ✅ (5/5 réel : smoke, graph, manual-mention, link-highlight, link-ignore).

**Avancement certification :**
- **C2.2.1** : le graphe réutilise le patron déjà établi (fonction pure de
  mapping testée isolément + wiring framework mince dans un `useEffect`) ;
  `relation-service.ts` reste la seule couche métier touchée par KAN-23,
  aucune nouvelle dépendance d'architecture.
- **C2.2.2** : +32 tests cette session (15 + 8 pour KAN-23, plus les tests
  purs de `graph-elements.ts` pour KAN-25) ; couverture maintenue à 98,52 %
  (seuil 80 % largement respecté) ; limite de test documentée pour Cytoscape/
  jsdom (déférée à l'e2e, pas un trou de couverture silencieux).
- **C2.2.3** : RGAA — `GraphAccessibleList` (chemin clavier séparé du canvas,
  ADR-0012) et boutons natifs « Ignorer ce lien »/« Ne plus ignorer » (focus
  visible, `role="alert"` sur les erreurs) ; OWASP A01 — `targetId` revalidé
  contre le monde réel avant écriture (`ignoreLink`), gap pré-existant dans du
  code voisin signalé sans être corrigé hors périmètre.
- **C2.3.1** : `TST-GRF-001` à `003`, `TST-LNK-007` au cahier de recettes.
- **C2.4.1** : ADR-0012 (alternatives explicitées, décision justifiée,
  conséquences RGAA documentées).

**À faire / suite :**
- Prochaine étape (déjà priorisée par Aymeric) : KAN-16 (upload d'images),
  KAN-17 (recherche basique), KAN-18 (quotas freemium) — ordre entre les trois
  restant à confirmer.
- Gap d'autorisation pré-existant (`entityId` non revérifié contre `worldId`
  dans `listOutgoingLinks`/`listIncomingLinks`/`getIgnoredTargetIds`/
  `reconcileManualMentions`/`listWorldRelations`) : mitigé en pratique par les
  appels UI existants, à corriger si un appel direct de Server Action devient
  un vecteur d'attaque plausible.
- `global-setup.ts` ne tue toujours pas toute l'arborescence du worker en fin
  de run e2e sous Windows — nettoyage manuel systématique en attendant,
  chantier de fond toujours pas traité.
- **KAN-10 (CD/VPS)** : toujours différé par choix d'Aymeric, risque de
  planning à garder en tête.
- Reporter cette entrée (le troisième bloc du jour) dans `dev-log.md` (hors
  dépôt) + redéposer dans le projet Claude.
- Mettre à jour le board Jira : KAN-25 et KAN-23 → Done.

---

## Décisions techniques (session graphe + garde-fous)

| Date | Décision | Alternatives | Justification |
|---|---|---|---|
| 2026-07-17 | Cytoscape.js dès le MVP, sans phase de migration (ADR-0012) | react-flow (SVG/DOM) pour le MVP puis migration canvas, proposé par un audit externe | Cytoscape rend déjà nativement sur `<canvas>` : le problème de perf DOM que react-flow contournerait par migration ne se pose pas |
| 2026-07-17 | `layout: { name: "cose", animate: false }` | `layout.stop()` synchronisé avec le cleanup de l'effet React | Supprime la classe de bug par construction (aucune frame différée possible) plutôt qu'une synchronisation fragile |
| 2026-07-17 | Priorisation KAN-16/17/18/23 avant KAN-10 (VPS/CD) | Traiter le VPS/CD en premier malgré le risque de planning déjà signalé | Choisi par Aymeric ; risque gardé en tête, pas abandonné |
| 2026-07-17 | Une seule mécanique « Ignorer ce lien » pour ignorer/délier | Deux mécanismes distincts (un par occurrence texte, un par relation) | `LinkIgnore` ignore par paire source→cible, pas par occurrence précise — déduit du schéma existant |
| 2026-07-17 | `getEntity` (pas seulement `getWorld`) dans les nouvelles fonctions de `relation-service.ts` | Réutiliser `getWorld` seul, comme le code voisin pré-existant | Ferme un gap d'autorisation (`entityId` non revérifié contre `worldId`) pour le code neuf, sans élargir le correctif au code voisin (hors périmètre) |

## Erreurs rencontrées & Solutions (session graphe + garde-fous)

| Date | Symptôme exact | Cause | Solution |
|---|---|---|---|
| 2026-07-17 | `Could not create canvas of type 2d` en tentant un montage RTL de `GraphView` | jsdom n'a pas de contexte canvas 2D natif sans le paquet `canvas` | Limite acceptée, vérification déférée à `e2e/graph.spec.ts` |
| 2026-07-17 | `Cannot read properties of null (reading 'notify')` après démontage pendant l'animation du layout `cose` | Frame `requestAnimationFrame` différée exécutée après `cy.destroy()` | `layout: { animate: false }` |
| 2026-07-17 | `npx playwright test e2e/link-ignore.spec.ts \| tail -150` : 0 octet de sortie pendant ~15 min alors que le test avait réussi (`1 passed (26.6s)`) | Worker spawné par `global-setup.ts` avec `stdio: "inherit"` hérite du pipe vers `tail` ; `worker.kill()` ne tue que le wrapper shell sous Windows, le vrai process survit et garde le pipe ouvert indéfiniment | `taskkill //PID <pid> //F //T` sur l'arborescence orpheline (confirmée via l'âge du process) |

⚠️ Rien en attente de commit à la clôture de cette session : KAN-25 et KAN-23
(les deux étapes) sont confirmés committés, poussés et mergés par Aymeric.

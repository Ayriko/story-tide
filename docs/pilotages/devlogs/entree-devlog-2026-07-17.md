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

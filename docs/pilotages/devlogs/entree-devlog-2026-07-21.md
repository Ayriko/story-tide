### Session — 2026-07-21 — KAN-36 P4/P6 + bugfix P1 (BUG-002) + KAN-39 (5 volets éditeur)

**Thèmes abordés :**
- P4 (KAN-36) : header dense (`cardHeader`) de la page d'entrée — titre Fraunces,
  badge de type MINT, chips d'alias, engrenage repositionné en coin haut-droit ;
  slot de couverture décoratif ajouté puis retiré (retour Aymeric : « pas terrible
  sans vraie image possible »).
- P6 (KAN-36) : retrofit lexique dans `docs/cahier-recettes.md` (« fiche » →
  « entrée », « Graphe » → « Constellation », annotation bilingue à la première
  occurrence de chaque scénario).
- Bugfix P1 / BUG-002 : perte de sauvegarde silencieuse quand un texte externe
  (Obsidian) est collé dans l'éditeur d'entité.
- KAN-39 volets 2 à 5, sur le même éditeur : normalisation des `<br>` au collage,
  toolbar sticky, migration des popovers Lien/Image vers `Dialog` shadcn,
  redimensionnement des images par poignée de drag.
- Wording : « Texte alternatif » → « Légende » (libellé UI, reste l'attribut
  `alt` techniquement).

**Décisions prises :**
- SafeLink assainit le lien **dès le parsing** (frappe/collage) plutôt que de
  laisser la validation serveur rejeter tout le document pour un seul attribut
  fautif — diagnostic initial d'Aymeric, confirmé dans le code puis corrigé sur
  deux points avant d'implémenter : (1) le snippet fourni configurait `SafeLink`
  une seule fois au niveau module — aurait reproduit exactement le bug
  StrictMode déjà documenté dans `tiptap-extensions.ts` (« link » n'y survivait
  pas) ; corrigé en gardant `.configure()` dans `createEditorExtensions()`. (2)
  Le `parseHTML` natif de `@tiptap/extension-link@3.27.4` délègue déjà à
  `isAllowedUri` (vérifié dans `node_modules`) — l'override `parseHTML` n'était
  donc pas strictement nécessaire sur cette version, gardé quand même en
  défense en profondeur sur demande explicite d'Aymeric.
- `isSafeHttpUrl` extraite dans un nouveau module `src/lib/url-safety.ts`
  (source unique de vérité serveur+client) plutôt que dupliquée — évite un
  cycle d'import (`tiptap-content.ts` importe déjà `tiptap-extensions.ts`).
- `transformPastedHTML` (DOMParser, jamais de regex sur du HTML) pour scinder
  les `<br>` en paragraphes distincts au collage — approche fournie par
  Aymeric, implémentée telle quelle.
- Toolbar sticky : `Card` (composant générique) porte un `overflow-hidden` qui
  neutralisait `position:sticky` — override `overflow-visible` ciblé sur le
  seul usage de `world-shell.tsx`, pas sur le composant générique (les autres
  cartes de l'app gardent leur clipping).
- Toolbar : fond retiré puis reposé en version discrète après deux itérations
  de retour visuel d'Aymeric (« on voit plus rien » → `bg-card/85` + flou léger
  + arrondi + largeur ajustée au contenu, plutôt qu'un fond plein ou une
  barre pleine largeur).
- Dialog Image : bouton « Choisir un fichier » détaché du statut « Aucun
  fichier choisi » via un input natif caché (`sr-only`) + ref déclenchée par un
  vrai `Button`, plutôt que deux `<label>` sur le même champ (ambigu pour un
  lecteur d'écran) — retour Aymeric sur la disposition.
- Redimensionnement d'image : **NodeView React maison**, pas la lib native.
  Découverte en cours de route que `@tiptap/core@3.27.4` embarque un
  `ResizableNodeView` prêt à l'emploi — recommandé de ne pas l'utiliser malgré
  tout : il travaille en pixels (pas en pourcentage, l'exigence explicite), et
  n'a **aucun** équivalent clavier autonome (seul un modificateur Maj pendant un
  drag déjà en cours) — la partie la plus délicate (RGAA) restait à écrire dans
  tous les cas, l'utiliser n'aurait rien simplifié. Validé par Aymeric via le
  plan avant implémentation.
- Layering : l'attribut `width` du schéma (partagé serveur/client, pure donnée)
  reste dans `tiptap-extensions.ts` ; le NodeViewRenderer React lui-même est
  fourni uniquement par le client via un paramètre optionnel de
  `createEditorExtensions()` — évite de tirer `@tiptap/react`/JSX dans le
  bundle serveur (`tiptap-content.ts`, appelé depuis des Server Actions).

**Éléments notables / appris (gotchas) :**
- `@tiptap/extension-link` n'était que transitif (via `starter-kit`) — doit
  passer en dépendance directe pour pouvoir faire `Link.extend()` soi-même.
- `StarterKit` importe et pousse **sa propre instance** de `Link` dès que
  `link !== false` (vérifié dans
  `node_modules/@tiptap/starter-kit/dist/index.js`) — sans `link: false`
  explicite, deux marks `"link"` concurrentes se seraient enregistrées, la
  première (celle de StarterKit) l'emportant au parsing et rendant SafeLink
  sans effet.
- Éditer des fichiers source **pendant** qu'un run e2e tourne en arrière-plan
  contre le même dev server casse des requêtes SSR en HMR — rencontré une fois
  entre deux volets (`⨯ Error: Module [project]/.../world-shell.tsx [app-ssr]
  ... was instantiated ... but the module factory is not available`), sans
  conséquence sur le résultat final (9/9 quand même) mais fragile. **Candidat
  skill** : ne jamais éditer de code pendant qu'un run e2e est en cours contre
  le même serveur ; attendre la fin complète avant tout édit suivant.
- Process `next dev` parasite (encore une fois, PID différent — cf. dev-log
  précédent) a bloqué un lancement e2e avec `⨯ Another next dev server is
  already running` — verrou **par projet**, pas par port (3000 occupé a
  bloqué le run visant le port 3100). Confirmé via
  `wmic process where "ProcessId=<pid>" get ProcessId,CommandLine` puis tué
  après feu vert explicite d'Aymeric.
- `npm install @tiptap/extension-link@^3.27.4` a échoué
  (`Conflicting peer dependency: @tiptap/core@3.28.0`) — le caret range
  résolvait vers la dernière version disponible (3.28.0) plutôt que celle
  déjà installée (3.27.4), créant un conflit de peer dependency avec le reste
  de l'écosystème Tiptap pinné. Corrigé avec `--save-exact` sur la version
  exacte déjà utilisée partout ailleurs.
- `NodeViewWrapper` (`@tiptap/react`) forwarde bien un `ref` malgré un typage
  `.d.ts` qui le déclare comme simple `FC` — vérifié dans le JS compilé
  (`React.forwardRef((props, ref) => ...)`).
- `useReactNodeView()` a une valeur de contexte par défaut sûre (pas de
  `Provider` requis pour l'utiliser) — permet de tester le NodeView React en
  isolation avec Testing Library, sans monter un vrai `Editor`.
- `Node.fromJSON` (ProseMirror) applique les défauts du schéma pour tout
  attribut absent — confirmé par test réel (26 tests existants passaient déjà
  sans modification après l'ajout de la validation `width`) : la rétrocompatibilité
  « images sans `width` = 100 » ne demandait aucun code de migration.

**Commandes utiles de la session :**
- `wmic process where "ProcessId=<pid>" get ProcessId,CommandLine` — identifier
  un process avant de le tuer (confirmation Aymeric systématique avant tout
  `taskkill`).
- `npm install <paquet>@<version> --save-exact` — pinner une dépendance Tiptap
  à la version exacte déjà utilisée ailleurs, évite un conflit de peer
  dependency quand un caret range résoudrait vers plus récent.

**Livrables produits :**
- 7 commits sur `feat/kan-36-passe-visuelle` : `b5224f8` (P4/P6 KAN-36),
  `ddb48c1` (SafeLink), `6ea6443` (`<br>`), `7252eff` (toolbar sticky),
  `5db1b28` (Dialog + Légende), `55ca848` (redimensionnement image), `52ba3b2`
  (documentation transverse).
- Nouveaux fichiers : `src/lib/url-safety.ts`, `src/lib/tiptap-paste.ts`,
  `resizable-image-view.tsx` + `.test.tsx`.
- Docs mises à jour : `cahier-recettes.md` (`TST-ENT-011`, `TST-ENT-012`,
  `TST-SEC-014` + retrofit lexique P6), `plan-correction-bogues.md`
  (`BUG-002`), `securite-owasp.md` (A03), `accessibilite-rgaa.md` (Dialog,
  toolbar sticky, slider clavier), `CHANGELOG.md`.
- Gates finaux : lint ✅ (0 warning) · `tsc` ✅ · 335/335 tests unitaires ✅ ·
  couverture 98,25 % (seuil CI 80 %, jamais baissé) · build ✅ · e2e 9/9 ✅.

**Avancement certification :**
- C2.2.2 (tests) : 335/335 verts, couverture largement au-dessus du seuil sur
  `src/lib` + `src/services`.
- C2.2.3 (sécurité + accessibilité) : `securite-owasp.md` (A03 — assainissement
  à l'entrée + `image.width` borné côté serveur) et `accessibilite-rgaa.md`
  (focus trap/Échap gratuits via Dialog, patron ARIA slider pour le
  redimensionnement clavier) tenus à jour à chaque mesure codée.
- C2.3.1 (recette) : 3 nouveaux scénarios au cahier de recettes
  (`TST-ENT-011`, `TST-ENT-012`, `TST-SEC-014`), `BUG-002` tracé dans
  `plan-correction-bogues.md` avec correctif + tests de non-régression.

**À faire / suite :**
- Vérification manuelle Aymeric : tous les volets confirmés OK en cours de
  session (SafeLink, `<br>`, dialogs, redimensionnement d'image).
- Dette déjà connue, non traitée cette session : `docs/accessibilite-rgaa.md`
  référence encore l'ancien nom « Graphe (liste accessible) » (renommé en UI
  lors du lexique KAN-36, pas répercuté dans ce doc).
- P5 (Constellation plein écran) et P5b (palette Ctrl+K, panneau raccourcis)
  du plan KAN-36 original restent non commencés.
- Reporter cette entrée dans `dev-log.md` (hors repo) + redéposer dans le
  projet Claude.
- Mettre à jour le board Jira (KAN-36 P4/P6, KAN-39 volets 1-5, BUG-002 → bonnes
  colonnes).

---

**Décisions techniques**

| Date | Décision | Alternatives | Justification |
|---|---|---|---|
| 2026-07-21 | SafeLink garde l'override `parseHTML` en plus de `isAllowedUri` | Configurer `isAllowedUri` seul (suffisant sur cette version précise, vérifié) | Défense en profondeur demandée explicitement par Aymeric, indépendante d'une régression de version Tiptap future |
| 2026-07-21 | Redimensionnement d'image : NodeView React maison, largeur en pourcentage | `ResizableNodeView` natif de `@tiptap/core` (pixels) | Aucune conversion d'unité à gérer ; le natif n'a de toute façon pas d'équivalent clavier — l'a11y devait être écrite dans les deux cas |
| 2026-07-21 | Attribut `width` du schéma séparé du `NodeViewRenderer` (paramètre optionnel de `createEditorExtensions`) | Tout définir dans un seul module, y compris le NodeView React | Évite de tirer `@tiptap/react`/JSX dans le bundle serveur (`tiptap-content.ts`, Server Actions) |

**Erreurs rencontrées & Solutions**

| Date | Symptôme (message exact) | Cause | Solution |
|---|---|---|---|
| 2026-07-21 | `⨯ Error: Module [project]/.../world-shell.tsx [app-ssr] ... was instantiated ... but the module factory is not available` | Édition de fichiers source pendant qu'un run e2e tournait en arrière-plan contre le même dev server (HMR casse une requête SSR en vol) | Attendre la fin complète d'un run e2e avant toute édition suivante |
| 2026-07-21 | `⨯ Another next dev server is already running` | Process `next dev` parasite tenant le verrou par projet (pas par port) | `wmic` pour confirmer le PID, `taskkill` après feu vert explicite d'Aymeric |
| 2026-07-21 | `npm error Conflicting peer dependency: @tiptap/core@3.28.0` | `npm install @tiptap/extension-link@^3.27.4` résolvait vers la dernière version (3.28.0) au lieu de celle déjà installée | Installer en version exacte (`--save-exact`) alignée sur le reste de l'écosystème Tiptap pinné |

**Non committé à la fin de cette session :** `docs/pilotages/devlogs/entree-devlog-2026-07-20.md`
(entrée de la session précédente, déjà rédigée) reste modifié sans commit — à inclure dans
le prochain commit documentation d'Aymeric.

---

### Session — 2026-07-21 — KAN-36 P5 (Constellation plein écran, filtres chips, dédoublonnage)

**Thèmes abordés :**
- Phase 0 : point d'état + gates complets avant de démarrer P5.
- Diagnostic d'un run e2e bloqué ~27-30 min sans sortie ni erreur.
- Changement de convention : `build` toujours en dernier dans l'ordre des gates.
- P5a : vue `/graph` plein cadre (fini le canvas fixe 600 px), bouton retour visible.
- P5b : filtres par type — checkboxes → chips à état (`aria-pressed`) groupées par
  famille avec bascule Tout/Rien, panneau flottant repliable **fermé par défaut**.
- P5c : stylesheet Cytoscape aux tokens (police Inter réelle, halo de libellé,
  survol MINT), fond de canvas assombri + grille discrète légèrement floutée,
  zoom initial réduit (padding de layout augmenté).
- P5d : dette doc soldée (`accessibilite-rgaa.md` référençait encore l'ancien nom
  « Graphe (liste accessible) »).
- Retours Aymeric en cours de route : liste accessible masquée derrière un
  disclosure « Observer les fils » ; dédoublonnage des paires d'entités qui se
  mentionnent mutuellement dans `buildAccessibleGraphEntries` ; régression
  d'affichage du canvas trouvée et corrigée ; positions de nœuds instables
  entre rechargements (BUG-003).
- Hors P5 : `npm run worker` cassé en local (variables d'env), corrigé.

**Décisions prises :**
- **Gates : `build` toujours en dernier** (lint → tsc → unit → e2e → build) —
  `next build` invalide le cache `.next/dev` que réutilise le `next dev` du
  webServer Playwright ; très probable cause d'un run e2e resté bloqué ~30 min
  sans erreur. Décision Aymeric, appliquée pour le reste de la session et notée
  en mémoire long terme.
- **Sortie e2e toujours redirigée vers un fichier, jamais de pipe** (`> log.txt
  2>&1`, jamais `| tail`) — un pipe non suivi bufférise tout et ne montre rien
  tant que le process ne s'est pas terminé, ce qui avait masqué la progression
  réelle du run bloqué. Décision Aymeric.
- Filtres par type : panneau **fermé par défaut** (retour Aymeric après un
  premier essai ouvert par défaut) + éléments rétrécis (chips, boutons
  Tout/Rien, en-tête) pour ne pas encombrer la vue.
- Fond du canvas Cytoscape : assombri (`#0d1d29`, distinct de `--background`) +
  grille légèrement floutée via un **`::before` CSS** (`globals.css`), pas un
  calque `<div>` frère positionné en absolu (essayé d'abord, a cassé
  l'affichage complet du graphe — cf. gotcha) — le `::before` est toujours
  peint avant les enfants réels de l'élément, donc le `<canvas>` que Cytoscape
  y insère peint naturellement par-dessus, sans z-index à gérer.
- Liste accessible masquée derrière un disclosure **« Observer les fils »**
  (registre « tissage » du lexique produit) plutôt que retirée — reste
  entièrement présente dans le DOM une fois ouverte (RGAA préservé, même
  patron que le disclosure des filtres). Le `<h2>« Liste accessible »` interne
  a ensuite été retiré (redondant avec le libellé du bouton). Retour Aymeric.
- `buildAccessibleGraphEntries` dédoublonne désormais (1) une paire d'entités
  qui se mentionnent mutuellement (A->B **et** B->A) en une seule ligne
  (lien « ↔ »), rangée sous l'entité dont le nom trie en premier
  (déterministe, départagé par id si noms identiques), et (2) une même cible
  reliée par AUTO et MANUEL dans le même sens. Retour explicite Aymeric
  (« surtout ne pas faire de doublon »).
- `listWorldRelations` (BUG-003) : ajout d'un `orderBy` stable
  (`[{createdAt:"asc"},{id:"asc"}]`). Bug réel (Postgres ne garantit aucun
  ordre sans lui, le layout `cose` en dépend), mais modifie un fichier
  service — hors périmètre explicitement déclaré du volet P5 (« aucune modif
  services »). Confirmation explicite demandée à Aymeric avant de l'appliquer
  (accordée), plutôt que de l'interpréter comme implicitement couvert.
- `npm run worker` : `node --env-file=.env --import tsx ...` (flag natif
  Node 24) plutôt qu'ajouter `dotenv` en dépendance directe du worker —
  `dotenv` est une devDependency, l'image Docker du worker (`npm ci
  --omit=dev`) ne l'installerait pas ; le flag ne touche que le script npm
  local, jamais le `CMD` Docker (vraies variables via compose en prod).
- Panneau dashboard vs page `/graph` : positions de nœuds resteront **toujours**
  différentes entre les deux (tailles de canvas différentes → simulation
  `cose` différente) même après le correctif BUG-003 — chantier séparé
  (persister une disposition canonique), noté au backlog KAN-33 sur décision
  d'Aymeric, pas traité cette session.

**Éléments notables / appris (gotchas) :**
- `next build` lancé juste avant un run e2e a invalidé le cache `.next/dev`
  qu'utilisait le `next dev` du webServer Playwright — le process `next dev`
  a disparu silencieusement (aucune erreur dans son propre log), le run est
  resté actif ~27-30 min sans plus aucune sortie. Diagnostiqué en comparant
  taille/mtime de `.next/dev/trace` et `.next/dev/logs/next-development.log`
  (figés depuis ~27 min) avec l'heure courante — pas via l'output du run
  lui-même (masqué par le pipe `| tail`, cf. gotcha suivant). **Candidat
  skill** : toujours placer `build` en dernier dans l'ordre des gates sur ce
  projet.
- `2>&1 | tail -100` sur un run lancé en arrière-plan ne montre **rien** tant
  que le process n'a pas terminé (`tail` sans `-f` bufférise tout en lisant
  depuis un pipe) — a directement contribué au diagnostic tardif du run
  bloqué ci-dessus. Solution : toujours rediriger vers un fichier réel
  (`> fichier.log 2>&1`) pour un run qu'on veut pouvoir inspecter en cours de
  route, jamais de pipe.
- Deux `<div>` frères en `position:absolute` (fond flouté + conteneur de
  montage Cytoscape), pensés pour appliquer un `filter:blur` au fond sans
  flouter le canvas rendu, ont cassé l'affichage complet du graphe (« on ne
  voit plus rien sur le graph ») — corrélation temporelle forte avec le
  changement, cause exacte non vérifiable empiriquement côté Claude (pas
  d'accès navigateur). Corrigé en repli sur un seul conteneur + un `::before`
  CSS. **Candidat skill** : préférer un pseudo-élément (`::before`/`::after`)
  à des calques frères positionnés en absolu pour un fond décoratif derrière
  un contenu géré par une lib tierce qui insère elle-même ses propres
  éléments DOM (Cytoscape, mais le patron est générique).
- `getByRole("button", { name: "Lieu" })` résolvait **deux** éléments (strict
  mode violation Playwright) : le nom "Lieu" matche par défaut en sous-chaîne
  le bouton de repli "Lieux" de la sidebar (nom accessible englobant).
  `exact: true` nécessaire sur les deux locators du e2e concernés.
- Orphelins worker récurrents : même après un run e2e **réussi** (exit 0), le
  `worker.kill()` du `globalSetup` ne tue pas toute l'arborescence npx/tsx
  imbriquée — nettoyage manuel systématique (`taskkill //PID <pid> //T //F`
  sur le PID racine) nécessaire avant chaque nouveau run, sinon accumulation
  de process consommant la file `entity-linking` en double.
- `npm run worker` échouait avec `Variables d'environnement invalides` sur
  **toutes** les variables (`DATABASE_URL`, `BETTER_AUTH_SECRET`, etc.) :
  `next dev` charge `.env` automatiquement (comportement natif Next.js), un
  script `tsx` nu ne charge rien du tout. Aucune trace de ce prérequis dans le
  README avant cette session.

**Commandes utiles de la session :**
- `node --env-file=.env -e "..."` — vérifier qu'un `.env` se charge
  correctement avant de l'intégrer dans un script npm.
- `stat -c '%s %Y' <fichier>` — comparer taille/mtime d'un fichier de
  log/trace pour distinguer un process réellement bloqué d'un process juste
  lent (utilisé sur `.next/dev/trace` pendant le diagnostic du run e2e figé).
- `docker compose -f docker-compose.dev.yml up -d postgres minio` —
  redémarrer uniquement les deux services nécessaires au e2e sans toucher au
  reste de la stack.

**Livrables produits :**
- 4 commits sur `feat/kan-36-passe-visuelle`, poussés puis **PR mergée**
  (confirmé par Aymeric) : `6bb1c54` (feat P5 complet), `f95c0a2` (fix BUG-003
  `orderBy`), `553e877` (fix `npm run worker` env), `8d70bac` (docs).
- Nouveau fichier : `graph-accessible-disclosure.tsx`.
- Fichiers modifiés : `graph-view.tsx`, `graph-accessible-list.tsx`,
  `graph-elements.ts` (+ test), `relation-service.ts` (+ test),
  `graph/page.tsx`, `worlds/[slug]/page.tsx`, `globals.css`,
  `e2e/graph.spec.ts`, `package.json`, `README.md`.
- Docs mises à jour : `CHANGELOG.md`, `accessibilite-rgaa.md`,
  `cahier-recettes.md` (`TST-GRF-002`/`003`/`004` réécrits),
  `plan-correction-bogues.md` (`BUG-003`).
- Gates finaux : lint ✅ (0 warning) · `tsc` ✅ · 338/338 tests unitaires ✅
  (+3 vs session précédente) · couverture 98,28 % (seuil CI 80 %, jamais
  baissé ; `graph-elements.ts` à 100 % lignes/fonctions) · build ✅ · e2e 9/9
  ✅ (52 s).

**Avancement certification :**
- C2.2.2 (tests) : 338/338 verts, `graph-elements.ts` (dédoublonnage) à 100 %
  lignes/fonctions après ajout des cas de test mutuel/multi-origine.
- C2.2.3 (sécurité + accessibilité) : `accessibilite-rgaa.md` mis à jour
  (chips à état, disclosure « Observer les fils », focus MINT) ; dette « Graphe
  (liste accessible) » soldée (grep final propre sur `docs/`, seules les
  mentions historiques légitimes — titres d'ADR, devlogs datés — subsistent).
- C2.3.1 (recette) : `TST-GRF-002`/`003`/`004` réécrits au cahier de recettes,
  `BUG-003` tracé dans `plan-correction-bogues.md` avec correctif + test de
  non-régression.
- Clôt KAN-36 P5 (dernier point obligatoire du plan initial, hors P5b bonus).

**À faire / suite :**
- P5b (palette `Ctrl+K`, panneau raccourcis clavier) reste non commencé —
  bonus explicitement conditionné à un go séparé d'Aymeric, jamais engagé.
- Panel dashboard vs `/graph` : positions toujours divergentes entre les deux
  vues (tailles de canvas différentes) — chantier séparé noté au backlog
  KAN-33 (persister une disposition canonique), pas de ticket dédié encore
  créé.
- `docs/pilotages/devlogs/entree-devlog-2026-07-20.md` toujours non committé
  (pré-existant, hors périmètre de cette session comme de la précédente).
- Reporter cette entrée dans `dev-log.md` (hors repo) + redéposer dans le
  projet Claude.
- Mettre à jour le board Jira (KAN-36 P5 → Terminé/Mergé, BUG-003 tracé,
  colonne de `npm run worker`/README à préciser si suivi séparément).

---

**Décisions techniques**

| Date | Décision | Alternatives | Justification |
|---|---|---|---|
| 2026-07-21 | Gates : `build` toujours en dernier | Ordre précédent (build avant e2e) | `next build` invalide le cache `.next/dev` que réutilise le `next dev` du webServer Playwright — cause très probable d'un run e2e resté bloqué ~30 min |
| 2026-07-21 | Fond de canvas Cytoscape via `::before` CSS (`globals.css`) | Deux `<div>` frères en `position:absolute` (essayé d'abord) | Le calque frère a cassé l'affichage du canvas ; `::before` peint toujours avant les enfants réels du DOM, le `<canvas>` de Cytoscape peint naturellement par-dessus sans z-index à gérer |
| 2026-07-21 | `npm run worker` : `node --env-file=.env --import tsx ...` | Ajouter `dotenv` en dépendance directe + `import "dotenv/config"` | `dotenv` est une devDependency, l'image Docker du worker (`npm ci --omit=dev`) ne l'installerait pas — flag natif Node 24, zéro dépendance, ne touche que le script local |
| 2026-07-21 | `buildAccessibleGraphEntries` range une paire mutuelle sous l'entité dont le nom trie en premier (départage par id si égalité) | Dupliquer l'entrée sous les deux entités (comportement antérieur) | Évite le doublon signalé par Aymeric tout en restant déterministe indépendamment de l'ordre des relations en base |

**Erreurs rencontrées & Solutions**

| Date | Symptôme (message exact) | Cause | Solution |
|---|---|---|---|
| 2026-07-21 | Run e2e silencieux ~27-30 min, aucune sortie ni erreur, `.next/dev/trace`/logs figés | `next build` lancé juste avant avait invalidé le cache `.next/dev` du `next dev` du webServer Playwright | Ordre des gates changé (build en dernier) ; e2e relancé proprement (43-52 s) |
| 2026-07-21 | Sortie d'un run en arrière-plan totalement vide malgré un process actif | `2>&1 \| tail -100` bufférise tout tant que le pipe ne se ferme pas | Rediriger vers un fichier (`> log 2>&1`), jamais de pipe, pour un run à inspecter en cours de route |
| 2026-07-21 | « on ne voit plus rien sur le graph » (retour Aymeric) | Deux `<div>` frères en `position:absolute` (fond flouté + conteneur Cytoscape) | Repli sur un seul conteneur + fond en `::before` CSS |
| 2026-07-21 | `getByRole("button", { name: "Lieu" })` : strict mode violation, 2 éléments résolus | "Lieu" matche par sous-chaîne le bouton de repli "Lieux" de la sidebar | `exact: true` sur les deux locators concernés du e2e |
| 2026-07-21 | `npm run worker` → `Error: Variables d'environnement invalides` (toutes) | `tsx` seul ne charge aucun `.env`, contrairement à `next dev` | `node --env-file=.env --import tsx src/worker/index.ts` |

**Non committé à la fin de cette session :** `docs/pilotages/devlogs/entree-devlog-2026-07-20.md`
reste modifié sans commit (pré-existant, inchangé depuis la session précédente) ; cette
entrée elle-même (`entree-devlog-2026-07-21.md`) reste à committer par Aymeric.

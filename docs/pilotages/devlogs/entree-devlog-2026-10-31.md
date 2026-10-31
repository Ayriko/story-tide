### Session — 2026-10-31 — KAN-85, lot C2 « Le ciel d'histoires »

**Thèmes abordés :**
- Constat de départ et monde de test de 300 entrées (`seed:perf`, déterministe, gardé « base locale »), banc `perf:constellation` (Chromium visible, CPU ×1 / ×4), mesure de référence C1.
- Jetons CSS `--sky-*` et résolveur `readSkyPalette`, feuille Cytoscape sans fonctions de style.
- Fond « carte céleste » (semis, arcs, graduations) en masques SVG peints en `::before`.
- Étoiles par paliers d'éclat (image SVG à dégradé radial), lignes déclarées / liens du texte, ponts discrets.
- Niveau de détail : noms selon le zoom relatif, libellés de relation au survol et à la sélection.
- Disposition en constellations (Louvain maison, fcose par bloc, rangement, 8 orientations, finition par bloc, arc des étoiles sans lien) ; « Ajuster » par coins réservés.
- Trois animations (arrivée, éclairage au survol, tracé à la création), reduced-motion.
- Finitions : sidebar en verre sous le titre + préférence en cookie, voile du titre, total sous le titre, légende du ciel dans le menu, fondu vers le pied de page.
- Huit allers-retours de validation visuelle avec Aymeric, puis mesure finale, traces, e2e, gates, build, découpage en 6 commits.

**Décisions prises :**
- Machine de référence de la cible « 60 im/s sur 300 entrées » = poste de dev ; limite à CPU ×4 documentée et acceptée, ticket d'optimisation proposé — alternatives : (b) retirer le fondu du survol, (c) alléger les halos seuls — Aymeric (option a).
- Halo des étoiles en image SVG à dégradé radial, une par groupe et palier — l'underlay Cytoscape n'a pas d'alpha par arrêt de dégradé et coûtait cher — proposition validée.
- Noms par palier selon le zoom relatif au cadrage « ajuster » (seuils ×1,4 / ×2 / ×2,8), tous les noms jusqu'à 50 étoiles visibles ; libellés au zoom seulement si ≤ 40 lignes — alternative : seuil de zoom absolu de C1 — Aymeric.
- Icône du type retirée du canvas, ajoutée dans la carte de sélection — Aymeric.
- Constellations : Louvain pondéré (déclarée 2, texte 1), fcose par communauté puis rangement en blocs — l'étirement affine vers 16:9, essayé, a été refusé (déformait les figures) — Aymeric.
- « Ajuster » n'évite que les coins occupés (titre + total, pilules, contrôles, sidebar), occupation 85 % — alternative : bande pleine largeur de C1 — Aymeric.
- Sidebar dépliée de la page du monde = panneau en verre sous la zone du titre, préférence en cookie non httpOnly lu par le serveur — alternative : localStorage (saut à l'hydratation) — Aymeric (verre), proposition validée (cookie).
- Compteurs : total seul sous le titre, légende par groupe dans le panneau du menu, **hors du `role="menu"`** (ARIA strict) — alternative : liste dans le menu + `aria-describedby` — Aymeric.
- Couleurs proches (Écologie / Magie, Lieux / Divers) non retouchées dans ce lot, renvoyées à l'onglet « Apparence » — Aymeric.
- BUG-019 (défaut C1 : étoile posée sur une autre) corrigé tout de suite en commit `fix` séparé — alternative : backlog + test contourné — Aymeric.
- Commits de correctif préparés en **patchs** appliqués à l'index (`git apply --cached`) au lieu de `git add -p` — Aymeric.

**Éléments notables / appris (gotchas) :**
- e2e lancé juste après un `next build` (mesure de perf) : `Error: Timed out waiting 120000ms from config.webServer.` → le build vide le cache `.next/dev`, `next dev` ne démarre pas dans le délai → relancer (cache réchauffé) ; règle du skill e2e-run-hygiene-windows confirmée.
- Crochet e2e devenu faux après un changement de style : `Expected [1, 1, 1] / Received [0, 0, 0]` sur l'opacité des étoiles → le cœur de l'étoile est passé dans l'image, `background-opacity` vaut toujours 0 → lire `background-image-opacity`. Un crochet de test qui lit une propriété de style doit suivre toute refonte du style.
- Régression silencieuse en passant la sidebar en surcouche : `Expected: "false" / Received: "true"` (`aria-expanded` du groupe « Personnages », dashboard-create-entity.spec) → deux instances de `<Sidebar>` (colonne / verre) à deux places de l'arbre : React remonte le composant en changeant de page et perd l'état replié des groupes et dossiers (cas BUG-008) → **une seule instance, seul le conteneur change de classes**. Candidat skill.
- Glisser-déposer cassé dans la sidebar en verre : `expect(locator).not.toBeVisible() failed` (folder-organization.spec) → la trace montre l'aperçu `DragOverlay` décalé de ~145 px : un ancêtre à `backdrop-filter` devient le bloc conteneur des `position: fixed`, dnd-kit teste la collision sur ce rectangle décalé → `createPortal(<DragOverlay>, document.body)` côté client (`useSyncExternalStore`). Candidat skill (backdrop-filter + fixed, général).
- BUG-019 : `getByRole('region', { name: 'Cael …' })` → `element(s) not found`, la carte de Brann s'ouvrait → spec de diagnostic jetable : 3 mondes sur 3, Brann et Cael au même x (128), même point (128, 72) dans un cas → fcose en placement incrémental (`fixedNodeConstraint`) pose une étoile sans lien à un point fixe même occupé → `separateFromStars` (anneaux autour de la position, dans la zone de `clampIntoView`). Candidat skill (fcose + nœuds figés).
- Attendre la stabilité des positions n'a pas suffi pour ce test : 2 échecs sur 3 → ne pas s'arrêter au premier skill qui « colle », vérifier par la trace (frames du `trace.zip` extraites et lues) avant de conclure.
- Couverture : `Error: Test timed out in 5000ms.` sur « deterministe : meme graine, meme ciel » (sky-arrange.test.ts) → deux vraies dispositions de 300 étoiles, ralenties par l'instrumentation (fichier à 11,1 s) → délai explicite `{ timeout: 30_000 }` sur le `describe`, rien retiré des vérifications.
- Vérification d'un patch sur un export de HEAD : `error TS2307: Cannot find module '@/generated/prisma/client'` → le client Prisma généré est ignoré par git → le copier dans l'export avant `tsc`.
- Export de HEAD avec jonction `node_modules` : toujours `cmd //c rmdir <jonction>` AVANT `rm -rf` de l'export, sinon le vrai `node_modules` est vidé.
- Workers e2e orphelins (npx → tsx → node, `src/worker/index.ts`) après CHAQUE run Playwright, même réussi → les lister puis les arrêter par PID ; un arrêt en bloc de tous les `node.exe` a été refusé par le classifieur (trop large).
- Sessions antérieures du lot (même branche) : tsx injecte `__name` dans les fonctions passées à `page.evaluate` → `addInitScript({ content: "globalThis.__name = (fn) => fn;" })` ; bridage rAF d'une fenêtre pilotée (1 à 24 im/s) → options `--disable-background-timer-throttling`, `--disable-backgrounding-occluded-windows`, `--disable-renderer-backgrounding`, `--disable-features=CalculateNativeWinOcclusion` ; Tailwind `outline-none` pose aussi `--tw-outline-style: none` (casse le contour clavier si global) → `[&[data-pointer-focus]]:outline-none` ; défilement de 117 px en e2e = Playwright qui fait défiler une cible recouverte → cause réelle BUG-018.

**Commandes utiles de la session :**
- `npm run seed:perf -- <email>` — recrée le monde déterministe « Ciel de test · 300 » (dev local seulement).
- `npm run perf:constellation -- <email> <mdp> --reseed --runs=5` puis `… --runs=3 --cpu=4` — banc de perf, contre un build lancé avec `NEXT_PUBLIC_E2E_HOOKS=1`, dev arrêté.
- `npx playwright test --workers=1 <spec> -g "<titre>" --repeat-each=3 > e2e.log 2>&1` — confirmer qu'un test intermittent est vraiment corrigé.
- `unzip -q test-results/<test>/trace.zip` puis lire les `screencast-frame` de `0-trace.trace` — voir l'écran au moment exact d'un échec sans ouvrir le trace viewer.
- `git apply --cached <patch>; git commit -m "…"` — commiter un correctif isolé dont les fichiers portent aussi d'autres changements, sans `git add -p`.
- `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` — repérer les workers e2e orphelins avant de les arrêter par PID.

**Livrables produits :**
- Commits (branche `feat/kan-85-ciel-histoires`, au-dessus de `969f9b5`) :
  - `d259b28` fix(a11y): sidebar repliee hors d'atteinte du clavier, focus rendu au bouton (BUG-017)
  - `2eae12f` fix(constellation): la fleche du pied de page ne recouvre plus Reorganiser (BUG-018)
  - `2a9fe02` fix(constellation): une nouvelle etoile ne se pose plus sur une autre (BUG-019)
  - `b168b0c` feat(perf): monde de test de 300 entrees et banc de mesure de la Constellation
  - `1f6a81d` feat(constellation): le ciel d'histoires
  - `2e1e04a` docs(constellation): ADR-0033, cahier, RGAA, OWASP, performance, CHANGELOG
- Docs : `docs/adr/0033-ciel-d-histoires.md` (+ index), `docs/performance-constellation.md` (référence C1, après habillage, après validation, mesure finale, décision, ticket proposé), `docs/cahier-recettes.md` (TST-GRF-002 à 004 réécrits, TST-GRF-011 à 017, TST-MND-016 et 017, TST-SEC-019, note sur TST-MND-014), `docs/plan-correction-bogues.md` (BUG-012 levé, BUG-017 à 019), `docs/accessibilite-rgaa.md`, `docs/securite-owasp.md` (A05), `docs/architecture.md`, `docs/manuels/utilisation.md`, `CHANGELOG.md` ([Unreleased] : Ajouté, Modifié, Corrigé, Limites connues).
- Mesure finale (build de prod, 300 entrées) : ×1 déplacement et glisser 59,9, zoom 56,9, survol 53,6, création d'une relation 54,1, CLS 0 ; ×4 zoom 32,3, déplacement 59,6, glisser 19,4, survol 15,5 ; disposition au premier affichage 0,72 s (C1 : 0,55 s).
- Gates : lint ✅ (0 warning) · typecheck ✅ · format ✅ · tests ✅ 1 178 / 1 178 · couverture lignes `src/lib` 99,12 %, `src/services` 96,87 % (global 98,43 %) · e2e ✅ 43 / 43 (`--workers=1`) · build ✅ sans crochet (0 occurrence de `__storyTideConstellation` dans `.next/static`).

**À faire / suite :**
- `git push` puis PR vers `main` (description prête : `pr-kan-85.md` dans le scratchpad de la session).
- Jira : poster le commentaire KAN-85, créer le ticket « Optimiser le rendu de la Constellation sur machine modeste » (texte dans `docs/performance-constellation.md`).
- Recette staging : nouveaux TST-GRF / TST-MND / TST-SEC, dont l'étape 2 de TST-SEC-019 (attributs du cookie en HTTPS).
- À arbitrer : `@types/cytoscape` apparemment inutilisé ; garde « base locale » absente de `seed:intro` et `admin:promote` ; ADR-0032 absent de l'index `docs/adr/README.md` (oubli de C1, non corrigé) ; couleurs proches pour l'onglet « Apparence » ; astuce du monde à l'arrivée (backlog).
- Skills candidates : backdrop-filter + `position: fixed` (DragOverlay), instance unique d'un composant à état quand son conteneur change, fcose `fixedNodeConstraint` qui superpose.
- Reporter cette entrée dans dev-log.md (hors repo) + redéposer dans le projet Claude.
- Mettre à jour le board Jira (stories touchées → bonne colonne).

---

**Décisions techniques**

| Date | Décision | Alternatives | Justification |
|---|---|---|---|
| 2026-10-31 | **Thème du ciel par jetons CSS `--sky-*` lus et validés au montage (`readSkyPalette`)** | couleurs en dur dans la feuille Cytoscape | prépare le mode clair (KAN-71) et l'onglet « Apparence » sans toucher au code ; repli sûr si un jeton manque |
| 2026-10-31 | **Halo d'étoile en image SVG à dégradé radial (une par groupe × palier)** | `underlay` Cytoscape | pas d'alpha par arrêt dans les dégradés Cytoscape ; underlay coûteux au redessin |
| 2026-10-31 | **Constellations : Louvain pondéré + fcose par bloc + rangement / orientation** | fcose global ; étirement affine 16:9 | figures déclarées lisibles, déterministe ; l'étirement déformait les figures |
| 2026-10-31 | **Préférence de la sidebar en cookie lu côté serveur (`useSyncExternalStore`)** | localStorage | plus de saut à l'hydratation ; valeur « 0 » / « 1 » seule, toute autre ignorée |
| 2026-10-31 | **Une seule instance de `<Sidebar>`, conteneur qui change de forme** | deux instances (colonne / verre) | deux instances remontaient le composant et perdaient l'état des groupes et dossiers |
| 2026-10-31 | **`DragOverlay` rendu dans `document.body` par portail** | aperçu dans la sidebar | un ancêtre à `backdrop-filter` décalait l'aperçu `fixed` et faussait la collision |
| 2026-10-31 | **`separateFromStars` après `clampIntoView` au placement incrémental** | laisser fcose seul | fcose avec nœuds figés pose une étoile sans lien sur un point déjà occupé |

**Erreurs rencontrées & Solutions**

| Date | Symptôme (message exact) | Cause | Solution |
|---|---|---|---|
| 2026-10-31 | `Error: Timed out waiting 120000ms from config.webServer.` | `next build` juste avant l'e2e a vidé le cache `.next/dev` | relancer l'e2e ; build toujours en dernier |
| 2026-10-31 | `Expected [1, 1, 1]` / `Received [0, 0, 0]` (opacité des étoiles, crochet e2e) | crochet lisant `background-opacity`, à 0 depuis le passage du cœur dans l'image | lire `background-image-opacity` |
| 2026-10-31 | `Expected: "false"` / `Received: "true"` (`aria-expanded` du groupe, dashboard-create-entity.spec) | deux instances de `<Sidebar>` selon la page → remontage | instance unique, classes du conteneur selon la page |
| 2026-10-31 | `expect(locator).not.toBeVisible() failed` (glisser vers un dossier, folder-organization.spec) | `DragOverlay` `fixed` sous un ancêtre à `backdrop-filter` → aperçu décalé de ~145 px | `createPortal(<DragOverlay>, document.body)` côté client |
| 2026-10-31 | `getByRole('region', { name: 'Cael …' })` → `element(s) not found` (carte de Brann ouverte) | fcose incrémental + `fixedNodeConstraint` : étoile sans lien posée sur une étoile existante (BUG-019) | `separateFromStars` (anneaux, dans le champ) |
| 2026-10-31 | `Error: Test timed out in 5000ms.` (sky-arrange.test.ts sous couverture) | deux dispositions réelles de 300 étoiles ralenties par l'instrumentation | `describe(…, { timeout: 30_000 }, …)` |
| 2026-10-31 | `error TS2307: Cannot find module '@/generated/prisma/client'` (export de HEAD) | client Prisma généré ignoré par git | copier `src/generated/prisma` dans l'export |

Rien de non commité : l'arbre de travail est propre (6 commits en avance sur `origin/feat/kan-85-ciel-histoires`, non poussés). Ce fichier d'entrée lui-même reste à commiter après le merge.

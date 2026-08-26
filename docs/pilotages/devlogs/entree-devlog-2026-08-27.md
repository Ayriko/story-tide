### Session — 2026-08-27 — Artwork de marque sur les écrans de connexion/inscription

**Thèmes abordés :**
- Branchement de l'artwork de marque (`--bg-image`, `image-set()`) sur `(auth)/layout.tsx`, `/login` et `/register`.
- Extension du contrat de `ShellBackground` par variables CSS (voile, flou, cadrage) pour découpler `(auth)` d'`(app)`/`mentions-legales`.
- Mesure de contraste RGAA sur rendu réel (méthode texte-transparent + capture + calcul WCAG 2.1), pas de simulation.
- Itérations visuelles à la demande d'Aymeric : cadrage de l'image, retrait du flou/voile, couleur des boutons, encart de crédit de l'artiste.
- Deux diagnostics de cache Turbopack HMR périmé (CSS servi non conforme au source).
- Documentation (ADR-0026, `accessibilite-rgaa.md`, cahier de recettes, CHANGELOG) et gates complets.

**Décisions prises :**
- Portée de l'artwork : une seule déclaration sur `(auth)/layout.tsx`, couvre `/login` et `/register` (les pages `/forgot-password`/`/reset-password` du brief n'existent pas) — Aymeric.
- Scrim/flou/cadrage paramétrés par variables CSS scopées via `.auth-artwork` (option « étendre le contrat du composant partagé ») plutôt qu'un composant dédié — Aymeric, cohérent avec le patron déjà utilisé pour `--bg-image` (KAN-36).
- `src/assets/login-hero.jpg` (1,69 Mo, doublon non utilisé) supprimé, jamais commité — Aymeric.
- Flou du shell (`--shell-scrim-blur`) retiré pour `(auth)` : il floutait l'artwork entier alors que seule la carte devait l'être — Aymeric.
- Cadrage `bg-cover` ancré haut-gauche + léger décalage vertical (`left 8%`) pour protéger le lettrage « STORY TIDE » du rognage sur fenêtre non-16:9, testé jusqu'à 2560×1080 — Aymeric.
- Couleur des boutons primaires : `#667EC7` retenu contre `#081484` (les deux mesurés à 4,72:1 / 12,87:1) — Aymeric, override local à `(auth)` uniquement.
- Encart de crédit `@Dvkin` (lien externe vers vgen.co) placé en bas à gauche, hors du conteneur défilant — Aymeric.
- Voile `--shell-scrim` retiré **entièrement** (pas de valeur intermédiaire) — Aymeric, après qu'une valeur à 20 % ait été mesurée encore non conforme sur deux zones (pied de page, sous-titre en 2x) : itérer sur des paliers intermédiaires n'apportait rien, compensation locale ciblée retenue à la place.
- Écart de contraste résiduel (sous-titre du panneau, variante 2880/DPR2, 3,55:1) accepté sans correction supplémentaire — Aymeric, priorité donnée à la fidélité visuelle de l'artwork ; documenté plutôt que masqué (ADR-0026).

**Éléments notables / appris (gotchas) :**
- **Cache HMR Turbopack périmé, deux fois dans la même session** : après une édition confirmée sur le disque de `globals.css`, le rendu (capture d'écran, `getComputedStyle`) restait identique à l'état précédent — aucune erreur, juste un CSS silencieusement pas à jour. Confirmé en grepant la propriété attendue dans `.next/dev/static/chunks/src_app_globals_css_*.css` : absente malgré le fichier source correct. Seule solution fiable : arrêt complet du serveur (`taskkill` sur les PID `node.exe` dont la `CommandLine` matche `next`, via `Get-CimInstance Win32_Process`) + `rm -rf .next` + relance. **Candidat skill** : vérifier systématiquement le CSS compilé après tout changement de variable/classe CSS, avant de faire confiance à un rendu visuel ou à une mesure de contraste — ce projet a un Turbopack dev particulièrement sujet à ce cache périmé.
- **`getComputedStyle().color`/`.borderColor` retourne parfois `oklab(...)` au lieu de `rgb()`/hex** dès que Tailwind construit la couleur via un modificateur d'opacité (`/50`, `/90`) ou pendant une `transition-colors` en cours — un parsing par regex `rgb()`-only échoue silencieusement (retourne `null`). Solution : normaliser via un canvas 2D (`ctx.fillStyle = css; ctx.fillStyle` renvoie une forme normalisée), et gérer les deux formats de sortie possibles (hex pour l'opaque, `rgba()` pour le translucide). Pour une lecture juste après un changement d'état (focus, erreur), attendre ~250 ms que `transition-colors` (composant `Input`, shadcn) se stabilise avant de lire — sinon valeur intermédiaire capturée.
- **Mesure automatisée de contraste sur l'anneau de focus abandonnée** : `focus-visible:ring-3` (box-shadow semi-transparent) contamine son propre échantillon de « fond » quel que soit le padding de la zone mesurée (le pire pixel trouvé est l'anneau lui-même). Vérifié visuellement à la place plutôt que produire un chiffre auquel se fier à tort.
- **`npm run test:coverage` et le `webServer` Playwright plantent sous pression mémoire système, sans rapport avec le code** : `Error: Worker exited unexpectedly` côté Vitest (35/44 fichiers exécutés, coverage faussement bas) puis `FATAL ERROR: ... JavaScript heap out of memory` côté `next dev` (exit code `3221226505`) au lancement des e2e. `Get-CimInstance Win32_Process | Sort-Object WorkingSetSize -Descending` a identifié la cause réelle : une application tierce (Overwatch) consommant 13,4 Go de RAM, ne laissant que ~4 Go libres sur 32. Après fermeture de l'appli (18,8 Go libres), tout repasse au vert sans aucun changement de code. **Candidat skill** : avant de suspecter une régression sur un crash « worker exited »/« out of memory » côté tests, vérifier la RAM disponible et les gros consommateurs plutôt que le code.
- Une des 4 dérivées artwork produites en amont (par Pillow, hors du repo, environnement Linux) divergeait de ±9,7 % en poids du résultat de `scripts/build-artwork.mjs` (jamais exécuté avant cette session) — dans la tolérance ±15 % acceptée ; script confirmé fidèle, aucune modification nécessaire.
- **Collision de numérotation ADR/cahier-recettes à l'ouverture de la MR** : la branche `feat/artwork-login` a été créée depuis un `main` qui a ensuite reçu KAN-52 (mot de passe oublié, mergé + `v1.3.1` taguée) avant que cette branche ne soit poussée en revue. KAN-52 a lui aussi pris le numéro **ADR-0025** (`0025-transport-email-smtp-port-mailer.md`, jamais indexé dans `docs/adr/README.md` — oubli de cette PR, signalé à Aymeric) et les entrées **TST-AUT-010/011** du cahier de recettes. Conflit sur 3 fichiers (`CHANGELOG.md`, `docs/accessibilite-rgaa.md`, `docs/cahier-recettes.md`) détecté seulement à l'ouverture de la MR — diagnostiqué sans risque via `git merge-tree --write-tree <branche> origin/main` (calcule le résultat d'un merge hypothétique sans toucher HEAD, l'index ni le répertoire de travail). Mon ADR renommé en **0026**, mon entrée en **TST-AUT-012** ; les conflits `CHANGELOG.md`/`accessibilite-rgaa.md` restent de vrais conflits de position (les deux branches insèrent au même point d'ancrage) à résoudre à la main. **Candidat skill** : sur une branche longue, `git merge-tree --write-tree <ma-branche> origin/main` avant de pousser une MR pour détecter ce genre de collision (ADR/TST numérotés, section `[Unreleased]`) sans avoir à réellement merger.

**Commandes utiles de la session :**
- `Get-CimInstance Win32_Process | Sort-Object WorkingSetSize -Descending | Select-Object -First 8 Name,ProcessId,@{n='MB';e={[math]::Round($_.WorkingSetSize/1MB,0)}}` — identifier les gros consommateurs de RAM avant de diagnostiquer un crash « out of memory » comme un bug de code.
- `npx vitest run --coverage --pool=forks --maxWorkers=2` — contourner un crash de workers forkés sous pression mémoire (diagnostic ponctuel ; la commande normale du projet reste `npm run test:coverage`).
- `grep -n "<propriété>" .next/dev/static/chunks/src_app_globals_css_*.css` — vérifier qu'une variable/classe CSS a bien été recompilée par Turbopack avant de faire confiance à un rendu visuel.

**Livrables produits :**
- Créés : `public/artwork/login-hero-{1920,2880}.{avif,webp}`, `scripts/build-artwork.mjs`, `src/app/(auth)/artist-credit.tsx` + `.test.tsx`, `src/app/(auth)/layout.test.tsx`, `src/app/shell-background.test.tsx`, `docs/adr/0026-shell-background-parametrable-artwork-marque.md`.
- Modifiés : `src/app/globals.css`, `src/app/shell-background.tsx`, `src/app/(auth)/layout.tsx`, `src/app/(auth)/auth-card.tsx`, `.gitignore`, `docs/adr/README.md`, `docs/accessibilite-rgaa.md`, `docs/cahier-recettes.md`, `CHANGELOG.md`.
- Supprimé : `src/assets/login-hero.jpg` (jamais commité).
- Gates : lint ✅ · typecheck ✅ · format:check ✅ · tests ✅ (436/436, couverture 98,34 % lignes / 95,31 % branches / 94,82 % fonctions / 98,25 % statements — seuil bloquant 80 % largement dépassé) · e2e ✅ (11/11) · build ✅.

**Avancement certification :**
- C2.2.1 : contrat de `ShellBackground` étendu proprement par 3 nouvelles variables CSS (`--shell-scrim`, `--shell-scrim-blur`, `--shell-bg-position`, en plus de `--bg-image` déjà existante KAN-36), zéro régression sur `(app)`/`mentions-legales` prouvée par diff du CSS compilé — ADR-0026.
- C2.2.2 : 3 nouveaux fichiers de tests colocalisés, couverture globale du projet à 98 %+ (largement au-dessus du seuil 80 % bloquant).
- C2.2.3 : mesure de contraste RGAA sur rendu réel documentée dans `accessibilite-rgaa.md`, limite explicite d'axe-core sur `background-image` consignée, écart résiduel connu documenté plutôt que masqué (ADR-0026, TST-AUT-012).
- C2.3.1 : `TST-AUT-012` ajouté au cahier de recettes (format 6 champs + type/statut).
- C2.4.1 : ADR-0026 rédigé, décisions horodatées avec justification et alternatives écartées.

**À faire / suite :**
- Créer le ticket KAN-xx (Aymeric) — type Story, libellé hors 4e mur.
- Commit + push (branche `feat/artwork-login` à créer depuis `main` local, `push -u` avant tout commit) — commandes fournies séparément à Aymeric.
- Passage manuel Ara/NVDA sur `/login` et `/register` — toujours TODO (pré-existant, pas propre à cette session).
- Écart de contraste résiduel (sous-titre du panneau, variante 2880/DPR2, 3,55:1) à rouvrir si l'audit RGAA formel l'exige — candidat `plan-correction-bogues.md`.
- Art direction mobile et dérivation des artworks de monde uploadés — explicitement hors périmètre, backlog.
- Reporter cette entrée dans `dev-log.md` (hors repo) + redéposer dans le projet Claude.
- Mettre à jour le board Jira (story touchée → bonne colonne).

**Rien n'est committé à ce stade** — voir commandes fournies séparément.

---

### Décisions techniques

| Date | Décision | Alternatives | Justification |
|------|----------|--------------|----------------|
| 2026-08-27 | Contrat `ShellBackground` étendu par 3 nouvelles variables CSS (`--shell-scrim`, `--shell-scrim-blur`, `--shell-bg-position`), scopées via `.auth-artwork` | Composant de fond dédié à `(auth)` (dupliquerait la logique unifiée par KAN-36) ; voile fixe conservé tel quel (assombrissait l'artwork commandé au-delà de l'utile) | Valeurs par défaut = comportement historique exact ; zéro régression `(app)`/`mentions-legales` prouvée par diff du CSS compilé |
| 2026-08-27 | Voile de protection générique (`--shell-scrim`) retiré pour `(auth)`, compensé localement (`bg-black/80` pied de page, `bg-card/55` carte) | Valeur intermédiaire (20 %) — mesurée encore non conforme sur 2 zones ; scrim conservé à 45 % | Le voile plat ne protégeait utilement que deux zones précises (mesuré) ; compensation locale ciblée préférée à un filtre global qui dénaturait l'artwork commandé |

### Erreurs rencontrées & Solutions

| Date | Symptôme (message exact) | Cause | Solution |
|------|---------------------------|-------|----------|
| 2026-08-27 | Rendu (capture, `getComputedStyle`) identique à l'état précédent malgré une édition confirmée sur disque | Cache HMR Turbopack périmé — le chunk CSS servi ne reflète pas le fichier source | Arrêt complet du serveur (kill des PID `node.exe`/`next` via `Get-CimInstance Win32_Process`) + `rm -rf .next` + relance ; `grep` de la propriété attendue dans le CSS compilé avant de faire confiance au rendu |
| 2026-08-27 | `getComputedStyle(el).borderColor` → `"oklab(0.80769 0.0975416 0.034682 / 1)"` au lieu de `rgb(...)` | Tailwind construit la couleur via `color-mix()`/modificateur d'opacité, ou lecture pendant une `transition-colors` en cours | Normaliser via canvas 2D (`ctx.fillStyle = css; ctx.fillStyle`), gérer hex (opaque) et `rgba()` (translucide) ; attendre ~250 ms après un changement d'état avant de lire |
| 2026-08-27 | `Error: Worker exited unexpectedly` (Vitest) puis `FATAL ERROR: MarkCompactCollector: ... JavaScript heap out of memory` (webServer Playwright, exit `3221226505`) | Pression mémoire système (une application tierce consommait 13,4 Go de RAM), sans rapport avec le code testé | `Get-CimInstance Win32_Process \| Sort-Object WorkingSetSize -Descending` pour identifier le consommateur, fermer l'application, relancer |

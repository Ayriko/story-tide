### Session — 2026-07-20 — KAN-16 : upload d'images depuis l'éditeur (MinIO, URLs signées)

**Thèmes abordés :**
- Confirmation du merge KAN-18 (base + extension schéma) sur `main` via PR #17.
- Changement d'ordre de sprint (KAN-16 avant KAN-35, décision Aymeric).
- KAN-16 : upload d'images depuis l'éditeur Tiptap vers MinIO via URLs signées, en réutilisant intégralement le port `Storage` existant (KAN-11) — aucune modification du port.

**Décisions prises :**
- Référence stable `/api/media/<imageId>` persistée dans `image.src`, plutôt que l'URL MinIO présignée directe — la contrainte `isSafeHttpUrl` déjà en place (URL http(s) absolue ≤ 2048 caractères) rend une URL présignée (longue, expirante) impersistable telle quelle. Résolution en URL signée fraîche à **chaque lecture** via un Route Handler dédié.
- Sniffing MIME **maison** par magic bytes (`sniffImageMime`) plutôt qu'une librairie tierce (`file-type`) — zéro dépendance pour 4 formats, même esprit que `src/lib/linker`.
- Upload **tamponné via Server Action** (`FormData` + `Buffer` côté serveur) plutôt qu'un signed PUT direct navigateur→MinIO — permet une validation magic-bytes fiable sur les octets réels avant tout envoi ; le port `Storage` n'a donc pas eu besoin d'être étendu.
- Taille max **5 Mo** — arbitré avec Aymeric (aucune valeur dans la spec, même patron que les quotas KAN-18).
- Purge RGPD à la suppression d'un monde : **best-effort, loggée, non bloquante** — arbitré avec Aymeric, même patron que l'enfilage/la réconciliation non-fatale déjà établi (`entity-content.ts`).
- Upload déclenché au clic **« Insérer »**, pas au choix du fichier — limite le cas d'image orpheline (fichier choisi puis popover abandonnée).

**Éléments notables / appris (gotchas) :**
- **Gap d'environnement e2e jamais révélé avant ce ticket** : `.env.e2e` portait des credentials S3 placeholder explicitement documentés comme non fonctionnels (`S3_ACCESS_KEY="e2e"`, commentaire "pas d'upload d'image, placeholders suffisent") — KAN-16 est la toute première feature à exercer réellement `Storage` en e2e, ce qui a révélé le gap : `InvalidAccessKeyId` à l'upload. Corrigé : credentials root réels partagés avec le bucket dev, bucket `story-tide-e2e` dédié provisionné dans `docker-compose.dev.yml` (`minio-setup`, `mc mb --ignore-existing`).
- **Faux négatif e2e** : `toBeVisible()` sur une image `loading="lazy"` (ajouté ce ticket) + fixture PNG 1×1 px a fait échouer le test alors que le round-trip fonctionnait réellement. Diagnostiqué en isolant chaque étape hors navigateur (`curl` avec cookie de session Better Auth obtenu via `POST /api/auth/sign-up/email`, puis `GET /api/media/<id>` → 302 → 200 PNG valide). La bonne assertion pour « l'image a réellement chargé » est `img.complete && img.naturalWidth > 0`, pas la simple visibilité DOM/CSS (candidate à documenter si ça se reproduit sur une future feature avec lazy-loading).
- **OOM Playwright sous forte parallélisation** : passer de 8 à 9 specs e2e a fait planter le `webServer` partagé (`JavaScript heap out of memory`) avec le nombre de workers par défaut (8, un par cœur). Pas un bug fonctionnel — contourné avec `--workers=2` pour cette session, à surveiller si ça redevient un problème récurrent (pas de changement de config permanent appliqué sans confirmation).
- **Récidive du gotcha Windows « process orphelins »** (déjà documenté, skill `windows-orphan-node-e2e-cleanup`) : après le crash OOM, le `webServer`/worker restés vivants ont été réutilisés silencieusement par `reuseExistingServer` au run suivant, causant un hang sans sortie. Diagnostiqué via `Get-CimInstance Win32_Process ... CreationDate` (horodatage antérieur au run en cours, preuve qu'il s'agissait bien du run précédent) et nettoyé via `taskkill /F /T`.

**Commandes utiles de la session :**
- `curl -sS -c cookies.txt -X POST http://localhost:3000/api/auth/sign-up/email -d '{"email":"...","password":"...","name":"..."}'` puis `curl -sS -L -b cookies.txt http://localhost:3000/api/media/<id>` — isole le pipeline signed-URL (redirect + réponse finale) sans passer par un navigateur, utile pour diagnostiquer un round-trip MinIO indépendamment du rendu front.
- `docker compose -f docker-compose.dev.yml up minio-setup` — relance le service one-shot pour (re)provisionner un bucket MinIO sans redémarrer toute la stack.
- `npx playwright test --workers=N` — limite la parallélisation en cas d'OOM du webServer dev partagé.
- `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Select ProcessId, CreationDate, CommandLine` — distingue un process orphelin (horodatage antérieur au run courant) d'un process légitime.

**Livrables produits :**
- Modèle `Image` (migration additive `20260719183323_kan16_image_metadata`), `src/lib/image-validation.ts` (`sniffImageMime`, zéro dépendance), `src/services/image-service.ts` (`uploadImage`, `ImageValidationError`/`ImageStorageError`), `src/actions/image.ts` (`uploadImageAction`), `src/app/api/media/[imageId]/route.ts` (lecture signée + authz), branchement `ImageControl` (`entity-editor.tsx`, file input + fallback URL) et `loading="lazy"` (`tiptap-extensions.ts`), purge RGPD best-effort dans `deleteWorld` (`world-service.ts`).
- Environnement e2e MinIO corrigé (`docker-compose.dev.yml`, `.env.e2e`/`.env.e2e.example`), fixture `e2e/fixtures/test-image.png`.
- Tests : `image-validation.test.ts` (8), `image-service.test.ts` (5), `image.test.ts` (7), `route.test.ts` (4), `world-service.test.ts` (+4, purge), `e2e/image-upload.spec.ts` (1, round-trip réel).
- Docs : `docs/adr/0017-upload-images-minio.md`, `docs/securite-owasp.md` (A01/A10), `docs/cahier-recettes.md` (`TST-SEC-013`, `TST-ENT-010`), `CHANGELOG.md`.
- Gates : lint ✅ 0 warning · typecheck ✅ · tests ✅ 306/306 · couverture **98,74 %** · build ✅ · e2e ✅ 9/9 (workers limités à 2 pour éviter l'OOM local).

**Avancement certification :**
- **C2.2.1** (architecture) : réutilisation du port `Storage` existant sans le modifier (ports & adapters respecté de bout en bout).
- **C2.2.2** (tests) : couverture maintenue à 98,74 % malgré l'ajout d'un service/action/route entiers.
- **C2.2.3** (sécurité + accessibilité) : OWASP A10 (validation MIME réelle par magic bytes, taille max) et A01 (revalidation `getWorld` à chaque lecture d'image) codés et documentés ; RGAA (alt déjà obligatoire, `loading="lazy"` ajouté).
- **C2.3.1** (recette) : `TST-SEC-013`, `TST-ENT-010` ajoutés au cahier de recettes.
- **C2.4.1** (traçabilité) : ADR-0017 (référence stable + sniffing maison).

**À faire / suite :**
- **Rien n'est committé** pour KAN-16 — commandes de commit/push/PR fournies séparément dans la conversation, à exécuter par Aymeric.
- KAN-35 (monde d'introduction "Atheraus") reste la suite logique du sprint, sauf nouveau changement de priorité.
- Reporter cette entrée dans `dev-log.md` (hors repo) + redéposer dans le projet Claude.
- Mettre à jour le board Jira (KAN-16 → en revue une fois la PR ouverte).

---

**Décisions techniques**

| Date | Décision | Alternatives | Justification |
|---|---|---|---|
| 2026-07-20 | Référence stable `/api/media/<id>` plutôt que l'URL présignée directe | Persister l'URL MinIO présignée telle quelle | `isSafeHttpUrl` exige ≤2048 caractères et une URL non expirante — une signature présignée viole les deux |
| 2026-07-20 | Sniffing MIME maison (magic bytes) | Librairie tierce (`file-type`) | Zéro dépendance pour 4 formats, cohérent avec l'esprit `src/lib/linker` |
| 2026-07-20 | Upload tamponné via Server Action (pas de signed PUT direct) | Étendre le port `Storage` avec un presigned PUT | Le serveur doit voir les octets réels pour une validation magic-bytes fiable avant l'envoi vers MinIO |
| 2026-07-20 | Purge RGPD best-effort (loggée, non bloquante) | Bloquer la suppression du monde si un `storage.delete` échoue | Même patron que l'enfilage/la réconciliation non-fatale déjà établi ; un objet MinIO orphelin est une donnée inerte, pas un incident bloquant |

**Erreurs rencontrées & Solutions**

| Date | Symptôme (message exact) | Cause | Solution |
|---|---|---|---|
| 2026-07-20 | `InvalidAccessKeyId: The Access Key Id you provided does not exist in our records.` (upload e2e) | `.env.e2e` portait des credentials S3 placeholder non fonctionnels, jamais exercés avant ce ticket | Credentials root réels partagés avec dev + bucket `story-tide-e2e` provisionné dans `docker-compose.dev.yml` |
| 2026-07-20 | Test e2e : `expect(locator).toBeVisible()` échoue (« Received: hidden ») alors que l'upload fonctionne réellement | Fixture PNG 1×1 px + `loading="lazy"` : `toBeVisible()` ne prouve pas qu'une image a fini de charger | Remplacé par `img.complete && img.naturalWidth > 0` via `expect.poll` |
| 2026-07-20 | `FATAL ERROR: Committing semi space failed. Allocation failed - JavaScript heap out of memory` (webServer Playwright) | 8 workers parallèles contre un seul `webServer` Next.js dev, une fois la 9e spec e2e ajoutée | `npx playwright test --workers=2` pour cette session |
| 2026-07-20 | Run e2e suivant resté figé sans sortie après le crash OOM | `reuseExistingServer` a réutilisé silencieusement le `webServer`/worker restés vivants (mais morts fonctionnellement) après le crash | `Get-CimInstance ... CreationDate` pour identifier les orphelins, `taskkill /F /T`, puis relance propre |

---

### Session — 2026-07-20 (suite) — CI e2e : rendre le check vert (KAN-16)

**Thèmes abordés :**
- Le check `e2e` de la PR `feat/kan-16-upload-images` a échoué 4 fois de suite après merge de la feature — MinIO n'avait jamais tourné en CI avant KAN-16 (premier ticket à l'exercer réellement, cf. gotcha e2e ci-dessus).

**Décisions prises :**
- `services:` GitHub Actions abandonné pour MinIO au profit d'un `docker run` manuel dans deux steps dédiés (« Démarrer MinIO » / « Créer le bucket MinIO ») — un service GHA ne peut pas fournir d'arguments de commande (`server /data`), or `minio/minio` en a besoin pour démarrer.
- Identifiants MinIO/mc dérivés des variables d'env `S3_*` du workflow (pas de valeurs dupliquées en dur dans les steps) — source unique, ne peut pas diverger.
- `BETTER_AUTH_URL` overridé au niveau du job `e2e` (`http://localhost:3100`), même patron que l'override déjà existant sur `DATABASE_URL` — les deux existent parce que ce job seul touche de vrais services, contrairement aux placeholders Zod-valides du niveau workflow.

**Éléments notables / appris (gotchas) :**
- **Catalogue Docker Hub Bitnami, 2025** : la plupart des images `bitnami/*` ont perdu leur tag `:latest` gratuit (déplacé vers `bitnamilegacy`, le namespace `bitnami/*` actuel nécessite majoritairement un abonnement payant). `bitnami/minio:latest` ne se résout plus (`manifest unknown`) — à garder en tête pour toute autre image Bitnami future.
- **Contrainte de démarrage MinIO** : `MINIO_ROOT_USER` doit faire ≥ 3 caractères, sinon le process quitte immédiatement après création du conteneur — sans message d'erreur direct, juste un healthcheck qui time out (`exit code 124`). Diagnostiqué par déduction (mode plan, sans log MinIO direct) ; `docker logs` ajouté après coup pour la prochaine fois.
- **Fausse piste `loading="lazy"`** : le test `image-upload.spec.ts` échouait à `expectImageLoaded` (5000ms puis 15000ms même après `scrollIntoViewIfNeeded`) — le commentaire préexistant du test sur l'IntersectionObserver rendait cette explication très plausible, mais un timeout de 15s sur une fixture de 68 octets qui échoue de façon 100% reproductible ne peut pas être un simple problème de timing. La vraie cause était ailleurs (voir suivant).
- **`.env.e2e` gitignoré ⇒ absent en CI** : `playwright.config.ts` lance toujours `next dev` sur le port **3100**, mais rien dans le workflow ne le disait à la CI — le `BETTER_AUTH_URL` utilisé restait le placeholder `:3000` du niveau workflow (jamais réellement branché ailleurs). `uploadImage()` persiste `src` en `${BETTER_AUTH_URL}/api/media/<id>` : toutes les images de la CI pointaient donc vers un port où rien n'écoutait — c'était la cause racine réelle, pas le lazy-loading.

**Livrables produits (complément) :**
- `.github/workflows/ci.yml` : `S3_ACCESS_KEY` ≥ 3 caractères, steps MinIO dérivés de l'env + diagnostics `docker logs`, override `BETTER_AUTH_URL` du job `e2e`.
- `e2e/image-upload.spec.ts` : `scrollIntoViewIfNeeded()` + poll 15s dans `expectImageLoaded` — durcissement légitime conservé, mais n'était pas la cause de l'échec.
- Gate : `e2e` CI ✅ (confirmé vert par Aymeric).

**À faire / suite (complément) :**
- Rien de nouveau committé par cette session de débogage au-delà des 3 commits `fix(ci)`/`fix(e2e)` déjà poussés sur `feat/kan-16-upload-images` — la PR est prête à merger une fois la CI confirmée verte sur GitHub.

---

### Session — 2026-07-20 (suite 2) — KAN-36 : passe visuelle, P2 (Dialogs) et P3 (dashboard de monde)

**Thèmes abordés :**
- Passe visuelle shadcn/ui sur Radix (P1/P1-bis/P1-ter) : shell app (sidebar repliable, TopBar unifiée, breadcrumb) — déjà couvert par les entrées précédentes, non détaillé de nouveau ici.
- **P2** : sortie des formulaires inline (création/renommage/suppression de monde et de fiche) vers des `Dialog`/`AlertDialog` Radix.
- Correctif combobox (3 itérations, cf. gotchas) sur `EntityTypeCombobox`.
- **P3** : dashboard de monde (« De retour à l'œuvre ») — fiches récentes, panneau graphe permanent, chips d'action rapide, compteurs.

**Décisions prises :**
- Bouton de suppression dans un `AlertDialog` : jamais `AlertDialogAction` — son `onClick` referme le calque de façon synchrone avant qu'une Server Action asynchrone ait pu renvoyer une erreur ; un `Button` simple suffit puisque le succès `redirect()` démonte tout le Dialog et l'échec le laisse ouvert avec l'erreur visible.
- Tri « fiches récentes » (P3b) : **tri de lecture uniquement**, dans la page (`[...entities].sort(...)`) — `listEntities` reste inchangé (`orderBy: createdAt`, partagé par la sidebar et le graphe), `EntityRecord` exposait déjà `updatedAt`. Zéro service touché, plus strict que ce que le garde-fou du plan autorisait.
- Panneau graphe du dashboard : réutilisation du `GraphView` existant via deux props optionnelles (`showFilters`, `canvasClassName`), pas un composant dupliqué — `/graph` (filtres complets, 600px) reste le seul chemin accessible (clavier + liste), le panneau miniature n'est qu'un aperçu non interactif au clavier avec un bouton « Agrandir ».
- Chip « Rechercher » : ne recrée aucun champ — délègue le focus à la recherche déjà existante de la sidebar via un événement DOM privé (même patron que l'événement de repli de sidebar posé en P1-ter), en dépliant la sidebar au passage si repliée.

**Éléments notables / appris (gotchas) :**
- **Combobox — 3 itérations avant la bonne solution.** (1) Panneau en `<div absolute>` simple, rogné par l'`overflow-hidden` du `Card` qui le contenait (bloc P1/P2 initial) → passage à `Popover`/`PopoverContent` (Portal Radix). (2) Régression : `PopoverAnchor` n'est pas exempté par Radix de sa détection « clic en dehors » (contrairement à `PopoverTrigger`) → fermeture instantanée au focus, contournée involontairement en cliquant sur l'icône loupe (tick différent). Neutralisé via `onPointerDownOutside`/`onInteractOutside`/`onFocusOutside` + icône corrigée (chevron au lieu de loupe). (3) Nouvelle régression signalée par Aymeric : la molette ne scrollait plus (seul le clavier, via `scrollIntoView()`, fonctionnait) — le Popover se porte hors du DOM du Dialog (portails frères sous `<body>`), et le verrou de scroll modal du Dialog bloquait la molette sur ce contenu porté ailleurs. **Solution finale** : retour à l'architecture d'origine (`<div absolute>` simple, sans Portal) — devenue sûre car ce composant ne vit plus jamais dans un `Card` depuis P2 (uniquement dans `DialogContent`, sans `overflow-hidden`) ; suppression complète de la mécanique Popover plutôt qu'un nouveau contournement. Confirmé par Aymeric : clavier et molette fonctionnels, icône correcte.
- **Faux hang e2e, cette fois réel.** Après relance du run e2e pour P3, le process est resté à zéro sortie pendant plus de 9 minutes sans qu'aucun `next dev` ni écouteur sur le port 3100 n'existe (`Get-NetTCPConnection`/`curl` négatifs) — contrairement au gotcha connu (pipe bloqué par un orphelin alors que le test avait réellement fini), ici le serveur web n'avait tout simplement jamais démarré. Tâche arrêtée (`TaskStop`), workers orphelins nettoyés, relance **sans** le `| tail -150` habituel (susceptible de masquer une sortie déjà écrite si le pipe reste ouvert) — la relance a immédiatement progressé normalement. Cause racine du premier blocage non identifiée avec certitude (probable contention au tout premier lancement de `next dev` en arrière-plan) ; à surveiller si ça se reproduit.
- **Collision de nom accessible, provoquée par le dashboard lui-même.** La chip « Nouvelle fiche » du dashboard réutilise `CreateEntityDialog` (bon réflexe DRY) mais avec le même texte que le bouton déjà présent dans la sidebar — les deux montés simultanément sur `/worlds/[slug]` cassent `getByRole("button",{name:"+ Nouvelle fiche"})` (violation « strict mode ») sur 8 specs e2e d'un coup. Corrigé à la source (prop `triggerLabel` sur `CreateEntityDialog`, la chip dashboard utilise « Nouvelle fiche » sans le préfixe `+`) plutôt qu'en re-scopant chaque spec.
- **Même famille de bug, deuxième occurrence.** `entity-search.spec.ts` utilisait `page.getByRole("list")` sans le scoper — fonctionnait tant qu'une seule liste existait sur `/worlds/[slug]` ; le nouveau panneau « Fiches récentes » du dashboard en ajoute une deuxième. Corrigé en scopant au `<nav aria-label="Fiches du monde">` de la sidebar (le scope que le test visait réellement depuis le début).

**Commandes utiles de la session :**
- `Get-NetTCPConnection -LocalPort 3100` + `curl -sS -m 5 http://localhost:3100/` — distingue un vrai serveur dev qui répond d'un port mort, plus fiable qu'attendre une sortie qui ne viendra jamais si le webServer n'a jamais démarré.
- Éviter `npx playwright test ... | tail -N` en arrière-plan sous Windows : si un descendant garde le pipe ouvert, `tail` (sans `-f`) n'affiche jamais rien même si le process a déjà tout écrit et quitté — lancer la commande seule et lire le fichier de sortie du harness directement.

**Livrables produits :**
- P2 : `Dialog`/`AlertDialog` pour création/renommage/suppression (monde et fiche), formulaires devenus sans en-tête propre.
- Correctif combobox : `entity-type-combobox.tsx` (architecture finale documentée en tête de fichier), 8e test de non-régression clavier.
- P3 : `worlds/[slug]/page.tsx` (dashboard), `entity-type-icon.tsx` (extraction), `dashboard-search-chip.tsx`, `graph-view.tsx` (+`showFilters`/`canvasClassName`), `create-entity-dialog.tsx` (+`triggerLabel`), `world-shell.tsx`/`entity-search.tsx` (événement `story-tide:focus-search`).
- Docs : `docs/accessibilite-rgaa.md` (Dialogs P2, dashboard P3), `docs/cahier-recettes.md` (`TST-MND-006`, `TST-MND-007`).
- Gates : lint ✅ 0 warning · typecheck ✅ · tests ✅ 310/310, couverture **98,74 %** · build ✅ · e2e ✅ 9/9 (`--workers=2`).

**Avancement certification :**
- **C2.2.1** : aucun service/action/schéma touché pour P3 ; `GraphView` étendu par des props optionnelles rétrocompatibles, pas dupliqué.
- **C2.2.2** : couverture maintenue à 98,74 % sans nouveau test unitaire dédié (P3 = composition de briques déjà testées) ; 2 bugs e2e réels détectés et corrigés par les gates existants, pas de nouveau test requis (collisions de nommage, pas de nouvelle logique).
- **C2.2.3** : dashboard entièrement navigable au clavier hormis le canvas Cytoscape (affordance souris assumée, équivalent accessible sur `/graph`), `<h1>` unique conservé, icônes toujours accompagnées de texte.
- **C2.3.1** : `TST-MND-006`/`TST-MND-007` ajoutés (cas passant + état vide).

**À faire / suite :**
- **Vérification visuelle manuelle par Aymeric requise avant de considérer P3 terminé** (jamais faite par Claude in Chrome, conformément à la consigne de session).
- **État git à trancher par Aymeric** : P1-ter, P2 (Dialogs) et P3 (dashboard) sont tous les trois encore non committés dans le même arbre de travail — aucune des commandes de commit « un écran = un commit » proposées phase par phase n'a été exécutée entre-temps. Décision à prendre : un commit unique couvrant les trois phases, ou un découpage manuel (`git add -p`) par Aymeric.
- P4 (fiche entité, pattern cardHeader), P5 (graphe plein écran depuis le panneau du dashboard), P5b (palette Ctrl+K, panneau raccourcis) restent à faire si le temps le permet avant le gel du 24/07.

---

### Session — 2026-07-20 (suite 3) — KAN-36 : restructuration dashboard, sidebar groupée, lexique produit

**Thèmes abordés :**
- **P3-bis** : restructuration du dashboard après revue visuelle d'Aymeric (hiérarchie typographique, actions sur la ligne d'en-tête, astuce déplacée, deux colonnes alignées 1/3-2/3, pied de carte en une ligne de compteurs) — pas un bug, un réagencement.
- Ajustements mineurs post-revue : bordure du cadre « Fiches récentes » retirée, icône de type agrandie, grille passée de 1/2-1/2 à 1/3-2/3.
- **P3 point 5** : sidebar groupée par catégorie de type (mêmes 8 groupes que le combobox), groupes pliables.
- **Lexique produit** (avant P4) : « fiche » → « entrée », « Graphe » → « Constellation », « Entités liées » → « Renvois », « Mentionné par » → « Échos », registre « tissage » pour les messages de liaison automatique.
- Commit unique (42 fichiers) + push sur `feat/kan-36-passe-visuelle`, confirmés par Aymeric et vérifiés (`git log`/`git status`).

**Décisions prises :**
- Hauteur des deux colonnes du dashboard : valeur fixe partagée (`h-[26rem]`) plutôt qu'un stretch CSS Grid — plus simple et déterministe, aucune dépendance à un `h-full` en cascade dans `GraphView`.
- État plié/déplié des groupes de la sidebar : `useState` local à `EntitySearch`, **pas** de `localStorage`/événement DOM comme pour le repli de la sidebar entière — le layout du monde (`worlds/[slug]/layout.tsx`) persiste déjà à travers toutes les navigations internes (App Router, segment partagé), donc un simple state survit "pendant la navigation" comme demandé, sans plomberie supplémentaire. Pas de persistance inter-rechargement (non demandée).
- Recherche × groupe replié : tranché avec Aymeric (`AskUserQuestion`) — pendant qu'une requête est active, l'état replié est ignoré à l'affichage (tout groupe non vide se déplie), et reprend son état mémorisé une fois le champ vidé. Alternative écartée : ne jamais outrepasser le repli explicite (aurait pu cacher un résultat de recherche sans indice visuel).
- Migration `data-testid` scopée à seulement 2 boutons (déclencheur + soumission de création d'entrée) plutôt qu'à tous les sélecteurs texte — ce sont les deux qui avaient déjà cassé deux fois cette session sur un simple changement de libellé ; les sélecteurs `getByRole("navigation", {name})`/`getByLabel` restent intentionnellement des sélecteurs par rôle/label (ils vérifient un vrai nom accessible RGAA, pas un artefact fragile).
- Aucune string « Modifier l'entrée » n'existant dans l'app (exemple donné par Aymeric), le motif de renommage a été appliqué au texte réel le plus proche (« Paramètres de la fiche » → « Paramètres de l'entrée ») plutôt que d'inventer un nouveau libellé — signalé explicitement à Aymeric pour confirmation plutôt que décidé en silence.

**Éléments notables / appris (gotchas) :**
- **Un `npm run dev` parasite, apparu deux fois de plus cette session** (en plus des occurrences précédentes) — jamais lancé par Aymeric (confirmé les deux fois via `AskUserQuestion`), toujours arrêté avant les gates e2e. La récurrence (3+ fois sur la journée) suggère quelque chose qui démarre un serveur dev automatiquement côté machine d'Aymeric (IDE, tâche planifiée, watcher) — signalé mais non investigué plus loin, à surveiller si ça continue.
- **L'inventaire par agents Explore a raté un cas.** 3 agents parallèles ont fait l'inventaire exhaustif de « fiche »/« Graphe »/« Entités liées »/« Mentionné par » dans `src/**` et `e2e/**`, mais aucun n'a couvert les **tests de composants** (`*.test.tsx` hors e2e) — `create-entity-form.test.tsx` (`getByRole("button",{name:/créer la fiche/i})`, 3 occurrences) est passé au travers, retrouvé seulement via un grep manuel large (`\bfiches?\b`, tout `src/`) fait par prudence avant de lancer les gates. Leçon : après un inventaire par agents scopés, toujours faire un grep final non filtré sur tout le repo avant de déclarer un renommage complet — les scopes donnés aux agents peuvent avoir des angles morts que le prompt n'anticipait pas.
- **Dette découverte, pas traitée** : `docs/cahier-recettes.md` contient une centaine d'occurrences de « fiche »/« Graphe » dans la prose des scénarios existants (TST-ENT-*, TST-LNK-*, TST-GRF-*, etc.) — le lexique produit n'a été appliqué qu'à l'UI et aux nouvelles entrées (`TST-MND-006/007`), pas rétroactivement aux scénarios déjà écrits. Un testeur suivant ces scénarios sur staging lira "cliquer sur Graphe" alors que le bouton dit désormais "Constellation" — à corriger, hors périmètre de cette session (le lexique était explicitement cadré "UI uniquement").

**Commandes utiles de la session :**
- `grep -n '\bfiches?\b' -i <path>` (mot entier, insensible à la casse) — évite les faux positifs style "affiche"/"affichage" qui polluent un grep naïf sur `fiche`.
- `git show --stat <sha>` + `git log -1 --format="%B" <sha>` — vérifie ce qu'un commit contient réellement avant d'écrire dessus dans le dev-log, plutôt que de faire confiance à une affirmation non vérifiée ("c'est commit et push").

**Livrables produits :**
- P3-bis : `worlds/[slug]/page.tsx` restructuré (en-tête, astuce, colonnes 1/3-2/3, pied de carte).
- P3 pt.5 : `entity-search.tsx` (regroupement par catégorie, repli/dépli, `aria-expanded`), `e2e/entity-search.spec.ts` re-scopé (sidebar contient désormais plusieurs `<ul>`).
- Lexique produit : ~20 fichiers UI + 4 fichiers service/action (messages d'erreur) + 3 tests unitaires + 8 specs e2e + `entity-type-icon.tsx`/`create-entity-dialog.tsx` (props `triggerVariant`/`triggerTestId`).
- 1 commit (`eaf38f4`, 42 fichiers, 1346+/468-) poussé sur `feat/kan-36-passe-visuelle`, confirmé via `git log`/`git status` (arbre propre, rien en attente côté upstream).
- Gates : lint ✅ 0 warning · typecheck ✅ · tests ✅ 310/310, couverture **98,74 %** · build ✅ · e2e ✅ 9/9 (`--workers=2`, relancé après chaque changement).

**Avancement certification :**
- **C2.2.1** : aucun service/action/schéma modifié dans sa structure pour cette session (le lexique ne touche que des littéraux de texte, y compris dans les fichiers de service) — vérifié explicitement par inventaire avant exécution.
- **C2.2.2** : couverture maintenue à 98,74 %, toutes les assertions de texte (composants + e2e) mises à jour dans le même commit que le code qu'elles vérifient.
- **C2.2.3** : groupes de la sidebar au patron disclosure standard (`aria-expanded`, navigation clavier) ; migration `data-testid` n'a retiré aucune vérification de rôle/nom accessible existante.
- **C2.3.1** : dette identifiée sur `cahier-recettes.md` (voir gotchas) — pas encore traitée.

**À faire / suite :**
- Mettre à jour la prose des scénarios existants du cahier de recettes avec le nouveau lexique (« fiche » → « entrée », « Graphe » → « Constellation »).
- P4 (fiche entité, pattern cardHeader), P5 (graphe plein écran depuis le panneau du dashboard), P5b (palette Ctrl+K, panneau raccourcis) restent la suite logique, sauf nouveau changement de priorité d'Aymeric.
- Reporter cette entrée (et celle de "suite 2") dans `dev-log.md` (hors repo) + redéposer dans le projet Claude.
- Mettre à jour le board Jira (KAN-36 → colonne appropriée selon l'avancement réel des sous-tâches P1-P3).

---

**Décisions techniques**

| Date | Décision | Alternatives | Justification |
|---|---|---|---|
| 2026-07-20 | Hauteur fixe partagée (`h-[26rem]`) pour les deux colonnes du dashboard | Stretch CSS Grid (`items-stretch` + `h-full` en cascade) | Déterministe, aucune dépendance à faire remonter `h-full` à travers `GraphView` |
| 2026-07-20 | Repli des groupes sidebar en `useState` local, pas `localStorage` | Même patron que le repli de sidebar entière (persistance localStorage + événement DOM) | Le layout du monde persiste déjà across navigation (App Router) — la demande ("pendant la navigation") n'exigeait pas de survivre à un rechargement complet |
| 2026-07-20 | `data-testid` scopé à 2 boutons seulement | Migrer tous les sélecteurs texte fragiles | Seuls ces deux boutons avaient réellement cassé (deux fois) ; les sélecteurs par rôle/label restent la meilleure preuve RGAA, pas un artefact à remplacer |

**Erreurs rencontrées & Solutions**

| Date | Symptôme (message exact) | Cause | Solution |
|---|---|---|---|
| 2026-07-20 | 8 specs e2e cassées d'un coup : `strict mode violation: getByRole('button', { name: '+ Nouvelle fiche' }) resolved to 2 elements` | Chip "Nouvelle fiche" du dashboard réutilisant `CreateEntityDialog` avec le même texte que le bouton de la sidebar, montés simultanément | Prop `triggerLabel` distincte par appelant (déjà en place avant cette session, réutilisée) |
| 2026-07-20 | Run e2e en arrière-plan resté à zéro sortie pendant 9+ minutes, aucun `next dev`/écouteur sur le port 3100 | Le webServer Playwright n'a jamais démarré ; le run est resté bloqué avant même d'écrire quoi que ce soit dans le pipe `\| tail -150` | `Get-NetTCPConnection`/`curl` pour confirmer l'absence réelle de serveur (pas juste un pipe bloqué), `TaskStop`, nettoyage des orphelins, relance sans `\| tail` |

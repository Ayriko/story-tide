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

### Session — 2026-07-23 — Recette C2.3.1 sur staging v1.2.0-rc.1

**Thèmes abordés :**
- Exécution complète du cahier de recettes (60 scénarios : AUT, SEC, MND, ENT, LNK, GRF, QOT) sur staging v1.2.0-rc.1.
- Priorisation des familles éliminatoires SEC puis LNK avant le reste.
- Deux scénarios encore ⬜ (ENT-007, ENT-008) exécutés pour la première fois.
- Diagnostic en direct de 3 bogues bloquants découverts pendant la recette (upload/affichage d'image), avec correctif partiel appliqué en live sur staging (création manuelle du bucket MinIO).
- Clôture : synthèse chiffrée, verdict GO/NO-GO, mise à jour du cahier de recettes et du plan de correction des bogues.

**Décisions prises :**
- Scénarios infra SEC-009/010/011/012 (déjà ✅ le 18-07 sur v1.0.0-rc.2/v1.0.1) rejoués par `curl`/`Test-NetConnection` sur rc.1 plutôt que simplement cités — preuve re-datée sur la version taguée. Décision Aymeric en tête de session.
- SEC-004 à 008 (validation serveur nécessitant de forger un payload hors éditeur) consignés par citation des tests unitaires existants, sans rejeu manuel — décision Aymeric, gain de temps sur des scénarios structurels déjà couverts.
- BUG-006 (upload >5 Mo → `500` brut, cause ensuite identifiée comme la limite Server Actions Next.js à 1 Mo) arbitré **P2/report** à deux reprises — une première fois par prudence, une seconde fois après découverte de la cause exacte (le correctif est trivial mais Aymeric a choisi de ne pas re-arbitrer à la hausse malgré la simplicité du fix).
- BUG-007 (`javascript:` persisté malgré la double barrière SafeLink + serveur documentée, mais aucun clic — simple ou Ctrl/Cmd — ne déclenche d'exécution dans l'UI actuelle) arbitré **P1, correctif requis avant tag**, malgré l'absence d'exploit vivant trouvé, car la garantie de défense en profondeur documentée ne tient pas.
- BUG-008 (repli des groupes de la sidebar réinitialisé à toute navigation, pas seulement après création d'entrée) arbitré **P2/report** — purement cosmétique, la fraîcheur des données (le vrai correctif de BUG-004 v3) reste confirmée correcte.
- BUG-009 (Échap dans le combobox Type ferme tout le dialog et vide le formulaire, perte de saisie) arbitré **P2/report** malgré une perte de données utilisateur en jeu — jugé d'impact limité (resaisie possible, rien de persisté perdu en base).
- BUG-010 (bucket MinIO `story-tide-staging` jamais provisionné sur staging) arbitré **P1, correctif immédiat** — bucket créé manuellement via la console MinIO en session pour débloquer la suite de la recette (ENT-010/012).
- BUG-011 (URL présignée MinIO pointant vers l'hôte Docker interne `minio:9000`, inatteignable du navigateur) arbitré **P1, correctif avant tag**, recette poursuivie sur les autres scénarios en parallèle sans bloquer la session dessus.
- BUG-012 (type d'un nœud de la Constellation identifiable uniquement par sa couleur, manquement RGAA/WCAG 1.4.1) arbitré **P2/report** — le clic navigue vers la fiche où le type est affiché en badge, impact jugé limité.
- QOT-002 (quota 50 entités) traité par citation de `e2e/quota.spec.ts` plutôt que rejeu manuel (seed de 49 entités jugé disproportionné en fin de session) — décision Aymeric.
- QOT-003 consigné en combinant une preuve fraîche en conditions réelles (les 3 mondes USER de QOT-001, créés avec succès malgré la présence d'Atheraus `origin=INTRO`) et la citation du test unitaire pour le volet quota d'entités — décision Aymeric.

**Éléments notables / appris (gotchas) :**
- Scénario LNK-002 mal construit initialement : demander de supprimer une mention `@` pour vérifier qu'un re-scan AUTO ne touche pas une `Relation MANUAL` déclenche en réalité `reconcileManualMentions` (suppression légitime liée à la présence du nœud de mention), pas `scanAndLinkEntity` (le vrai mécanisme à isoler). Corrigé en gardant la mention en place et en ne déclenchant qu'un re-save neutre. À garder en tête pour tout futur scénario manipulant des relations MANUAL : les deux mécanismes ne se testent jamais de la même façon.
- Latence perçue du worker de liaison : un re-scan vérifié après seulement ~1 s peut sembler « en échec » alors que le seuil qualité du projest est « < 5 s après debounce » — pas un bug, juste une vérification trop précoce (observé sur LNK-007, réapparition confirmée seulement après un second re-save avec attente cumulée suffisante).
- BUG-006 : cause confirmée par les logs serveur (`docker logs storytide-staging-app-1`) — `Error: Body exceeded 1 MB limit.` (`statusCode: 413`), la limite par défaut des Server Actions Next.js (1 Mo, jamais relevée via `serverActions.bodySizeLimit`) est atteinte avant le contrôle applicatif de taille (5 Mo). Candidat clair pour une future skill projet (« upload volumineux via Server Action → vérifier bodySizeLimit avant tout diagnostic »).
- BUG-011 : diagnostic mené en suivant la chaîne complète (`/api/media/<id>` → `302` → header `Location`) jusqu'à repérer que l'URL présignée MinIO utilise le nom d'hôte interne du réseau Docker Compose (`minio:9000`) au lieu d'un endpoint public — piège classique de conteneurisation (l'app parle à MinIO en interne avec un nom qui n'existe que dans le réseau Docker, mais génère des URLs présignées destinées à un client externe avec ce même nom). Candidat clair pour une future skill projet.
- Erreur de process de ma part (assistant) : plusieurs entrées du cahier ont été marquées « Capture prise » sans confirmation explicite d'Aymeric (LNK-004, LNK-006, QOT-001, GRF-001) — corrigé après relecture croisée en fin de session, confirmé a posteriori par Aymeric que les 4 captures avaient bien été prises. Ne plus jamais consigner une preuve (capture ou autre) sans confirmation explicite dans la réponse de l'utilisateur.

**Commandes utiles de la session :**
- `curl.exe -vI https://staging.storytide.fr` — forcer le vrai binaire curl sous Windows (évite l'alias PowerShell `Invoke-WebRequest`), utile pour tout contrôle TLS/en-têtes futur.
- `Test-NetConnection -ComputerName <IP> -Port <port>` — équivalent PowerShell de `nc -zv`, absent nativement sous Windows.
- `docker logs <nom-conteneur> --tail=200` — lecture des logs serveur staging via SSH VPS ; `docker ps` d'abord pour retrouver le nom exact du conteneur si le nom de projet compose ne matche pas directement.
- `"Élara".Normalize([Text.NormalizationForm]::FormD)` puis `Set-Clipboard` (PowerShell) — produire un texte en forme Unicode décomposée (NFD) impossible à taper au clavier Windows, pour tester LNK-008 (normalisation NFC) sans automatisation navigateur.

**Livrables produits :**
- `docs/cahier-recettes.md` : 60/60 scénarios consignés avec statut recette staging v1.2.0-rc.1 daté du 2026-07-23 (53 passants, 3 non passants bloquants, 4 reportés P2). Non commité (à faire par Aymeric).
- `docs/plan-correction-bogues.md` : 7 nouvelles entrées (BUG-006 à BUG-012), chacune qualifiée, arbitrée et tracée. Non commité (à faire par Aymeric).
- Aucun gate CI relancé en session (session de recette manuelle, pas de modification de code) — les gates historiques cités dans le cahier restent ceux des sessions précédentes.

**Avancement certification :**
- **C2.3.1 (recette, éliminatoire)** : avancée majeure — première exécution complète du cahier sur un environnement staging officiellement taguée, verdict rendu. `docs/cahier-recettes.md` mis à jour en conséquence.
- **C2.2.3 (sécurité + accessibilité, éliminatoire)** : deux défauts de sécurité (BUG-006, BUG-007) et un défaut d'accessibilité (BUG-012) documentés et tracés dans `docs/plan-correction-bogues.md` ; aucune mise à jour de `/docs/securite-owasp.md` cette session (pas de nouvelle mesure codée, uniquement des constats de recette).
- **C2.2.1 (architecture)** : aucun impact direct, session de recette pure.

**À faire / suite :**
- **Verdict : NO-GO pour le tag v1.2.0 prod en l'état.** Bloquants : BUG-007 (P1, SEC-014, famille éliminatoire) et BUG-011 (P1, ENT-010/012).
- BUG-010 corrigé en live sur staging (bucket créé à la main) mais **pas encore reproductible** — à transformer en étape de provisioning documentée/automatisée avant tag, sinon même panne au premier déploiement prod.
- Une fois BUG-007/010/011 traités : nouvelle `v1.2.0-rc.2`, retester uniquement SEC-014, ENT-010, ENT-012 (pas toute la recette).
- Capture visuelle du dialog Image (ENT-010) toujours manquante pour le dossier — bloquée par BUG-011, à reprendre après correctif.
- Committer `docs/cahier-recettes.md` et `docs/plan-correction-bogues.md` (message préparé, Aymeric exécute) :
  ```
  git add docs/cahier-recettes.md docs/plan-correction-bogues.md
  git commit -m "docs: recette staging v1.2.0-rc.1 (2026-07-23) — 53/60 passants, 3 bloquants (BUG-007/010/011), 4 reportés P2"
  ```
- Reporter cette entrée dans `dev-log.md` (hors repo) + redéposer dans le projet Claude.
- Mettre à jour le board Jira (stories/tickets liés aux bogues détectés → colonne appropriée, notamment BUG-007/BUG-011 en priorité).

---

**Erreurs rencontrées & Solutions**

| Date | Symptôme (message exact) | Cause | Solution |
|---|---|---|---|
| 2026-07-23 | `POST .../entities/<id> 500 (Internal Server Error)` + « An error occurred in the Server Components render. The specific message is omitted in production builds... » (upload image >5 Mo) | `Error: Body exceeded 1 MB limit.` (logs serveur) — limite par défaut des Server Actions Next.js (1 Mo) atteinte avant le contrôle applicatif de taille (5 Mo), jamais relevée via `serverActions.bodySizeLimit` | Non corrigé cette session (P2/report) — nécessite d'ajouter `serverActions.bodySizeLimit` dans `next.config` |
| 2026-07-23 | `{"ok":false,"error":"Envoi impossible pour le moment."}` (upload image valide <5 Mo) | `NoSuchBucket: The specified bucket does not exist`, `BucketName: 'story-tide-staging'` — bucket jamais provisionné sur l'environnement staging | Bucket créé manuellement via la console MinIO (correctif temporaire, à automatiser dans le déploiement) |
| 2026-07-23 | Image uploadée avec succès mais jamais affichée (texte alternatif à la place) | `/api/media/<id>` → `302` → `Location: http://minio:9000/...` — hôte Docker interne inatteignable depuis le navigateur | Non corrigé cette session (P1, correctif requis avant tag) — l'adaptateur Storage doit générer les URLs présignées avec un endpoint public distinct de l'endpoint interne serveur→MinIO |

Note (mise à jour ci-dessous) : le commit décrit ci-dessus a depuis été fait par
Aymeric ; la session s'est poursuivie le même jour par la correction des bogues
bloquants — voir la section suivante.

---

### Session — 2026-07-23 — Correction BUG-007/010/011, clôture de la recette

**Thèmes abordés :**
- Diagnostic approfondi de BUG-007 (suite directe de la recette du même jour) : conclusion, faux positif.
- Correctif de BUG-011 (proxy applicatif pour la lecture d'image) avec ADR dédié.
- Automatisation de BUG-010 (provisionnement du bucket MinIO) dans les deux stacks de déploiement.
- Gates complets, commit et push par Aymeric, CI verte.

**Décisions prises :**
- BUG-007 requalifié et **retiré** après preuve empirique (voir gotcha ci-dessous) — aucun correctif de code, contrairement à l'arbitrage initial P1 pris plus tôt dans la journée.
- BUG-011 : option « exposer MinIO publiquement via Traefik » explicitement écartée car elle aurait cassé `TST-SEC-011` (déjà validé) — retenue : proxy applicatif (`route.ts` fetch le binaire côté serveur et le streame, jamais de redirection vers l'endpoint interne). Décision documentée dans un nouvel ADR-0023 plutôt qu'un simple commentaire de code, vu l'alternative écartée et l'implication sécurité.
- Cache `Cache-Control: private, max-age=31536000, immutable` ajouté sur la lecture d'image (amendement demandé par Aymeric après relecture de l'ADR) — `private` (pas `public`, la lecture reste soumise à autorisation) ; l'immutabilité par `imageId` a été **vérifiée dans le code** (`uploadImage` ne fait jamais qu'un `create`, jamais d'`update`/`upsert` sur `Image`) avant d'être affirmée dans l'ADR, pas supposée.
- BUG-010 : au lieu de documenter seulement la procédure manuelle, un service one-shot `minio-setup` (pattern déjà existant dans `docker-compose.dev.yml`, jamais répliqué en staging/prod) a été ajouté aux deux stacks — décision de fermer le gap plutôt que de le documenter comme limitation connue.
- E2E local non relancé après le correctif BUG-011 (Docker Desktop non démarré dans l'environnement d'exécution, et ce test ne reproduit de toute façon pas le bug — spécifique au réseau Docker multi-conteneurs de staging, absent en dev où `S3_ENDPOINT=localhost`) — décision Aymeric de considérer lint+tsc+unit suffisants, la vraie validation se fera sur la prochaine rc staging.

**Éléments notables / appris (gotchas) :**
- **BUG-007 était un faux positif** : le lien `javascript:` "persisté" observé dans l'onglet Elements de Chrome n'était pas une vraie balise `<a>` mais du texte HTML échappé (le collage source n'avait que `text/plain` sur le presse-papiers — confirmé via un écouteur `paste` temporaire en console, jamais de `text/html`). La coloration syntaxique du panneau Elements affiche du texte échappé (`&lt;a href=...&gt;`) de façon visuellement indiscernable d'un vrai élément imbriqué. Preuve définitive obtenue via `$0.querySelector('a')` (→ `null`), `$0.outerHTML` (entités échappées), `$0.textContent` (texte littéral décodé) — jamais se fier à la seule lecture visuelle du panneau Elements pour qualifier un bogue XSS. **Candidat skill confirmé** (mémoire assistant déjà créée : `feedback-verify-dom-not-devtools-visual`).
- **BUG-011, cause racine confirmée par lecture de code** (pas seulement hypothèse) : `src/lib/storage/index.ts` construit un unique `S3Client` avec l'endpoint `env.S3_ENDPOINT` (interne, `minio` en staging/prod), et `getSignedUrl` (`s3-adapter.ts`) génère la signature avec ce même endpoint — aucune distinction entre un usage serveur→MinIO (fonctionne, réseau Docker) et une URL destinée au navigateur (doit être publiquement résolvable). Le port `Storage` (`getSignedUrl`) n'a pas eu besoin d'être modifié : le correctif est resté localisé à la route de lecture (`route.ts`), qui fait elle-même le fetch au lieu de rediriger.
- Vigilance A10 (SSRF) en écrivant le correctif BUG-011 : un `fetch` serveur ajouté doit toujours être vérifié contre le principe "l'hôte ne doit jamais venir d'une entrée utilisateur" avant d'être considéré sûr — ici l'hôte vient de `env.S3_ENDPOINT` (config serveur), jamais du client, donc pas un SSRF ; documenté explicitement dans `docs/securite-owasp.md` plutôt que laissé implicite.
- `docker compose -f <fichier> config` valide la syntaxe/l'interpolation d'un compose file **sans avoir besoin du démon Docker actif** — utile pour vérifier des changements d'infra quand Docker Desktop n'est pas démarré dans l'environnement d'exécution de l'agent.

**Commandes utiles de la session :**
- `docker compose -f deploy/compose.staging.yml config -q` (avec toutes les variables d'env requises passées en ligne, ex. `IMAGE_TAG=test POSTGRES_USER=u ... docker compose ...`) — valide un compose file sans démon Docker actif, silencieux si tout est correct.
- Écouteur `paste` temporaire en console DevTools pour inspecter `clipboardData.types`/`getData('text/html')`/`getData('text/plain')` sans déclencher de dialogue — décisif pour trancher BUG-007.
- `$0.querySelector('a')` / `$0.outerHTML` / `$0.textContent` en console DevTools (après sélection d'un nœud dans Elements) — seule preuve fiable pour distinguer un vrai élément DOM d'un texte échappé qui lui ressemble visuellement.

**Livrables produits :**
- `src/app/api/media/[imageId]/route.ts` + `route.test.ts` : proxy applicatif au lieu de redirection (BUG-011), cache `immutable` ajouté. Tests : 6/6 verts (dont 2 nouveaux cas 502).
- `deploy/compose.staging.yml` + `compose.prod.yml` : service `minio-setup` ajouté, dépendances `app`/`worker`/`backup` mises à jour (BUG-010).
- `docs/adr/0023-proxy-lecture-image-jamais-minio-public.md` (nouveau) + `docs/adr/README.md` (index).
- `docs/securite-owasp.md` : lignes A01 et A10 mises à jour (proxy documenté, fetch non-SSRF, bucket automatisé sur les 3 environnements).
- `docs/manuels/deploiement.md` : checklist post-déploiement complétée (service one-shot `minio-setup`, `Exited (0)` attendu).
- `docs/cahier-recettes.md` + `docs/plan-correction-bogues.md` : BUG-007 retiré, BUG-010/BUG-011 marqués corrigés, synthèse révisée à 54 passants / 2 non passants (retest en attente) / 4 reportés.
- Gates : lint 0 warning (fichiers touchés + projet entier), `tsc --noEmit` clean, **377/377 tests unitaires**. E2e local non exécuté (Docker Desktop indisponible dans l'environnement d'exécution ; non pertinent pour BUG-011 de toute façon, cf. décisions).
- Commit + push effectués par Aymeric, CI verte (confirmé par Aymeric).

**Avancement certification :**
- **C2.3.1 (recette)** : cycle complet detection→qualification→priorisation→diagnostic→correctif+test→recette bouclé en une seule journée pour BUG-007/010/011, conformément au processus documenté dans `plan-correction-bogues.md`.
- **C2.2.3 (sécurité)** : A01/A10 de `docs/securite-owasp.md` mis à jour avec le nouveau comportement du endpoint media (proxy, non-SSRF) et le provisionnement du bucket désormais automatisé sur les 3 environnements.
- **C2.2.1 (architecture)** : nouvel ADR-0023 (C2.4.1) documentant une décision d'architecture avec alternative explicitement écartée pour préserver une garantie de sécurité existante (`TST-SEC-011`).
- **C2.2.2 (tests)** : `route.test.ts` étendu (proxy, 2 cas d'échec 502) — aucune baisse de couverture, 377/377 tests toujours verts.

**À faire / suite :**
- **Plus aucun bogue de code en attente.** Reste uniquement le retest réel sur une nouvelle `v1.2.0-rc.2` : SEC-014 (déjà repassé ✅ ici mais à reconfirmer sur un déploiement réel), ENT-010, ENT-012.
- Capture visuelle du dialog Image (ENT-010) toujours manquante pour le dossier — à prendre au retest sur rc.2.
- Reporter cette entrée (les deux sections du jour) dans `dev-log.md` (hors repo) + redéposer dans le projet Claude.
- Mettre à jour le board Jira (BUG-007 clôturé/faux positif, BUG-010/BUG-011 résolus → colonne appropriée).

---

**Erreurs rencontrées & Solutions (suite)**

| Date | Symptôme (message exact) | Cause | Solution |
|---|---|---|---|
| 2026-07-23 | Lien `javascript:` apparemment persisté dans l'onglet Elements après collage+rechargement | Aucune — texte HTML échappé (`&lt;a href=...&gt;`) mal interprété visuellement, coloration syntaxique de Chrome ressemblant à un vrai élément imbriqué | Aucun correctif : vérifié via `querySelector('a')` (`null`), `outerHTML` (entités échappées), `textContent` (texte littéral) — bogue retiré |
| 2026-07-23 | Image uploadée avec succès mais jamais affichée (texte alternatif à la place), `Location: http://minio:9000/...` | URL présignée MinIO construite avec l'endpoint interne (`env.S3_ENDPOINT`), jamais résolvable par le navigateur | `src/app/api/media/[imageId]/route.ts` proxy désormais le binaire (fetch serveur + stream) au lieu de rediriger — ADR-0023 |
| 2026-07-23 | `{"ok":false,"error":"Envoi impossible pour le moment."}` (upload image valide) | Bucket MinIO jamais provisionné sur staging (ni prod) | Service one-shot `minio-setup` ajouté à `compose.staging.yml`/`compose.prod.yml`, idempotent, dont dépendent désormais `app`/`worker`/`backup` |

Note finale : tout le travail de cette journée (recette + corrections) a été committé et
poussé par Aymeric ; CI verte confirmée. Rien n'est en attente de commit à ce stade.

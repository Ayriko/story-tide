# Story Tide — Spécification technique Bloc 2

> Document de référence pour le développement (Bloc 2, RNCP39583).
> Rédigé le 2026-07-03, après revue complète du dev-log, du dossier Bloc 1 (figé), du référentiel Bloc 2 (RFRENT p.7-10) et de la grille d'évaluation.
> **Date de rendu ferme : 24 juillet 2026.** Livrable = code source + dossier écrit 30 pages max.
> Toute décision ci-dessous est **actée avec Aymeric le 2026-07-03**, sauf mention contraire.

---

## 1. Cadre certification — ce que le code doit prouver

**4 compétences ÉLIMINATOIRES** (Fiche récapitulative) :

| Compétence | Exigence clé | Preuve dans le projet |
|---|---|---|
| **C2.2.1** Prototype / architecture | Archi structurée maintenable · framework & paradigmes · prototype fonctionnel (fonctionnalités principales + user stories) · composants d'interface · exigences de sécurité | Monolithe Next.js en couches + worker · patrons nommés (ports & adapters, repository via Prisma) · app déployée et manipulable |
| **C2.2.2** Tests unitaires | « couvrent la majorité du code développé » | Vitest + seuil de couverture bloquant en CI |
| **C2.2.3** Sécurité + accessibilité | 10 failles OWASP couvertes · référentiel d'accessibilité présenté et justifié (RGAA) | Mapping OWASP documenté au fil de l'eau + audit RGAA/axe-core |
| **C2.3.1** Cahier de recettes | Toutes les fonctionnalités attendues · tests fonctionnels/structurels/sécurité conformes au plan | Cahier dérivé des user stories MoSCoW du Bloc 1 |

Non éliminatoires mais notées : **C2.1.1/C2.1.2** (protocoles de déploiement et d'intégration continue explicités), **C2.2.4** (gestion de versions, évolutions tracées, logiciel manipulable en autonomie), **C2.3.2** (plan de correction des bogues), **C2.4.1** (manuels déploiement/utilisation/mise à jour + **justification des choix technos** — la matière existe déjà dans le dev-log).

**Posture d'architecture assumée** (actée 2026-07-02) : *l'architecture la plus simple qui couvre le besoin, justifiée*. Pas de microservices. La complexité non nécessaire est un défaut, pas une qualité.

---

## 2. Périmètre du livrable au 24 juillet (ACTÉ)

**Inclus — cœur + graphe obligatoire :**

1. Authentification (inscription, connexion, session, déconnexion)
2. Mondes (création, liste, paramètres de base)
3. CRUD entités (personnage, lieu, faction, objet, événement — type = donnée, pas schéma) avec **alias** dès la v1
4. Éditeur Tiptap (titres, listes, gras/italique, citations, liens, images) avec sauvegarde JSON ProseMirror + auto-save debouncé
5. **Liaison automatique Aho-Corasick** (différenciateur) : détection serveur asynchrone, surlignage dans l'éditeur, relations `origin=AUTO`, mentions manuelles `@` (**Fait**, KAN-22, cf. §4.4 point 5 / ADR-0011), garde-fous ignorer/délier une relation AUTO (**Fait**, KAN-23, `TST-LNK-007`) — le marquage « ambigu » cliquable pour trancher une homonymie reste hors périmètre (backlog KAN-19, modèle de données dédié requis)
6. Backlinks sur chaque fiche. **Fait** (KAN-24, `listIncomingLinks`, section « Mentionné par », cf. §4.4 point 5)
7. **Graphe de relations** (Cytoscape.js) : vue interactive, filtrage par type, navigation cliquable. **Fait** (KAN-25, décision 2026-07-17, ADR-0012)
8. Recherche basique dans les entités d'un monde
9. Limites du tier gratuit (freemium structurel : quotas mondes/entités) — **sans Stripe** (P2, inchangé)

**Explicitement HORS livrable S30** (continuent d'exister au backlog, démo Bloc 3 possible) : cartes interactives, timelines, whiteboards, import/export, pomodoro/audio/scratchpad, templates de fiches, secrets par rôle, wiki public partageable, Electron, collaboration.

**Cible équipement (C2.2.1)** : web desktop-first ; responsive mobile différé et **documenté comme choix** (cohérent avec la décision artwork du 2026-06-22).

---

## 3. Stack technique (ACTÉE — continuité C1.3.2)

| Couche | Choix | Justification courte (détail : dev-log) |
|---|---|---|
| Langage | **TypeScript strict** (tout le stack) | Sûreté de bout en bout, choix Bloc 1 |
| Framework | **Next.js** (App Router, RSC, Server Actions) — full-stack, PAS de backend séparé | 1 service = 1 image = 1 déploiement ; RSC lisent Prisma en direct ; arbitrage complet vs NestJS tracé le 2026-07-02 |
| API interne | **Server Actions + Zod** aux frontières. **Pas de tRPC** | La sûreté par construction du full-Next rend tRPC redondant |
| UI | **Tailwind CSS**, dark mode de base | Choix Bloc 1 ; layout login = artwork 16:9 + panneau tiers droit |
| Éditeur | **Tiptap pur** (headless, MIT self-hosted) | ACTÉ 2026-07-02 : UI alignée sur les logiciels de référence, pas de paradigme blocs-Notion à défaire ; continuité C1.3.2 |
| Graphe | **Cytoscape.js** | Choix contexte projet ; MIT |
| BDD | **PostgreSQL** (image officielle, version LTS courante) | Choix Bloc 1 |
| ORM | **Prisma** | Arbitré vs Drizzle (dev-log 2026-06-05) ; serverful → pas de reproche cold-start |
| Auth | **Better Auth** (email + mot de passe, sessions en base, adapter Prisma) | ACTÉ 2026-07-03 : TS-first, conçu pour credentials self-hosted (là où Auth.js les décourage). Vérifier licence/état à jour au moment de l'installation (réflexe C1.3.2) |
| Jobs async | **pg-boss** derrière une **interface d'abstraction `JobQueue`** (ports & adapters) | ACTÉ 2026-07-03 : queue sur PostgreSQL, zéro conteneur en plus, ACID, singleton keys (1 job de liaison en attente par fiche). Migration BullMQ = réécrire l'adaptateur seul → point d'extension documenté (C2.2.1) |
| Moteur de liaison | **Aho-Corasick implémenté maison** (TS pur, ~150-250 lignes) | ACTÉ 2026-07-03 : possession du différenciateur face au jury, module de tests unitaires idéal, story perf complète (compilation, cache, invalidation) |
| Stockage binaires | **MinIO** (S3-compatible) via SDK S3 — buckets privés, URLs signées | Choix Bloc 1 ; abstraction S3 → OVH Object Storage en évolution |
| Validation | **Zod** à chaque frontière (actions, uploads, env vars) | OWASP A03 ; contrat runtime |
| Tests | **Vitest** + Testing Library (unit/composants) · **Playwright** (poignée de smoke e2e) | C2.2.2 / appui C2.3.1 |
| Conteneurisation | **Docker + Compose** (Dockerfile multi-stage, image `node:*-slim`, user non-root) | Choix Bloc 1 |
| Reverse proxy | **Traefik** + Let's Encrypt | Choix Bloc 1 |
| CI/CD | **GitHub Actions** → build → **ghcr.io** → déclenchement **SSH** → `docker compose pull && up -d` sur le VPS | ACTÉ 2026-07-02 ; le VPS ne build jamais |
| Hébergement | **OVH VPS-3 gamme 2027** (6 vCore, 12 Go, 100 Go NVMe, ~150 €/an), GRA/SBG | ACTÉ 2026-07-02 ; commande ~mi-juillet |
| Plus tard (post-S30) | TanStack Query (auto-save, graphe, optimistic updates), TanStack Virtual | Takeaway session 2026-07-02, non requis au MVP |

---

## 4. Architecture applicative

### 4.1 Conteneurs (conforme au C4 niveau 2 du Bloc 1 — 5 conteneurs)

```
[Traefik TLS] → [App Next.js] ⇄ [PostgreSQL]  (données + queue pg-boss)
                     ⇅ (S3 API)      ⇡ jobs
                  [MinIO]        [Worker Node]  ← moteur Aho-Corasick
```

- **App Next.js** : front + Server Actions + RSC. Enfile les jobs de liaison (debounce à la sauvegarde).
- **Worker** : petit process Node séparé (même repo, entrée `src/worker/index.ts`, propre stage Docker) qui consomme pg-boss et exécute le moteur de liaison. Partage le code de `src/lib/` et le client Prisma.
- **PostgreSQL** : données + schéma `pgboss`. Un seul système stateful à sauvegarder.
- **MinIO** : images uploadées par les utilisateurs uniquement (les assets de marque restent dans `/public` via `next/image`).
- **Point d'extension OVH (KAN-11, fait)** : le port `Storage` (`src/lib/storage/types.ts`) n'expose que `upload`/`delete`/`getSignedUrl` — les services ne connaissent jamais le SDK S3. `S3StorageAdapter` (`src/lib/storage/s3-adapter.ts`) implémente ce port avec `@aws-sdk/client-s3` (`forcePathStyle: true`, requis par MinIO). Basculer vers **OVH Object Storage** (S3-compatible) se limite à changer `endpoint`/`region`/les identifiants passés à l'adaptateur (`src/env.ts`) — aucun service ni action à modifier. La **validation MIME/magic-bytes** (OWASP A10) relève du futur service d'upload (KAN-16), pas de ce port infra volontairement minimal.

### 4.2 Couches internes (C2.2.1 — maintenabilité)

```
app/            → routes, layouts, RSC, composants (UI seulement)
src/actions/    → Server Actions : frontière Zod + session → appellent les services
src/services/   → logique métier + AUTORISATION (chaque service vérifie l'accès au monde)
src/db/         → client Prisma, requêtes
src/lib/linker/ → moteur Aho-Corasick (TS pur, zéro dépendance — testable isolément)
src/lib/queue/  → interface JobQueue + adaptateur pg-boss (+ fake mémoire pour les tests)
src/lib/storage/→ interface Storage + adaptateur S3/MinIO
src/worker/     → point d'entrée du worker
```

Règles : l'UI n'importe jamais Prisma ; les services ne connaissent ni pg-boss ni le SDK S3 (interfaces seulement) ; **toute** entrée externe passe par un schéma Zod ; l'autorisation vit dans les services, jamais seulement dans l'UI (OWASP A01).

### 4.3 Modèle de données v1 (Prisma — esquisse)

```prisma
model World   { id, name, slug, ownerId, createdAt, updatedAt, entities[] }
model Entity  {
  id, worldId, name, type            // type: String ("character"|"place"|...) — donnée, pas schéma
  aliases     String[]               // ⚠ dès la v1 : surnoms/titres, dictionnaire de l'automate
  content     Json                   // JSON ProseMirror (Tiptap)
  plainText   String                 // texte extrait, pour le scan + la recherche
  createdAt, updatedAt
}
model Relation {
  id, worldId, sourceId, targetId
  origin      RelationOrigin         // MANUAL | AUTO — ne jamais écraser MANUAL lors des re-scans
  createdAt
  @@unique([sourceId, targetId, origin])
}
model LinkIgnore { id, worldId, entityId, targetId }  // "ne plus lier X vers Y" (garde-fou UX)
// + tables Better Auth (user, session, account) générées par son CLI
```

### 4.4 Moteur de liaison automatique (design)

1. **Dictionnaire** = noms + alias de toutes les entités du monde (normalisés : casse, accents ; les deux formes conservées pour l'affichage). **Fait** (`buildDictionary`, `src/services/linker-service.ts`).
2. **Automate compilé et mis en cache par monde** (Map en mémoire du worker + version en base) ; **invalidation** à toute création/renommage/suppression d'entité ou d'alias. **Reporté (décision 2026-07-15)** : l'automate est reconstruit à chaque job pour l'instant (le test de passage à l'échelle du moteur — 200 entités × ~100 000 caractères — tourne en 15 ms, largement dans le budget perf). Le cache/invalidation devient une étape perf séparée, à faire seulement si un besoin réel se confirme (pas de complexité spéculative).
3. Déclenchement : sauvegarde de fiche → `queue.enqueue('entity-linking', { worldId, entityId }, { singletonKey: entityId })`. **Fait** (`saveEntityContentAction`, échec d'enfilage loggué sans faire échouer la sauvegarde).
4. Scan du `plainText` : matches en un passage (O(n)), **plus long match prioritaire**, frontières de mots respectées, auto-mention exclue, `LinkIgnore` filtré. **Fait** (`scanAndLinkEntity`).
5. Écriture : upsert des `Relation origin=AUTO` (diff : ajouts/suppressions) — **jamais `MANUAL`, vérifié en conditions réelles**. **Fait.** Positions des occurrences renvoyées au client pour le **surlignage** (décorations ProseMirror) : **Fait (décision 2026-07-16, ADR-0010)** — pas un round-trip serveur des positions : re-scan LIVE côté client (même moteur `AhoCorasick`, dictionnaire chargé une fois par la page), remappées vers des positions ProseMirror réelles (`src/lib/tiptap-positions.ts`, alignement caractère-exact vérifié contre `extractPlainText`). Navigation par Ctrl/Cmd+clic sur la mention (souris) ou par la liste accessible « Entités liées » sous l'éditeur (clavier/lecteur d'écran, alimentée par les vraies `Relation` en base). Vérifié en conditions réelles (`e2e/link-highlight.spec.ts`). **Backlinks (point 6, KAN-24) : Fait** — `listIncomingLinks` résout le sens entrant (symétrique de `listOutgoingLinks`), affiché sous une section « Mentionné par » distincte (même composant `LinkedEntities` généralisé). **Mentions manuelles `@` (KAN-22) : Fait (décision 2026-07-17, ADR-0011)** — node `mention` partagé serveur/client (`@tiptap/extension-mention`), popup de suggestion (Floating UI intégré, pas de tippy.js), réconciliation **synchrone** des `Relation origin=MANUAL` à la sauvegarde (`reconcileManualMentions`), coexistant sans collision avec les `Relation AUTO` (`@@unique([sourceId, targetId, origin])`). Vérifié en conditions réelles (`e2e/manual-mention.spec.ts`).
6. Homonymes : si deux entités matchent la même occurrence → pas de lien silencieux. **Fait partiellement (décision 2026-07-15)** : aucune relation n'est créée pour l'occurrence ambiguë (ni pour l'une ni pour l'autre entité). Le marquage « ambigu » cliquable pour trancher reste **backlog KAN-19** — nécessite un modèle de données dédié (aucun état "ambigu" dans le schéma actuel) et une UI de résolution, hors périmètre de cette session.
7. Perf (parade risque principal C1.2.3) : jobs async + index PG déjà en place ; automate caché = perf différée (point 2). Si goulet un jour : worker scalé indépendamment — jamais de microservices.

---

## 5. Sécurité — mapping OWASP Top 10 (C2.2.3, élim.)

À tenir dans `/docs/securite-owasp.md` **au fil du développement** (chaque mesure notée quand elle est codée) :

| Faille | Mesures Story Tide |
|---|---|
| A01 Broken Access Control | Autorisation systématique en couche service (appartenance au monde vérifiée à chaque action) ; pas d'IDs devinables exposés sans contrôle ; tests unitaires dédiés authz |
| A02 Cryptographic Failures | TLS bout en bout (Traefik/Let's Encrypt) ; hash de mots de passe géré par Better Auth (scrypt/argon2 — vérifier sa conf par défaut) ; secrets via env, jamais en repo |
| A03 Injection | Prisma (requêtes paramétrées) ; Zod sur toute entrée ; aucune concaténation SQL ; sanitisation du HTML rendu depuis le JSON Tiptap (schéma de nodes strict) |
| A04 Insecure Design | Quotas freemium = limites anti-abus ; rate limiting sur login/register et sur les actions coûteuses |
| A05 Security Misconfiguration | Headers (CSP, X-Frame-Options, Referrer-Policy…) via middleware ; conteneurs non-root ; ports non exposés hors Traefik ; MinIO et PG jamais publics |
| A06 Vulnerable Components | Dependabot + `npm audit` en CI ; lockfile commité |
| A07 Auth Failures | Sessions en base (révocables), cookies HttpOnly/Secure/SameSite ; verrouillage/ralentissement après échecs |
| A08 Integrity Failures | CI = seule source des images ; provenance ghcr ; lockfile |
| A09 Logging Failures | Logs structurés (pino) : auth, échecs authz, erreurs worker ; pas de données sensibles en logs |
| A10 SSRF | Aucun fetch d'URL fournie par l'utilisateur au MVP ; uploads : validation MIME réelle (magic bytes), taille max, URLs signées à expiration |

RGPD (fil rouge Bloc 1) : minimisation, suppression de compte = purge monde + binaires, pas d'exploitation du contenu.

---

## 6. Accessibilité — RGAA (C2.2.3, élim.)

**Référentiel choisi : RGAA** (justification : référentiel officiel français, aligné WCAG, déjà introduit au Bloc 1 — continuité). À documenter dans `/docs/accessibilite-rgaa.md`, structuré en **3 volets** (pattern repris d'un dossier Bloc 2 validé) :

1. **Fonctionnelle / parcours** : toutes les actions principales accessibles sans souris (créer une fiche, écrire, naviguer le graphe), pages structurées (H1-H3, landmarks), messages d'erreur clairs et confirmations d'action.
2. **Technique** : navigation clavier complète (éditeur inclus — Tiptap le permet), focus visible, contrastes ≥ 4.5:1 (vérifier le thème sombre), labels sur tous les champs, ARIA en complément des éléments natifs, `alt` porteurs de sens (artwork décoratif = `alt=""`), erreurs reliées aux champs (`aria-describedby`), pas d'info portée par la couleur seule (pastilles + texte).
3. **Contenu créé par l'utilisateur** : texte alternatif demandé à l'upload d'image, structure des fiches (headings du JSON Tiptap) restituée sémantiquement au rendu, liens auto-détectés annoncés correctement au lecteur d'écran.

Outillage (à tracer dans le dossier) : **axe-core en CI** (via Playwright) · **Ara** (outil d'audit RGAA officiel — audit manuel tracé avant le rendu) · **Lighthouse** · vérification manuelle clavier (Tab/Entrée/Échap) · un passage **NVDA** sur les parcours clés.

---

## 7. Tests (C2.2.2, élim.)

- **Vitest** : moteur Aho-Corasick (cas limites : chevauchements, accents, alias, frontières de mots, homonymes), services (authz, quotas, CRUD), schémas Zod, adaptateur queue (contre le fake mémoire).
- **Testing Library** : composants clés (formulaires auth, carte entité, contrôles éditeur).
- **Seuil de couverture bloquant en CI** — cible ≥ 80 % sur `src/lib` + `src/services` (le critère dit « la majorité du code » ; viser large sur le cœur, tolérer moins sur l'UI). **Rapport de couverture publié en artefact de pipeline + commentaire automatique de PR** = preuve directe pour le dossier.
- **Playwright** : 3-5 parcours smoke (inscription→création monde→création fiche→liaison auto visible→graphe). Sert aussi de preuve d'exécution du cahier de recettes.
- Règle d'or : **les tests s'écrivent avec la feature, jamais après**. Une PR sans tests sur la logique qu'elle introduit n'est pas mergeable.

---

## 8. Cahier de recettes (C2.3.1, élim.) & plan de correction (C2.3.2)

- `/docs/cahier-de-recettes.md` : scénarios **dérivés des user stories MoSCoW du Bloc 1** (continuité traçable).
- **Nomenclature** (reprise d'un dossier Bloc 2 validé) : `TST-<CAT>-<NNN>` avec catégories **AUT** (authentification) · **MND** (mondes) · **ENT** (entités/éditeur) · **LNK** (liaison auto/backlinks) · **GRF** (graphe) · **SEC** (sécurité) · **QOT** (quotas freemium).
- **6 champs par scénario** : Description · Objectif · Préconditions · Étapes de test · Résultat attendu · Critères d'acceptation. Mêler cas passants **et** cas d'échec attendus.
- Scénarios **sécurité dédiés** obligatoires (ex. `TST-SEC-001` : accès URL directe à un monde d'autrui → 403/redirection ; `TST-SEC-002` : upload d'un faux MIME → rejet) et **structurels** (worker down → job repris ; re-scan n'écrase jamais un lien MANUAL).
- `/docs/plan-correction-bogues.md` : chaque anomalie = ID · gravité · analyse · correction · re-test. Alimenté par les issues GitHub (labels `bug`).
- **Priorisation avec SLA (adapté solo)** : **P0** (bloquant : perte de données, faille, prod down) corrigé sous 24 h · **P1** (fonctionnalité majeure dégradée) sous 72 h · **P2** planifié au jalon suivant. Processus tracé : détection → qualification (description, impact, reproduction) → priorisation → diagnostic → correctif **+ test unitaire de non-régression** → recette → déploiement.

---

## 9. Environnements, CI/CD & déploiement (C2.1.1 / C2.1.2)

### 9.1 Trois environnements (ACTÉ 2026-07-03)

| Env | Où | Rôle | Versions |
|---|---|---|---|
| **Développement** | Local (compose dev : PG + MinIO, app hors conteneur, hot reload) | Cycle rapide, fixtures reproductibles (seed) | branches `feat/*` |
| **Staging (préproduction)** | **Même VPS**, 2ᵉ stack compose, sous-domaine `staging.*` via Traefik | Recette réelle avant prod (cahier de recettes exécuté ici), données de test | images **`X.Y.Z-rc.N`** |
| **Production** | VPS, stack principale | Utilisateurs finaux | images **`X.Y.Z`** (SemVer, tags annotés) |

Le VPS-3 (12 Go) encaisse les deux stacks sans peine ; PG et MinIO de staging sont des instances séparées (jamais les données de prod).

### 9.2 Critères de qualité & performance chiffrés (critère explicite C2.1.1)

Seuils cibles, mesurés et tracés (valeurs de départ, ajustables avec justification) :

- **Latence p95 des actions API < 500 ms** (hors scan de liaison, asynchrone par design) — le p95 est déjà le vocabulaire du Bloc 1.
- **Liaison automatique visible < 5 s** après la fin du debounce de sauvegarde (parade mesurable du risque principal C1.2.3).
- **Taux d'erreur applicative < 1 %** sur fenêtre glissante.
- **Lint bloquant à 0 warning** (`--max-warnings=0`) sur 100 % des PRs ; **couverture ≥ 80 %** sur le cœur (cf. §7).
- Disponibilité : healthcheck + uptime monitoring simple (pas de SLO contractuel au MVP — assumé et documenté).

### 9.3 Pipeline

> **KAN-10 (2026-07-18)** : chaîne CD câblée côté repo — `.github/workflows/cd.yml`,
> `deploy/` (Traefik, compose prod/staging, backups), ADR-0013,
> `docs/cd.md`, `docs/manuels/deploiement.md`. **Reste à exécuter par
> Aymeric sur le VPS** : bring-up Traefik, GitHub Environments, premier tag
> `-rc` puis prod (voir `docs/manuels/deploiement.md`) — ne pas marquer
> **Fait** avant `staging.storytide.fr`/`storytide.fr` réellement en ligne en
> HTTPS (`TST-SEC-009` à `TST-SEC-012`).

Pipeline GitHub Actions (protocoles documentés dans `/docs/cd.md` et `/docs/manuels/deploiement.md`) :

1. **CI (toute PR)** : install (cache) → lint (ESLint + Prettier check, 0 warning) → typecheck (`tsc --noEmit`) → tests + couverture (seuil bloquant, rapport en artefact + commentaire de PR) → build Next.
2. **CD** : tag `vX.Y.Z-rc.N` → image `-rc` → déploiement **staging** ; tag `vX.Y.Z` (posé après recette OK, gaté par un GitHub Environment `production` à approbation manuelle) → déploiement **production**. Build image multi-stage (4 cibles : app/worker/migrate/backup) → push `ghcr.io` (public) → SSH vers le VPS → `docker compose pull && docker compose up -d --wait` → healthcheck.
3. Secrets GitHub : clé SSH de déploiement dédiée (restreinte), host — déjà posés (`VPS_HOST`/`VPS_USER`/`VPS_SSH_KEY`) ; pas de token ghcr (packages publics).
4. Compose **dev** ≠ compose **staging** ≠ compose **prod** (staging/prod quasi identiques — seuls domaine, secrets et tag d'image changent ; deux fichiers séparés auto-contenus, cf. ADR-0013).
5. **Husky** : hook pre-commit léger (`lint-staged` : ESLint --fix + Prettier sur fichiers stagés, puis `tsc --noEmit` sur tout le projet) — le filet local avant la CI.

**VPS** : OVH VPS-3 2027, GRA. Ordre strict : SSH clé-only + firewall (ufw) + fail2ban → Docker → Traefik/Let's Encrypt → premier déploiement pipeline (staging d'abord) — état serveur posé le 2026-07-18, détaillé dans `docs/manuels/deploiement.md`. Sauvegardes : `pg_dump` quotidien + miroir MinIO (cron conteneurisé, `deploy/backup/`), rétention 7 j.

---

## 10. Git & traçabilité (C2.2.4 + narratif Bloc 3)

- **Règle de fonctionnement avec Claude Code : Aymeric garde la main sur Git.** L'agent prépare (fichiers à stager, message conventionnel prêt à copier, commande exacte) mais n'exécute jamais commit/push/merge/tag — c'est Aymeric qui lance les commandes. Lecture (`status`/`diff`/`log`) autorisée.
- **Conventional commits** (`feat:`, `fix:`, `test:`, `docs:`, `chore:`…) ; branches `feat/…` courtes ; **PR systématiques auto-relues** (description = quoi/pourquoi/preuve de test) même en solo — c'est la parade « gestion d'équipe en solo » du Bloc 3.
- Tags **annotés** `vX.Y.Z` / `vX.Y.Z-rc.N` à chaque jalon ; **CHANGELOG.md format Keep a Changelog** (rubriques Ajouté / Modifié / Corrigé / Supprimé, une entrée par version datée) ; issues GitHub = backlog vivant (labels par lot MoSCoW).
- **ADRs** dans `/docs/adr/` (une décision = un fichier) : le dev-log en fournit déjà une douzaine (full Next.js, Tiptap, pg-boss, Better Auth, AC maison…) → matière directe pour C2.4.1.

---

## 11. Documentation (C2.4.1) & dossier 30 pages

Docs-as-code dans `/docs/` du repo, rédigés **en même temps** que le code : manuel de déploiement · manuel d'utilisation · manuel de mise à jour · protocoles CI/CD · mapping OWASP · dossier RGAA · cahier de recettes · ADRs.
Le **dossier 30 pages** est l'assemblage éditorialisé de ces briques + architecture (réutiliser/adapter le C4 du Bloc 1) + justification des choix technos (critère explicite C2.4.1 — le raisonnement full-Next/Tiptap/pg-boss est déjà écrit). **Commencer le squelette du dossier en semaine 1, pas en semaine 3.**

**Plan du dossier = la grille** (pattern confirmé par un dossier Bloc 2 validé) : page de garde → table des matières → Contexte (1 p.) → une section par compétence **dans l'ordre C2.1.1 → C2.4.1, intitulé officiel en titre de section** → l'évaluateur coche sa grille en lisant. Le fil sobriété/environnement (absent du dossier de référence) se glisse dans C2.2.1 (archi) et C2.4.1 (choix) = différenciateur.

**Kit jury** (à documenter dans le README + dossier) : URL de production **et** de staging · **compte de démonstration** pré-provisionné avec un monde de démo peuplé (seed : entités, alias, liens auto visibles, graphe parlant) · lancement local en 3 commandes avec `.env.example` complet — **jamais de secrets réels en clair dans le repo**.

---

## 12. Planning cible (3-24 juillet)

| Jours | Objectif | Éliminatoires servies |
|---|---|---|
| 3-6 juil. | Scaffold : repo, Next+TS+Tailwind+ESLint/Prettier, compose dev (PG+MinIO), Prisma schéma v1, CI lint/typecheck/test, Better Auth, squelette `/docs` + dossier | C2.1.2, C2.2.1, C2.2.3 (fondations) |
| 7-10 juil. | Mondes + CRUD entités (+ aliases) + navigation + recherche basique + éditeur Tiptap (save JSON + plainText, debounce) | C2.2.1, C2.2.2 au fil de l'eau |
| 11-15 juil. | Moteur AC maison (TDD) + interface queue + adaptateur pg-boss + worker + relations AUTO + surlignage + backlinks + garde-fous (ignore/homonymes). **Commander le VPS.** | C2.2.1, C2.2.2 (gros bloc) |
| 16-18 juil. | Graphe Cytoscape (vue, filtres, navigation) + quotas freemium | C2.2.1 |
| 17-20 juil. | VPS : hardening → Traefik → CD complet → **staging** (`-rc`) puis prod en ligne. Smoke Playwright + axe-core | C2.1.1, C2.2.3, C2.2.4 |
| 20-23 juil. | Recette complète **sur staging** (cahier TST-* exécuté, bogues traités selon SLA), seed/compte démo jury, audit Ara/NVDA tracé, gel du code, finalisation dossier 30 p. | C2.3.1, C2.3.2, C2.4.1 |
| 24 juil. | **Dépôt.** | — |

Buffer réel ≈ 2 jours. Si dérapage : le graphe passe en version minimale (vue simple sans filtres) **avant** de toucher aux tests ou à la sécurité — les éliminatoires ne se négocient pas.

---

## 13. Skills Claude Code — recommandations

Rappel des deux garde-fous de `note-skills-en-reserve.md` : auditer tout skill tiers avant activation (chaîne d'approvisionnement) ; les skills sont des échafaudages, le code doit rester maîtrisé pour l'oral.

**À forte valeur pour ce projet (par priorité) :**

1. **Revue de sécurité** — un skill type `security-review` / audit OWASP (il en existe un officiel dans Claude Code : `/security-review`). Sert directement C2.2.3 à chaque PR.
2. **Tests & TDD** — skill de génération/renforcement de harnais de tests (domaines à chercher : « TDD », « vitest », « test coverage »). Sert C2.2.2.
3. **Accessibilité** — skill d'audit a11y/WCAG-RGAA des composants React (chercher : « accessibility », « a11y », « axe »). Sert C2.2.3.
4. **CI/CD GitHub Actions** — scaffolding et durcissement de workflows (chercher : « github actions », « docker pipeline »). Sert C2.1.1/C2.1.2.
5. **Prisma / schéma de données** — design et migrations propres (chercher : « prisma », « database schema », « migrations »).
6. **Documentation d'exploitation** — génération de runbooks/manuels depuis le code (chercher : « runbook », « onboarding », « technical writing »). Sert C2.4.1 et la parade Bloc 3.
7. **(À créer soi-même, optionnel)** un skill maison `story-tide-conventions` : tes règles de couches, Zod aux frontières, conventions de commit, definition of done — pour que chaque session Claude Code reparte avec les mêmes réflexes. Un `CLAUDE.md` bien tenu couvre déjà 90 % de ce besoin (voir fichier prompt).

**Peu utiles maintenant** : skills e2e lourds type `playwright-pro` (5 smoke tests suffisent), observabilité avancée (Bloc 4), dependency-auditor complet (Dependabot suffit ; à rouvrir au Bloc 4).

---

## 14. Points en attente (hors périmètre S30, à ne pas perdre)

- Modèle de **break-even paramétrable** (retour jury Bloc 1) — utile pour le dossier ou l'oral Bloc 3.
- Intégration de l'**artwork** de l'artiste (login) dès réception : `/public`, `next/image`, `alt=""`, scrim.
- TanStack Query pour l'auto-save et le graphe (post-S30).
- Bloc 4 (maintenance, août) : la structure logs/backups/monitoring posée ici en est le socle.
- **Smoke Playwright minimal** : **fait en local** (2026-07-15, branche `feat/e2e-smoke`).
  `e2e/smoke.spec.ts` — inscription (auto-login) → créer un monde → créer une fiche →
  écrire dans l'éditeur, sélectionner, mettre en gras (vérifie la toolbar synchronisée,
  `useEditorState`) → attendre l'auto-save → recharger la fiche (vérifie la persistance
  à travers la frontière RSC → Client). Couvre les 3 classes de bugs invisibles par
  `curl`/script `tsx` rencontrées le 12-14/07 (StrictMode, sérialisation Next.js Flight,
  Tailwind Preflight — cf. `.claude/skills/rsc-boundary-plain-json/` et
  `.claude/skills/headless-editor-tailwind-preflight/`). Isolation : base Postgres dédiée
  `story_tide_e2e` (même conteneur dev, `docker-compose.dev.yml`), remise à zéro
  (`DROP/CREATE SCHEMA` + `prisma migrate deploy`) avant chaque run via
  `e2e/global-setup.ts` — la base de dev n'est jamais ouverte (vérifié : comptage de
  lignes identique avant/après un run). `next dev` comme serveur (webServer Playwright)
  pour reproduire StrictMode. **Câblage CI : fait (2026-07-17, KAN-34)** — job `e2e`
  dédié dans `.github/workflows/ci.yml` (service `postgres:16`, installation des
  navigateurs Chromium, artefact `test-results/` en cas d'échec) ; voir `docs/ci.md`.
  **Reste à faire** : audit axe-core pleine page (reporté depuis plusieurs sessions,
  cf. §6), débloqué mais pas encore fait.

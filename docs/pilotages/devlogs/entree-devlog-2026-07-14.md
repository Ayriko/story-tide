### Session — 2026-07-14 — Bloc A (Mondes, Entités, Éditeur Tiptap + auto-save)

**Thèmes abordés :**
- Étape 1 : CRUD Mondes — première brique de `src/services/`, pattern d'autorisation par `ownerId`.
- Étape 2 : CRUD Entités — autorisation **en cascade** (réutilise `getWorld`), type en donnée libre, alias.
- Étape 3 : Éditeur Tiptap + auto-save — schéma de nodes strict, validation serveur, extraction `plainText`.
- Correction rétroactive : accents français dans les textes UI (auth + mondes + entités), décidée par Aymeric.
- 4 tours de correction réelle sur l'éditeur Tiptap suite à des tests manuels d'Aymeric (voir gotchas).
- Clôture : décision de la prochaine orientation **reportée** par Aymeric à la session suivante.

**Décisions prises :**
- **Données d'abord** (Mondes → Entités → Éditeur) avant le moteur de liaison (Bloc B) — le linker dépend du CRUD (dictionnaire = `name`+`aliases[]`, scan = `plainText`) ; tranché par Aymeric en tout début de session (AskUserQuestion).
- **Slug dérivé automatiquement du nom** (jamais saisi), collision gérée par suffixe (`-2`, `-3`…) — cohérent avec Mondes ET réutilisable tel quel.
- **Autorisation en cascade entre services** : `entity-service.ts` réutilise `getWorld()` de `world-service.ts` plutôt que de dupliquer la vérification d'appartenance — patron à reproduire pour toute ressource imbriquée dans un monde (relations, futur graphe).
- **Validation du contenu Tiptap via le vrai schéma ProseMirror** (`Node.fromJSON` + `check()`), pas un schéma Zod fait main pour l'AST récursif — un seul point de vérité entre client et serveur, formalisé en ADR-0009.
- **Accents français réels dans tout le texte UI** (auth + mondes + entités), rétroactif — l'absence d'accents était un réflexe hérité des commentaires de code (raison d'encodage réelle, non pertinente pour du texte affiché à l'utilisateur) ; tranché par Aymeric (AskUserQuestion) après qu'il ait demandé si ce serait corrigé.
- **Confirmation en 2 étapes** pour toute suppression (monde, entité) — pas de `window.confirm` bloquant, cohérent entre les deux features.
- Image insérée **par URL** en attendant l'étape upload (Storage) — texte alternatif rendu obligatoire dès maintenant (RGAA volet 3), pas différé.

**Éléments notables / appris (gotchas) :**
Le bloc le plus dense de la session : 4 tours de bug réels sur l'éditeur, trouvés par les tests manuels d'Aymeric (l'extension Chrome de pilotage était de nouveau en panne, impossible de les reproduire moi-même en direct — vérifications faites via scripts `tsx` contre la vraie base + `curl` + lecture du log réel du serveur dev).

1. **Toolbar « active » qui ne se met pas à jour immédiatement, tout sauf gras/italique semblait ne rien faire.** Cause réelle (double) :
   - `src/lib/tiptap-extensions.ts` exportait un **tableau d'extensions singleton** créé une fois au chargement du module. React StrictMode (actif par défaut en dev) monte/démonte/remonte chaque composant une fois ; réutiliser les mêmes instances d'extension entre deux cycles de vie d'`Editor` corrompt les commandes liées au schéma (titre, listes, citation) — piège Tiptap+React documenté. **Corrigé** : `editorExtensions` (const) → `createEditorExtensions()` (fabrique, nouvelles instances à chaque appel), appelée directement dans `useEditor()`.
   - Distinct du précédent : `editor.isActive(...)` est appelé dans le JSX du toolbar, mais **rien n'abonne React aux transactions de l'éditeur** — le formatage s'applique réellement tout de suite (vue ProseMirror interne, indépendante de React) mais le bouton ne se re-rend que si un state React change pour une autre raison (ici le debounce de sauvegarde, 1,5 s plus tard). **Corrigé** avec `useEditorState` (hook `@tiptap/react`), sélecteur centralisé recalculé à chaque transaction.
2. **`Error: Cannot access level on the server. You cannot dot into a temporary client reference from a server component.`** — message trompeur (mentionne "level", l'attribut du node `heading`) qui n'a rien à voir avec ProseMirror : c'est une erreur de **sérialisation Next.js Server Actions (React Flight)**. `saveEntityContentAction` est appelée directement comme fonction depuis le client (pas via `<form>`) ; passer l'arbre JSON imbriqué de Tiptap en argument positionnel brut heurte un cas limite de Flight qui traite une partie de l'objet comme une « référence temporaire » non résolue. **Corrigé** : `JSON.stringify(content)` côté client avant l'appel, `JSON.parse()` en premier côté serveur — une chaîne traverse toujours la frontière comme donnée déjà résolue.
3. **`parseContent` avalait silencieusement l'erreur réelle** (`catch { throw new InvalidContentError() }`), rendant le point 2 quasi indiagnosticable sans capture d'écran. **Corrigé** : `console.error` du message réel avant de relever l'erreur typée — a permis d'obtenir le vrai message du point 2, puis plus tard la vraie erreur ProseMirror (`RangeError: Unknown node type: codeBlock`) lors d'un test de contenu malveillant.
4. **`Error: Only plain objects, and a few built-ins, can be passed to Client Components from Server Components. Classes or null prototypes are not supported.`** — crash bloquant à la réouverture d'une fiche contenant un titre. Cause : `parseContent()` retournait `doc.toJSON()` (la représentation **re-dérivée par ProseMirror**) plutôt que le contenu d'origine — cette représentation interne n'est pas un objet « plain » au sens strict de React, ce qui casse la frontière Server → Client Component quand elle est repassée en prop à `EntityEditor`. **Corrigé** : `parseContent` valide toujours via `Node.fromJSON`+`check()` mais **retourne l'argument d'origine** (déjà JSON pur, venant de Postgres ou de `JSON.parse`), jamais la forme re-dérivée. *Candidat skill* : ne jamais faire traverser la frontière RSC→Client Component avec la sortie `.toJSON()` d'une classe tierce (ProseMirror ou autre) — toujours repasser par la donnée d'entrée déjà plain, ou un `JSON.parse(JSON.stringify(...))` explicite si la re-dérivation est indispensable.
5. **« Rien ne change visuellement » en cliquant Titre/Citation/Listes** — pas un bug de commande du tout : Tailwind Preflight réinitialise par défaut la taille de police des titres et les puces/numéros des listes (et l'indentation des citations). Tiptap est headless (aucun CSS fourni). Un titre appliqué correctement au niveau du document reste visuellement un paragraphe tant qu'aucun style de remplacement n'est ajouté. **Corrigé** : classes Tailwind explicites (`[&_h2]:...`, `[&_ul]:list-disc`, etc.) sur le conteneur de l'éditeur. *Candidat skill* : avec un éditeur headless + Tailwind, toujours prévoir le style des éléments de contenu (h1-h6, listes, citations) dès l'intégration — Preflight les neutralise silencieusement, aucune erreur, juste un rendu plat.
6. **`A tree hydrated but some attributes of the server rendered HTML didn't match the client properties`, diff sur `cz-shortcut-listen="true"` sur `<body>`** — extension Chrome ColorZilla qui injecte un attribut avant l'hydratation React, faux positif ubiquitaire documenté par React lui-même (lien `react.dev/link/hydration-mismatch` cité dans le message). Sans rapport avec le code de l'app. **Corrigé** : `suppressHydrationWarning` sur `<body>` (`src/app/layout.tsx`) — solution officielle React/Next.js pour ce cas précis, n'affaiblit pas la détection d'un vrai bug d'hydratation ailleurs.
7. **`{ type: "doc", content: [] }` (un « doc vide » au sens naïf) est en fait invalide** — le node `doc` de ProseMirror exige `content: "block+"` (au moins un bloc). Détecté par un test qui échouait **avant tout commit**, pas en production. `EMPTY_CONTENT` corrigé en `{ type: "doc", content: [{ type: "paragraph" }] }`.
8. Log utile découvert en cours de session : `.next/dev/logs/next-development.log` relaie les erreurs console du **navigateur connecté** (dev overlay) vers un fichier JSON lisible côté serveur — mais seulement pour une session navigateur réellement connectée ; `curl` ne l'alimente jamais (les crashs de type « Only plain objects » ne se déclenchent que lors de l'hydratation/désérialisation Flight côté navigateur, invérifiables par une requête HTTP brute).

**Commandes utiles de la session :**
- `npx tsx --env-file=.env <script>.ts` — round-trip contre la vraie base (create/list/get/update/delete, cascade d'autorisation, validation/extraction Tiptap) avant chaque commit ; utilisé à chaque étape et à chaque tour de correctif Tiptap.
- `curl -s -c cookies.txt -X POST .../api/auth/sign-up/email -d '{...}'` puis requêtes `-b cookies.txt` — simuler 2 comptes réels pour vérifier l'autorisation cross-owner/cross-monde sans navigateur.
- `cat .next/dev/logs/next-development.log` — lire les erreurs console réelles d'une session navigateur connectée (voir gotcha 8) quand le navigateur de pilotage est en panne.
- `npm view <pkg>@<version> dependencies --json` — vérifier ce qu'un package bundle réellement (utilisé pour confirmer le contenu de `@tiptap/starter-kit` v3 avant de configurer les extensions).

**Livrables produits :**
- **Étape 1 — Mondes** (`02aa14d feat: CRUD mondes`, après `d7fce99 fix: accents...`) : `src/lib/{slugify,world-schemas,auth-session}.ts`+tests, `src/services/world-service.ts`+test, `src/actions/world.ts`, UI `src/app/(app)/{layout,form-styles,worlds/*}`.
- **Étape 2 — Entités** (`99c1259 feat: CRUD entités`) : `src/lib/entity-schemas.ts`+test, `src/services/entity-service.ts`+test, `src/actions/entity.ts`, UI `worlds/[slug]/{create-entity-form,entities/[entityId]/*}`.
- **Étape 3 — Éditeur Tiptap** (`27f7413 feat: éditeur Tiptap + auto-save`) : `src/lib/{tiptap-extensions,tiptap-content}.ts`+test, `src/actions/entity-content.ts`+test, `entity-editor.tsx`, `src/app/layout.tsx` (`suppressHydrationWarning`), ADR-0009 (nouveau), ADR-0003 mis à jour.
- Docs à jour à chaque étape : `cahier-recettes.md` (TST-MND-*, TST-ENT-*, TST-SEC-002/003/004), `securite-owasp.md` (A01 cascade, A03 schéma ProseMirror réel), `accessibilite-rgaa.md`, `architecture.md`, `tests-unitaires.md` (remis à niveau, était resté figé au 11 juillet), `docs/README.md`, `CHANGELOG.md`.
- 4 branches poussées sur `feat/worlds-crud` (origin), PR pas encore ouverte/mergée à confirmer par Aymeric.
- État des gates en fin de session : lint ✅ 0 warning · typecheck ✅ · tests ✅ 98/98 · couverture `src/lib`+`src/services` : lignes 100 % · branches 100 % · statements 100 % · fonctions 97,2 % (seuil 80 % actif, écart pré-existant non lié) · build ✅.

**Avancement certification :**
- **C2.2.1** (architecture) : couche `src/services/` étoffée (2 services, pattern d'autorisation en cascade formalisé) ; intégration Tiptap avec schéma partagé client/serveur (`src/lib/tiptap-extensions.ts`) ; `docs/architecture.md` à jour.
- **C2.2.2** (tests) : 98 tests, couverture maintenue à 100 % sur le périmètre couvert ; `docs/tests-unitaires.md` remis à jour après un oubli de 3 sessions.
- **C2.2.3** (sécurité/RGAA) : A01 concrétisé en cascade, **A03 concrétisé avec une vraie preuve d'attaque rejetée** (payload `codeBlock` réel, `RangeError: Unknown node type` observé) ; toolbar accessible (`role="toolbar"`, `aria-pressed`, `aria-live`) documentée, gap honnêtement noté (pas de test RTL de l'éditeur interactif, pas de clic réel navigateur vérifié par moi).
- **C2.3.1** (cahier de recettes) : 21+ scénarios désormais (AUT/SEC/MND/ENT), dont 3 scénarios sécurité dédiés à l'éditeur/cascade.
- **C2.4.1** (ADR) : ADR-0009 rédigé (validation ProseMirror réelle vs Zod fait main), ADR-0003 mis à jour avec le statut d'implémentation ; matière à gotchas dense pour de futurs skills (voir candidats signalés ci-dessus).

**À faire / suite :**
- **Décision explicitement reportée par Aymeric à la prochaine session** — trois pistes possibles pour la suite, aucune tranchée : (1) continuer dans l'ordre (étapes 4/5 glissables : upload images via Storage, recherche basique) ; (2) basculer sur le moteur Aho-Corasick (Bloc B, `src/lib/linker`) ; (3) se concentrer sur le visuel/l'interface, jugée « pas fou » actuellement par Aymeric (dark mode minimal, pas de design system appliqué). Ne pas anticiper ce choix en début de prochaine session — le poser explicitement.
- Éditeur `EntityEditor` toujours sans test de rendu Testing Library (jsdom/contentEditable peu fiables) — logique de données (validation/extraction) 100 % testée en compensation, assumé et documenté.
- Vérifier si la PR de `feat/worlds-crud` est ouverte/mergée (à confirmer par Aymeric en début de prochaine session).
- Audit axe pleine-page et VPS toujours non commencés (reportés depuis plusieurs sessions, sans lien avec le travail de cette session).
- Reporter cette entrée dans dev-log.md (hors repo) + redéposer dans le projet Claude.
- Mettre à jour le board Jira (stories touchées → bonne colonne).

---

**Décisions techniques**

| Date | Décision | Alternatives | Justification |
|---|---|---|---|
| 2026-07-14 | **Validation du contenu Tiptap via le vrai schéma ProseMirror** (`Node.fromJSON`+`check()`) | Schéma Zod fait main pour l'AST récursif | Un seul point de vérité entre client et serveur (même fabrique d'extensions), zéro risque de dérive — ADR-0009 |
| 2026-07-14 | **Autorisation en cascade entre services** (`entity-service` réutilise `world-service.getWorld`) | Dupliquer la vérification d'appartenance dans chaque service | Un monde non possédé bloque l'accès à ses entités avant même de les chercher ; patron reproductible pour toute ressource imbriquée |
| 2026-07-14 | **Accents français réels dans tout le texte UI** (rétroactif auth+mondes+entités) | Garder la convention sans-accents héritée des commentaires de code | L'absence d'accents dans les commentaires a une vraie raison (encodage Windows), non pertinente pour du texte affiché — tranché par Aymeric |
| 2026-07-14 | **Auto-save : Server Action appelée directement + JSON.stringify/parse à la frontière** | Passer l'objet JS imbriqué directement en argument | Évite une erreur de sérialisation Next.js (React Flight) sur les objets imbriqués complexes passés en appel direct de Server Action |

**Erreurs rencontrées & Solutions**

| Date | Symptôme (message exact) | Cause | Solution |
|---|---|---|---|
| 2026-07-14 | Toolbar « actif » en retard, seuls gras/italique semblaient s'appliquer | Tableau d'extensions Tiptap singleton partagé entre 2 montages React StrictMode + toolbar non abonné aux transactions de l'éditeur | `createEditorExtensions()` (fabrique) + `useEditorState` (re-rend sur transaction) |
| 2026-07-14 | `Error: Cannot access level on the server. You cannot dot into a temporary client reference from a server component.` | Objet JSON Tiptap imbriqué passé en argument positionnel brut à une Server Action appelée directement (pas via `<form>`) — cas limite de sérialisation React Flight | `JSON.stringify(content)` côté client, `JSON.parse()` en premier côté serveur |
| 2026-07-14 | `Error: Only plain objects... Classes or null prototypes are not supported` (crash à la réouverture d'une fiche) | `parseContent()` retournait `doc.toJSON()` (forme re-dérivée par ProseMirror, pas garantie "plain" pour React) plutôt que le contenu d'origine | Retourner l'argument d'origine (déjà JSON pur) une fois validé, jamais `doc.toJSON()` |
| 2026-07-14 | Titre/liste/citation appliqués (JSON correct) mais visuellement identiques à un paragraphe | Tailwind Preflight neutralise les styles natifs des titres/listes/citations ; Tiptap headless ne fournit aucun CSS | Classes Tailwind explicites (`[&_h2]`, `[&_ul]:list-disc`, etc.) sur le conteneur de l'éditeur |
| 2026-07-14 | `A tree hydrated but some attributes... didn't match`, diff `cz-shortcut-listen="true"` sur `<body>` | Extension Chrome (ColorZilla) injectant un attribut avant l'hydratation React — faux positif documenté, hors app | `suppressHydrationWarning` sur `<body>` (`src/app/layout.tsx`) |
| 2026-07-14 | `{ type: "doc", content: [] }` rejeté par la validation | Le node `doc` de ProseMirror exige `content: "block+"` (au moins un bloc) | `EMPTY_CONTENT` = `{ type: "doc", content: [{ type: "paragraph" }] }` |

---

⚠️ Rien en attente de commit — Étapes 1, 2 et 3 committées et poussées sur
`feat/worlds-crud` (`d7fce99`, `02aa14d`, `99c1259`, `27f7413`). État de la PR
(ouverte/mergée) à confirmer par Aymeric.

---

### Session — 2026-07-14 (suite) — Durcissement post-review + amorce moteur Aho-Corasick

**Thèmes abordés :**
- Revue de la session précédente (review à froid, apportée par Aymeric en prompt) : 5 points de durcissement à traiter avant de reprendre le périmètre.
- Vérification d'état en tout début de session : `feat/worlds-crud` à jour avec origin (0 commit d'écart), mais **pas mergée dans `main`** (main 3 commits en retard) ; état ouverte/mergée de la PR non vérifiable (`gh` CLI absent de l'environnement).
- Décision d'orientation (posée via AskUserQuestion, tranchée par Aymeric) : moteur **Aho-Corasick** en priorité après le lot de durcissement ; smoke Playwright **planifié après le linker**, pas cette session (Playwright non installé, le vrai coût est l'isolation d'une base de test).
- Étape 1 : sécurité du contenu Tiptap — borne de taille avant `JSON.parse` (DoS) + validation des **valeurs** d'attributs (`image.src`/`link.href`/`image.alt`), pas seulement la structure.
- Étape 2 : règle « jamais d'erreur avalée » — chaînage systématique de la cause réelle + log serveur sur les replis génériques de `src/actions`.
- Étape 3 : rédaction des 2 skills candidats identifiés le 14/07 + chiffrage du smoke Playwright au backlog (spec §14).
- Étape 4 : amorce du moteur Aho-Corasick sur nouvelle branche `feat/linker` — première brique (`normalizeForMatch`), TDD.

**Décisions prises :**
- **Lot de durcissement avant toute nouvelle feature** — une review à froid a identifié 5 trous réels (DoS non borné, validation d'attrs incomplète, erreurs avalées, skills non écrits, décision Playwright non actée) ; tranché par Aymeric : les traiter d'abord, dans l'ordre, un commit par point regroupé logiquement.
- **Orientation post-durcissement : moteur Aho-Corasick** plutôt que étapes 4/5 (upload/recherche) ou passe visuelle — posé via AskUserQuestion, tranché par Aymeric. Justification proposée et retenue : c'est le différenciateur produit, il se vérifie à 100 % en unitaire (pas besoin de navigateur), et le planning §12 le place précisément maintenant.
- **Smoke Playwright : planifié, pas exécuté cette session** — posé via AskUserQuestion, tranché par Aymeric (« on s'en occupera après aho »). Le vrai coût n'est pas l'écriture du spec mais l'isolation d'une base de test dédiée (seed + reset) ; chiffrage consigné à `docs/spec-technique-bloc2.md` §14 pour ne pas le reperdre.
- **`feat/linker` : nouvelle branche dédiée**, pas de commits AC sur `feat/worlds-crud` — le moteur de liaison est une feature distincte du CRUD/éditeur, cohérent avec le découpage `feat/*` court du projet.
- **Validation des valeurs d'attributs Tiptap après `check()`, pas dans le schéma ProseMirror lui-même** — `Node.fromJSON`/`check()` ne valident que la structure (types de nodes, nesting), jamais les valeurs ; un parcours `doc.descendants` dédié après coup reste isolé et testable, sans complexifier le schéma partagé client/serveur.
- **`cause` chaînée sans changement de comportement observable** — la règle « jamais d'erreur avalée » ajoute uniquement du log serveur et un `cause` sur les erreurs déjà typées ; aucun message utilisateur ni flux modifié, donc la non-régression se mesure par la constance de la suite de tests plutôt que par de nouveaux scénarios de recette.

**Éléments notables / appris (gotchas) :**
1. **Docker Desktop arrêté en tout début de vérification** — `docker compose -f docker-compose.dev.yml ps` échouait (`failed to connect to the docker API at npipe:...`), port 5432 fermé. Signalé explicitement à Aymeric plutôt que de simuler la vérification réelle ; le commit de l'Étape 1 a d'abord été proposé avec cette limite assumée, puis la preuve réelle (script `tsx` jetable contre une vraie base, payloads `javascript:`/`data:`/surdimensionné rejetés + persistance/relecture d'un contenu légitime) a été faite après qu'Aymeric ait démarré Docker — sans modifier le commit déjà proposé (le code et les tests n'avaient pas changé entretemps).
2. **`InvalidContentError` sans `cause` avant cette session** — la classe d'erreur existante (ADR-0009, session précédente) ne portait qu'un message fixe. Ajouter `cause?: unknown` au constructeur (`super("Contenu invalide.", { cause })`) est rétrocompatible (paramètre optionnel) et ne casse aucun appel existant — vérifié par la suite de tests inchangée + 2 nouveaux tests dédiés qui verrouillent la présence de `cause`.
3. **Un seul `catch` sans binding à corriger** (`catch {` → `catch (error)`) dans `createWorldAction` (`world.ts`) — les autres replis génériques capturaient déjà `error` mais ne le loggaient pas ; distinction faite entre replis génériques (à logguer : erreur inattendue type panne DB) et branches 404 métier / redirections de session (à laisser : flux de contrôle normal, pas une perte d'info).
4. **ADR-0001 (« ligatures non dépliées », actée le 2026-07-03, jamais encore codée) directement contraignante pour `normalizeForMatch`** — relue avant d'écrire le code : la décision d'alignement caractère-exact impose **NFD (canonique)**, jamais **NFKD (compatibilité)**, car NFD ne déplie pas les ligatures `œ`/`æ` (pas de décomposition canonique pour ces caractères) alors que le dépliage changerait la longueur de la chaîne et casserait l'alignement des positions de surlignage. Un test dédié (`Cœur` → `cœur`, jamais `coeur`, longueur préservée) verrouille explicitement cette décision : si `NFD` est un jour changé en `NFKD` par réflexe, ce test échoue immédiatement. *Candidat lié* : `src/lib/slugify.ts` utilise la même technique NFD+`\p{M}` mais à des fins différentes (slug URL, avec collapse non-alphanumérique) — bon repère de style à citer plutôt qu'à dupliquer aveuglément, la différence de finalité (aligné caractère-à-caractère vs URL-safe) doit rester explicite dans le commentaire du nouveau module.
5. **`gh` CLI absent de l'environnement** — impossible de confirmer par API l'état réel (ouverte/mergée) de la PR `feat/worlds-crud` ; vérifié uniquement ce qui est vérifiable en local (`git log`, `git branch --contains`, comparaison avec `origin/main`). Signalé explicitement à Aymeric plutôt que présumé.
6. **`feat/worlds-crud` s'est retrouvée poussée sur origin sans action de Claude** — probablement un push par Aymeric entre deux étapes (jamais visible dans la conversation) ; détecté en fin de session via `git rev-list --left-right --count origin/feat/worlds-crud...feat/worlds-crud` → `0 0`. Sert de rappel que l'état distant peut changer hors de la session sans notification.

**Commandes utiles de la session :**
- `docker compose -f docker-compose.dev.yml up -d` puis `docker compose -f docker-compose.dev.yml ps` — (re)démarrer et vérifier la santé du stack dev (Postgres/MinIO) avant un script de vérification réelle.
- `git rev-list --left-right --count origin/<branche>...<branche>` — compter précisément l'écart ahead/behind entre une branche locale et son remote, plus fiable qu'une lecture visuelle de `git status -sb`.
- `git branch --contains <sha>` — vérifier sur quelles branches locales un commit donné est déjà présent (utilisé pour confirmer que `main` n'avait pas les commits Bloc A).
- `git checkout -b feat/linker` — nouvelle branche locale pour une feature distincte du lot de durcissement en cours (pas un commit, pas d'écriture d'historique — jugé hors du périmètre des commandes Git interdites à Claude).

**Livrables produits :**
- **Étape 1 — Durcissement Tiptap** (`7b7a11e fix: durcir la validation du contenu Tiptap`) : `src/actions/entity-content.ts` (borne 1 Mo), `src/lib/tiptap-content.ts` (`assertSafeAttributes`, `isSafeHttpUrl`) + tests dédiés, `docs/securite-owasp.md` (A03/A04), `docs/cahier-recettes.md` (TST-SEC-005 à 008), `CHANGELOG.md`.
- **Étape 2 — Erreurs chaînées** (`905d5df refactor: chaîner les erreurs réelles au lieu de les avaler`) : `InvalidContentError` avec `cause`, replis génériques loggués dans `world.ts`/`entity.ts`/`entity-content.ts`, règle ajoutée à `CLAUDE.md`.
- **Étape 3 — Skills + backlog** (`ed7471b docs: skills RSC/Tailwind + backlog smoke Playwright chiffré`) : `.claude/skills/{rsc-boundary-plain-json,headless-editor-tailwind-preflight}/SKILL.md` (nouveaux), `docs/spec-technique-bloc2.md` §14 (chiffrage Playwright).
- **Étape 4 — Amorce linker** (`0db87f7 feat: normalizeForMatch (linker)`, branche `feat/linker`) : `src/lib/linker/{normalize.ts,normalize.test.ts}` (nouveau dossier).
- État des gates en fin de session : lint ✅ 0 warning · typecheck ✅ · tests ✅ 117/117 · couverture `src/lib`+`src/services` : lignes 100 % · branches 100 % · statements 100 % · fonctions 97,56 % (écart pré-existant non lié, seuil 80 % largement tenu) · build ✅ (vérifié à l'Étape 1, pas re-exécuté ensuite — aucun changement de build attendu sur les étapes suivantes, uniquement lib/actions/docs).
- Push : `feat/worlds-crud` à jour sur origin (3 nouveaux commits confirmés poussés). `feat/linker` **locale uniquement**, jamais poussée (Claude ne pousse jamais — cf. règle Git CLAUDE.md).

**Avancement certification :**
- **C2.2.3** (sécurité) : A03 renforcé (valeurs d'attrs, pas seulement structure) et A04 concrétisé pour la première fois (borne de taille, mitigation DoS) dans `docs/securite-owasp.md` ; 4 nouveaux scénarios sécurité dédiés (`TST-SEC-005` à `008`) avec preuve de rejet réelle (payload `javascript:`/`data:`/surdimensionné).
- **C2.2.2** (tests) : 117 tests (+19 sur cette session), couverture 100 % maintenue sur `src/lib`+`src/services` malgré l'ajout de code (validation d'attrs + `normalizeForMatch`).
- **C2.2.1** (architecture) : première brique de `src/lib/linker/` posée (TS pur, zéro dépendance, conforme à la règle dure CLAUDE.md) ; patron de durcissement des erreurs formalisé dans CLAUDE.md, applicable à tout futur service/action.
- **C2.4.1** (traçabilité) : ADR-0001 (2026-07-03, jamais encore codée) vérifiée et respectée dès la première ligne de code du linker, avec un test qui la verrouille explicitement — bon exemple concret de continuité décision→code pour le dossier.

**À faire / suite :**
- **Suite logique du moteur Aho-Corasick** (non commencée cette session, roadmap posée dans le plan) : trie + liens de suite (fail links) → scan `plainText` en un seul passage (O(n), plus long match prioritaire, frontières de mots, auto-mention exclue) → dictionnaire par monde (noms+alias) + cache/invalidation → diff/upsert `Relation origin=AUTO` (ne jamais écraser `MANUAL`) → filtre `LinkIgnore` → enfilage via l'interface `JobQueue` (`singletonKey=entityId`) → worker.
- **Smoke Playwright** : reste à faire, positionné explicitement **après** la suite du moteur Aho-Corasick (décision d'Aymeric cette session) — chiffrage déjà consigné à `docs/spec-technique-bloc2.md` §14, pas la peine de le reperdre en session.
- **État de la PR `feat/worlds-crud`** (ouverte/mergée) toujours non confirmé — `gh` CLI absent de l'environnement ; à vérifier par Aymeric directement sur GitHub, ou installer `gh` pour que Claude puisse le faire.
- **`feat/linker` jamais poussée** — premier push à faire par Aymeric quand il le souhaite.
- Report des gaps déjà connus, toujours sans lien avec cette session : pas de test RTL sur `EntityEditor`, audit axe pleine-page non commencé, VPS non commandé.
- Reporter cette entrée (les deux sessions du jour) dans dev-log.md (hors repo) + redéposer dans le projet Claude.
- Mettre à jour le board Jira (stories touchées → bonne colonne).

---

**Décisions techniques (suite)**

| Date | Décision | Alternatives | Justification |
|---|---|---|---|
| 2026-07-14 | **Lot de durcissement traité avant toute nouvelle feature** | Enchaîner directement sur l'orientation choisie | Review à froid = 5 trous réels identifiés (DoS, validation d'attrs, erreurs avalées, skills non écrits, décision Playwright non actée) ; les laisser traîner aurait coûté plus cher plus tard |
| 2026-07-14 | **`feat/linker` : branche dédiée**, pas de commits AC sur `feat/worlds-crud` | Continuer sur `feat/worlds-crud` | Le moteur de liaison est une feature distincte du CRUD/éditeur ; cohérent avec le découpage `feat/*` court |
| 2026-07-14 | **`normalizeForMatch` en NFD (canonique), jamais NFKD** | NFKD (déplierait aussi les ligatures) | ADR-0001 : alignement caractère-exact des positions de surlignage non négociable ; NFD ne déplie pas `œ`/`æ` |
| 2026-07-14 | **Validation des valeurs d'attributs Tiptap en parcours post-`check()` dédié**, pas dans le schéma partagé | Étendre le schéma ProseMirror pour contraindre les valeurs | Garde le schéma partagé client/serveur simple ; un parcours `doc.descendants` isolé reste testable indépendamment |

**Erreurs rencontrées & Solutions (suite)**

| Date | Symptôme (message exact) | Cause | Solution |
|---|---|---|---|
| 2026-07-14 | `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine` | Docker Desktop arrêté en tout début de session, avant redémarrage par Aymeric | Signaler explicitement la limite de vérification plutôt que simuler ; relancer le script réel une fois Docker redémarré |
| 2026-07-14 | (aucune erreur — vérification préventive) `gh: command not found` | `gh` CLI absent de l'environnement | Se limiter aux vérifications Git locales vérifiables (`git log`, `git branch --contains`, comparaison avec origin) et signaler la limite plutôt que présumer l'état de la PR |

---

⚠️ Rien en attente de commit pour cette seconde partie de session — Étapes 1 à 4 committées
(`7b7a11e`, `905d5df`, `ed7471b` sur `feat/worlds-crud`, déjà poussées sur origin ;
`0db87f7` sur `feat/linker`, **branche locale non poussée**). État de la PR `feat/worlds-crud`
(ouverte/mergée) toujours à confirmer par Aymeric.

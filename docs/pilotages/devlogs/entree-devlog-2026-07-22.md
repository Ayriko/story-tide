### Session — 2026-07-22 — BUG-004 (correctif client prouvé) + scrollbar thématisée

**Thèmes abordés :**
- Suite de BUG-004 (Sidebar jamais à jour après création d'entrée depuis le
  dashboard) : deux tentatives serveur (`revalidatePath`) retestées par
  Aymeric et jugées inefficaces malgré les gates automatisés verts.
- Diagnostic rigoureux imposé par Aymeric (« STOP aux hypothèses ») : logs
  temporaires + script Playwright jetable contre le dev server local, preuve
  empirique de la cause réelle avant tout nouveau code.
- Correctif v3 (cause **client**, pas serveur) : dérivation directe des props
  dans `entity-search.tsx`, nouveau e2e de non-régression.
- Scrollbar thématisée (Sidebar + « Dernières entrées » du dashboard) :
  retour visuel additionnel, classe CSS pure.
- 2 commits préparés, exécutés et poussés par Aymeric.

**Décisions prises :**
- **Process de diagnostic imposé par Aymeric** : preuve empirique (logs +
  script Playwright jetable, jamais Claude in Chrome) avant tout correctif —
  appliqué à la lettre après deux tentatives serveur infructueuses, pour
  éviter une troisième tentative aveugle.
- **Design `entity-search.tsx`** (spécifié par Aymeric, après vérification
  explicite que la recherche interroge bien le serveur — KAN-17,
  `searchEntitiesAction`) : requête vide → dérivation directe de la prop
  `initialEntities` (jamais de copie) ; requête active → résultats serveur
  en state (`searchResults`, nullable). Les deux ne peuvent pas partager le
  même mécanisme puisque l'un vient des props, l'autre du serveur.
- Les deux tentatives `revalidatePath` (v1 sans groupe de routes, v2 avec)
  **restent en place** côté serveur — inoffensives, pas la cause, non
  retirées sauf demande explicite d'Aymeric.
- **Honnêteté doc explicitement demandée** : `plan-correction-bogues.md`
  documente les 3 tentatives (v1/v2 inefficaces, v3 cause réelle) sans
  réécrire l'historique des échecs précédents.
- Scrollbar : classe CSS pure (`scrollbar-width`/`scrollbar-color` +
  fallback `::-webkit-scrollbar*`), pas de librairie tierce, tokens
  existants réutilisés (`--muted-foreground` au repos, `--primary`/MINT au
  survol) — cohérent avec le reste de la palette, aucune nouvelle valeur.

**Éléments notables / appris (gotchas) :**
- `revalidatePath(path, "layout")` pour un segment sous un **groupe de
  routes** doit inclure ce groupe dans le patron (`/(app)/worlds/[slug]`,
  pas `/worlds/[slug]`) — sans lui, Next.js ne trouve aucun layout
  correspondant et la revalidation ne fait **rien, silencieusement** (aucune
  erreur, aucun warning). Erreur commise une première fois (v1), corrigée en
  v2 après relecture de la doc Next.js elle-même (exemple « avec groupes de
  routes »).
- **Même après avoir corrigé le patron de route (v2), le bug persistait** —
  preuve que la cause n'était pas côté serveur du tout. Cause réelle,
  `entity-search.tsx:36` : `useState(initialEntities)` ne réutilise
  l'argument qu'au tout premier montage ; ce composant vit dans un layout
  persistant à travers toute navigation interne au monde, donc les props
  plus récentes (nouvelle entrée créée) étaient silencieusement ignorées.
  Prouvé empiriquement (10 rendus consécutifs avec prop fraîche
  `initialEntities.length=1` mais état affiché figé à `results.length=0`),
  pas déduit par raisonnement seul.
- **Candidat skill fort** : face à un bug « données pas à jour côté UI »
  dans une app Next.js App Router (Server Components + layout partagé),
  toujours vérifier en premier si un composant client copie une prop dans un
  `useState(prop)` avant de soupçonner la couche de cache serveur
  (`revalidatePath`/`revalidateTag`). Le symptôme caractéristique — une
  donnée « page »/RSC fraîche mais un élément partagé du layout resté
  périmé — est un signal fort de ce piège précis ; deux tentatives de
  correction côté serveur peuvent échouer complètement si la cause est
  côté client.
- Script Playwright **jetable** (config minimale sans `globalSetup`/
  `webServer`, ciblant un dev server déjà lancé en local) + `page.on(
  "console")` pour capturer les logs navigateur = technique de diagnostic
  rapide et reproductible, sans toucher à la base e2e isolée ni à la config
  du projet. A permis de trancher entre les deux hypothèses en quelques
  minutes plutôt que par supposition.

**Commandes utiles de la session :**
- `npx playwright test --config="chemin/config-minimal.ts"` — config
  jetable (`testDir` + `use.baseURL` uniquement, pas de `globalSetup`/
  `webServer`) pour cibler un dev server déjà démarré en local, utile pour
  un diagnostic ponctuel sans reset de base ni double serveur.

**Livrables produits :**
- `entity-search.tsx` corrigé (BUG-004 v3) : suppression de la copie d'état
  pour la liste par défaut, dérivation directe de `initialEntities` à chaque
  rendu ; recherche active toujours en state (résultats serveur).
- Nouveau `e2e/dashboard-create-entity.spec.ts` : création depuis le
  dashboard **et** depuis la Sidebar, état plié/déplié des groupes conservé
  après création, recherche active puis effacée non régressée.
- Scrollbar thématisée : `.themed-scrollbar` (`globals.css`), appliquée à
  `sidebar.tsx` et `worlds/[slug]/page.tsx`.
- Docs mises à jour : `plan-correction-bogues.md` (BUG-004, historique
  complet des 3 tentatives), `CHANGELOG.md`, `cahier-recettes.md`
  (`TST-MND-008`).
- 2 commits préparés, exécutés et poussés par Aymeric (scrollbar, puis fix
  BUG-004 v3).
- Gates finaux : lint ✅ (0 warning) · `tsc` ✅ · 341/341 tests unitaires ✅
  (couverture stable 98,28 %) · 10/10 e2e ✅ · build ✅.

**Avancement certification :**
- C2.2.2 (tests) : nouveau e2e de non-régression sur un bug réellement
  rencontré en staging, comportement **prouvé** par log plutôt que supposé —
  couvre exactement le trou qui avait laissé passer le bug deux fois.
- C2.3.1 (recette) : `TST-MND-008` tenu à jour avec l'historique réel du bug
  (3 tentatives, pas réécrit après coup) — traçabilité complète pour la
  recette et pour la certification.
- Pas d'avancement C2.2.3 (sécurité/RGAA) cette session — correctif
  fonctionnel + cosmétique, aucune surface de sécurité/accessibilité
  nouvelle touchée.

**À faire / suite :**
- Rien d'ouvert identifié à ce stade — BUG-004 vérifié manuellement par
  Aymeric (staging/local) et scrollbar vérifiée visuellement, les deux
  commits sont poussés.
- Reporter cette entrée dans `dev-log.md` (hors repo) + redéposer dans le
  projet Claude.
- Mettre à jour le board Jira (BUG-004 → résolu/vérifié).

---

### Session — 2026-07-22 — Supervision v1 (C4.1.2), BUG-005 (NFC/NFD moteur de liaison), Renvois live + popup `@`

**Thèmes abordés :**
- Supervision v1 (C4.1.2, éliminatoire Bloc 4) : endpoint `/api/health`,
  healthcheck Docker de l'app aligné dessus, heartbeat de sauvegarde, rotation
  des logs Docker, accès données prod par tunnel SSH (port loopback).
- Diagnostic imposé par Aymeric (« tu ne corriges RIEN sans validation ») sur
  une hypothèse de faille Unicode NFC/NFD dans le moteur de liaison
  (Aho-Corasick) — bug réel trouvé, différent du mécanisme hypothésé, corrigé
  après arbitrage explicite (BUG-005).
- Au passage : collision de numérotation ADR résolue (brouillon orphelin
  jamais déposé correctement, en dette depuis sa rédaction).
- « Renvois » (liens sortants d'une fiche) mis à jour en live après un
  autosave, sans fermer/rouvrir l'entrée ; indicateur de délai pour les liens
  AUTO ; ligne de tips sur la fiche (même patron que le dashboard).
- Bug popup de suggestion `@` flouté/illisible : 2 tentatives, la 1ʳᵉ inerte
  (mauvais élément DOM), diagnostiqué précisément à la 2ᵉ en lisant le code
  source de `@tiptap/react`/`@tiptap/suggestion`.
- Flake CI e2e sur `link-ignore.spec.ts`, même mécanisme que celui déjà
  corrigé la veille sur `link-highlight.spec.ts`, jamais reporté sur ce test.
- 4 commits préparés, exécutés et poussés par Aymeric.

**Décisions prises :**
- **SHA de commit sur `/api/health` gaté sur `NODE_ENV !== "production"`**,
  aucune nouvelle variable d'environnement de distinction staging/prod —
  tranché par Aymeric (AskUserQuestion) plutôt que d'introduire un `APP_ENV`.
- **Correction de la ligne A05 de `docs/securite-owasp.md`** (le port
  loopback postgres prod rend l'ancienne formulation « aucun `ports:` »
  factuellement fausse) + complément A09 (supervision comme mesure de
  logging/monitoring) — jugé nécessaire par obligation CLAUDE.md (mapping
  OWASP tenu à jour à chaque mesure codée), hors de la liste stricte des 6
  tâches mais tranché avec Aymeric avant d'agir.
- **Normalisation NFC à LA FRONTIÈRE (persistance), jamais dans le moteur**
  (`normalize.ts`/`aho-corasick.ts`) — décision explicite d'Aymeric, avec
  justification vérifiée : un `.normalize("NFC")` ajouté DANS le pipeline de
  matching romprait le même invariant d'alignement des index, juste déplacé
  (pire : décalage de surlignage plutôt que lien manquant). Alternative
  écartée : correction par carte d'index dans le moteur — hors périmètre
  avant le gel, confirmé après lecture du code.
- **Le test de diagnostic committé devient la non-régression** : plutôt que
  de laisser un test rouge (interdit par CLAUDE.md, casse la CI), le
  comportement bugué du moteur PUR (isolé, texte non normalisé) est « pin »
  explicitement comme limite connue, complété par un second test prouvant
  que la frontière NFC élimine le cas en pratique — décision d'Aymeric.
- **Un seul `router.refresh()` après autosave**, pas de second refresh
  différé pour rattraper le délai des liens AUTO (~2 s de polling pg-boss) —
  tranché par Aymeric (AskUserQuestion) : accepter le délai résiduel déjà
  documenté plutôt qu'ajouter un minuteur supplémentaire à gérer/tester.
- **Collision ADR résolue par réaffectation, pas suppression** : le brouillon
  orphelin (`docs/adr/extern-entry/ADR-0010-rendu-graphe.md`, jamais adopté,
  react-flow remplacé par cytoscape.js dès le départ) est refilé en ADR-0021
  (statut « remplacé par ADR-0012 ») plutôt que supprimé — traçabilité C2.4.1
  d'une décision écartée, pas seulement des décisions retenues.

**Éléments notables / appris (gotchas) :**
- **L'hypothèse de départ (« `normalizeChar()` per-caractère ») était fausse
  dans son mécanisme** — la fonction réelle (`normalizeForMatch`,
  `normalize.ts`) transforme la chaîne ENTIÈRE en un seul appel, pas
  caractère par caractère. Mais un risque réel existait par un chemin
  différent : `AhoCorasick.search()` calcule ses positions sur le texte
  normalisé (potentiellement plus court que l'original si celui-ci contient
  déjà des marques combinantes NFD) puis les réutilise telles quelles contre
  le texte ORIGINAL pour la vérification de frontière de mot. Résultat
  observé : un texte NFD plus tôt dans le document fait tomber la frontière
  de mot d'un match ULTÉRIEUR sur un caractère de mot, le rejetant
  entièrement (`matches.find(...)` → `undefined`) — pas seulement l'entité
  accentuée, n'importe quelle autre entité mentionnée après elle. Prouvé par
  test Vitest avant tout correctif, jamais supposé.
- **Candidat skill fort** : face à une hypothèse de bug Unicode NFC/NFD (ou
  toute normalisation de chaîne appliquée en un seul passage sur un texte
  entier), toujours vérifier si les POSITIONS calculées sur le texte
  normalisé sont ensuite réutilisées contre le texte ORIGINAL sans remapping
  — c'est le point de rupture réel, pas la détection de contenu elle-même
  (qui peut très bien fonctionner alors que l'alignement des index est déjà
  cassé).
- **Popup `@` flouté — 1ʳᵉ tentative inerte, cause trouvée en lisant le code
  source des deux libs (pas supposée)** : `ReactRenderer` (`@tiptap/react`)
  crée SON PROPRE wrapper `<div class="react-renderer">` et y monte
  `MentionList` via un portail React — c'est ce wrapper que
  `props.mount()` positionne (`position: absolute`) et ajoute à
  `document.body`, jamais l'élément JSX rendu par `MentionList` lui-même. Un
  `z-50` posé sur la racine de `MentionList` (1ʳᵉ tentative) était donc à la
  fois sur le mauvais élément ET sur un enfant en `position: static`
  (`z-index` sans aucun effet). Correctif réel : `className: "z-50"` passé
  au constructeur `ReactRenderer` (option documentée), qui l'applique au
  wrapper réellement positionné.
- **Flake CI e2e sur `link-ignore.spec.ts`** : exactement le même mécanisme
  que celui corrigé la veille sur `link-highlight.spec.ts` (clic sur un lien
  hors du bloc `toPass` qui vient de faire un `page.reload()` — page pas
  garantie pleinement interactive). Jamais reproduit en local, seulement en
  CI. Ce test n'avait simplement jamais reçu le même durcissement — **candidat
  skill** : tout futur test e2e avec le patron « reload dans un `toPass` puis
  clic derrière » doit inclure le clic et son assertion DANS le même bloc de
  retry dès l'écriture, pas seulement après un flake CI constaté a posteriori.
- Contrôle ponctuel (script jetable, jamais committé) des données existantes
  en base de dev : 17 entités, 0 alias, aucune donnée en forme non-NFC — pas
  de migration nécessaire pour cet environnement. **Non vérifié sur
  staging/prod** (accès non disponible depuis cette session) — point ouvert.

**Commandes utiles de la session :**
- `npx tsx --env-file=.env scratch-check-nfc.ts` — script jetable (jamais
  committé) pour vérifier une propriété (ici : forme NFC) sur les données
  réellement en base, sans écrire de script permanent ni de migration.
- `docker compose -f deploy/compose.prod.yml --env-file deploy/.env.prod.example config`
  — valide un fichier compose (interpolation des variables, healthcheck,
  ports) sans déployer quoi que ce soit.
- `taskkill //PID <pid> //T //F` — nettoyage récurrent des process worker
  orphelins après chaque run e2e (pattern déjà connu, toujours nécessaire).

**Livrables produits :**
- **Supervision v1** : `src/app/api/health/route.ts` (+ test), `src/env.ts`
  (`COMMIT_SHA` optionnel), `deploy/compose.{prod,staging}.yml`
  (healthcheck aligné, rotation logs, port loopback postgres en prod
  uniquement), `deploy/backup/{backup.sh,Dockerfile}` (heartbeat),
  `deploy/.env.{prod,staging}.example`, `docs/supervision.md`,
  `docs/adr/0019-supervision-sonde-externe.md`,
  `docs/manuels/deploiement.md`, `docs/securite-owasp.md` (A05/A09),
  `docs/cahier-recettes.md` (`TST-SEC-015`), `CHANGELOG.md`.
- **BUG-005 (NFC/NFD)** : `src/lib/linker/aho-corasick.test.ts` (tests de
  diagnostic + non-régression, moteur intouché), `src/services/entity-service.ts`
  (+ test, NFC sur nom/alias à l'écriture), `src/lib/tiptap-content.ts`
  (`normalizeContentText`, + test), `src/actions/entity-content.ts` (+ test),
  `docs/adr/0020-normalisation-nfc-liaison.md`,
  `docs/adr/0021-rendu-graphe-proposition-initiale-remplacee.md` (collision
  résolue), `docs/adr/README.md` (index complété, 0018/0019 manquants aussi
  comblés), `docs/cahier-recettes.md` (`TST-LNK-008`),
  `docs/plan-correction-bogues.md` (`BUG-005`), `CHANGELOG.md`.
- **Renvois live + popup `@` + tips** : `entity-editor.tsx`
  (`router.refresh()` après autosave, indicateur transitoire « liens en
  cours »), `page.tsx` de la fiche (ligne de tips), `mention-suggestion.ts`
  (`className: "z-50"` sur `ReactRenderer`), `mention-list.tsx` (retrait du
  `z-50` inerte, couleurs alignées sur les tokens de thème `bg-popover`/
  `bg-accent`).
- **Flake e2e** : `e2e/link-ignore.spec.ts` durci (même patron que
  `link-highlight.spec.ts`).
- 4 commits préparés, exécutés et poussés par Aymeric
  (`bf63448`, `a930ba8`, `27ee59a`, `186dfc9`).
- Gates finaux : lint ✅ (0 warning) · `tsc` ✅ · `format:check` ✅ ·
  365/365 tests unitaires ✅ (couverture 98,31 %) · e2e 10/10 ✅ (dont
  `link-ignore.spec.ts` retesté isolément 3/3) · build ✅.

**Avancement certification :**
- **C4.1.2 (supervision, éliminatoire Bloc 4)** : dispositif complet posé
  (endpoint santé, healthcheck Docker, heartbeat backup, rotation logs) —
  `docs/supervision.md`, ADR-0019.
- **C2.2.2 (tests)** : nouveau test de diagnostic devenu non-régression sur
  un bug réel du moteur de liaison (perte de match en cascade),
  couverture stable 98,31 %.
- **C2.2.3 (sécurité)** : `docs/securite-owasp.md` A05 corrigé (port
  loopback prod) et A09 complété (supervision comme mesure de
  logging/monitoring, comblant partiellement un TODO resté ouvert).
- **C2.3.1 (recette)** : `TST-SEC-015` (endpoint santé), `TST-LNK-008` (NFC)
  ajoutés ; `BUG-005` documenté dans `plan-correction-bogues.md`.
- **C2.4.1 (traçabilité architecture)** : ADR-0019 (supervision), ADR-0020
  (NFC à la frontière), ADR-0021 (collision résolue, décision écartée
  tracée plutôt que perdue) ; index `docs/adr/README.md` complété.

**À faire / suite :**
- Contrôle NFC des données existantes **non fait sur staging/prod** (accès
  non disponible cette session) — à rejouer avant toute bascule si des
  données antérieures au correctif y existent.
- Câblage réel de `COMMIT_SHA` (build-arg Docker + `cd.yml`) non fait, noté
  hors périmètre de supervision v1.
- Reporter cette entrée dans `dev-log.md` (hors repo) + redéposer dans le
  projet Claude.
- Mettre à jour le board Jira (KAN-19 liaison auto, supervision → bonnes
  colonnes).

---

### Session — 2026-07-22 — KAN-35 : seed exécutable du monde d'introduction « Atheraus » + câblage inscription

**Thèmes abordés :**
- Passe 3 de KAN-35 : transformation des 25 fiches markdown (bible + 2 lots) en un
  seed JSON exécutable (`prisma/seed/atheraus.json`), script de seed idempotent
  passant par la couche service, exécution réelle (base + worker) pour mesurer les
  compteurs contre la matrice de la bible.
- Complément B (pièce d'architecture manquante, signalée avant d'être écrite,
  comme demandé) : câblage du monde résultant sur `registerAction`, avec case à
  cocher opt-out.
- Régression e2e découverte et corrigée en cours de session (contention de file
  partagée entre le seed et les autres tests).

**Décisions prises :**
- **Fonction de clonage partagée (`seedIntroWorld`), pas de monde template en
  base + compte système** — tranché par Aymeric (AskUserQuestion) : chaque compte
  reçoit un monde `origin: INTRO` frais et indépendant (contrainte réelle,
  vérifiée : `World.ownerId` non-nullable, un monde ne peut structurellement pas
  être partagé). Alternative écartée documentée dans ADR-0022.
- **Case à cocher décochée par défaut (opt-out)** — tranché par Aymeric
  (AskUserQuestion) : le monde d'exemple est créé sauf refus explicite.
- **Absence de colonne `summary`/`description` sur `Entity`/`World`** (gap
  découvert en cours d'implémentation, pas anticipé en Phase 0) : résumé replié
  comme premier paragraphe non-titré du corps, `description` du monde abandonné
  — tranché par Aymeric (AskUserQuestion, option recommandée), aucune migration
  de schéma cette session.
- **Couche service uniquement** : `createIntroWorld`/`createSeedEntity` sont des
  fonctions dédiées nouvelles (pas des paramètres optionnels ajoutés à
  `createWorld`/`createEntity`, déjà appelées par le chemin utilisateur normal) —
  `intro-world-service.ts` n'accède jamais directement à `prisma`.
- **`playwright.config.ts` restructuré en deux projets** (`chromium` /
  `chromium-intro-world` avec `dependencies: ["chromium"]`) après qu'un run complet
  `--workers=2` a fait échouer deux tests préexistants (`link-highlight`,
  `link-ignore`) par contention de file de jobs, malgré le skip individuel de
  chaque test — décision prise après preuve empirique (run reproduit, pas supposé).

**Éléments notables / appris (gotchas) :**
- **Écart réel confirmé, anticipé avant exécution, pas un bug** : la paire
  `ath-lor-chant-vase` → `ath-lie-vhelmire` (73 arêtes réelles contre 74 attendues
  par la matrice bible) ne produit aucune relation — deux entités homonymes
  (« Vhelmire » ville et « Vhelmire » alias de lignée) matchent la même portée de
  texte, `resolve-links.ts` traite ce cas comme ambigu et ne crée aucun lien.
  Comportement réel du moteur, documenté tel quel (contrat de seed §C, cas 1).
- **Régression e2e invisible tant que les tests tournent séparément** : même
  après avoir fait sauter le seed intro sur les 9 autres specs e2e, le nouveau
  `intro-world.spec.ts` (25 jobs de liaison réels, volontairement non sauté)
  partage la même file pg-boss que n'importe quel autre test lancé en parallèle
  (`--workers=2`) — ses 25 jobs peuvent noyer le job spécifique d'un autre test
  au-delà de son propre timeout, indépendamment du fait que ce test saute son
  propre seed. Seule la mise en séquence stricte via `dependencies` Playwright
  élimine la contention. **Candidat skill** : tout test e2e qui enfile un volume
  inhabituel de jobs sur une file partagée doit être isolé dans son propre projet
  Playwright séquencé après le reste, pas seulement « sauté » par les autres
  tests.
- `@ts-expect-error` posé à l'intérieur d'un callback `mockImplementation` ne
  supprime rien si l'erreur de type surgit au niveau de l'appel
  `mockImplementation(...)` lui-même (un niveau au-dessus) — produit à la fois
  l'erreur d'origine et une erreur « directive inutilisée ». Corrigé par un cast
  direct de la valeur retournée (`as unknown as EntityRecord`), pas par la
  directive.
- Ajouter 3 fonctions de service neuves sans leurs tests fait chuter la
  couverture `src/services` de 98 %+ à 77,91 %, sous le seuil bloquant CLAUDE.md
  (≥80 %) — restaurée à 99,16 % après ajout des tests dédiés. Rappel que le seuil
  n'est jamais négociable même pour du code « mécanique ».

**Commandes utiles de la session :**
- `node --env-file=.env --import tsx prisma/seed/run.ts --owner-email=<email>`
  (alias `npm run seed:intro`) — CLI de seed idempotent, même patron que
  `npm run worker`, résout l'`ownerId` depuis un compte réel (jamais de ligne
  `User` fabriquée à la main).
- Script jetable (jamais committé) interrogeant directement `prisma.relation`
  du monde `origin: INTRO` pour recalculer les compteurs réels (arêtes, densité,
  intra-groupe, groupes touchés, entités à 0 entrante) contre la matrice de la
  bible, plutôt que de faire confiance aux chiffres théoriques.

**Livrables produits :**
- `prisma/seed/atheraus.json` (25 entités, 3 nœuds mention `seedRef`), `prisma/seed/run.ts`,
  `src/services/intro-world-service.ts` (+ test), `createIntroWorld` (`world-service.ts`
  + test), `createSeedEntity` (`entity-service.ts` + test), câblage `registerAction`
  (`src/actions/auth.ts` + test) et case à cocher (`register-form.tsx`),
  `e2e/intro-world.spec.ts`, `playwright.config.ts` (projets séquencés), 9 specs e2e
  existantes mises à jour (skip du seed), `docs/adr/0022-monde-introduction-atheraus.md`,
  `docs/cahier-recettes.md` (`TST-AUT-009`, `TST-LNK-009`, `TST-QOT-003` mis à jour),
  `CHANGELOG.md`.
- Compteurs réels mesurés sur le monde seedé (vs matrice bible §E) : **73 arêtes**
  (bible : 74, écart documenté ci-dessus), **densité 2,92** (bible : 2,96),
  **intra-groupe 8,2 %** (bible : 8,1 %), **0 entité à 0 entrante**, **0 paire
  réciproque**, **MANUAL=3 / AUTO=70**, fiche « Ordre du Verbe Clos » : **8
  citations sortantes / 5 groupes distincts** (exact, match bible), « Elenya
  Vhelmire » : **11 entrantes / 16 au total** (exact, match bible). Chaque groupe
  touche au moins 5 autres groupes (seuil ≥3 largement dépassé). **Registre des
  liens à désactiver : toujours « Néant »** — aucune arête surnuméraire trouvée,
  aucune désactivation nécessaire.
- Gates finaux : lint ✅ (0 warning) · `tsc` ✅ · tests unitaires ✅ (couverture
  `src/services` 99,16 %, globale 98,12 %) · e2e 11/11 ✅ (`chromium-intro-world`
  en dernier, 12,4 s) · build ✅.

**Avancement certification :**
- **C2.2.1 (architecture)** : seed entièrement porté par la couche service,
  aucun accès `prisma` direct hors service — ADR-0022.
- **C2.2.2 (tests)** : 3 nouvelles fonctions de service testées unitairement,
  couverture restaurée après une chute passagère sous le seuil bloquant.
- **C2.3.1 (recette)** : `TST-AUT-009` (inscription → monde d'intro peuplé,
  opt-out), `TST-LNK-009` (re-scan → MANUAL survit sur le monde seedé) ajoutés ;
  `TST-QOT-003` passe de « vérifié unitairement seulement » à « vérifié en
  conditions réelles pour INTRO ».
- **C2.4.1 (traçabilité)** : ADR-0022 (arbitrage fonction partagée vs template
  en base, décisions du 18/07 sur `WorldOrigin`/`seedRef`/`AliasSource`).

**À faire / suite :**
- **Vérification manuelle par Aymeric** (jamais Claude in Chrome) : inscription
  neuve → Atheraus présent et peuplé → Constellation dense → surlignage sur la
  fiche « Ordre du Verbe Clos » → case de saut fonctionnelle → suppression du
  monde fonctionnelle.
- Housekeeping local (pas livré) : comptes de test restés en base de dev
  (`kan35-seed-verif-*@story-tide.test` + son monde Atheraus et 3 mondes USER,
  `shape-check-*@story-tide.test`) — à purger si souhaité, sans impact sur le
  livrable.
- Commits à préparer par Claude puis exécuter par Aymeric (`feat: seed`,
  `feat: câblage`, `docs:`).
- Reporter cette entrée dans `dev-log.md` (hors repo) + redéposer dans le projet
  Claude.
- Mettre à jour le board Jira (KAN-35 → colonne appropriée).

---

**Décisions techniques**

| Date | Décision | Alternatives | Justification |
|---|---|---|---|
| 2026-07-22 | Diagnostic par preuve (logs temporaires + script Playwright jetable) avant tout correctif | Continuer à itérer sur des hypothèses serveur (`revalidatePath`) | Deux tentatives précédentes avaient échoué sans identifier le vrai coupable — process explicitement imposé par Aymeric pour éviter une 3ᵉ tentative aveugle |
| 2026-07-22 | `entity-search.tsx` : dérivation directe des props hors recherche active, résultats serveur en state uniquement pendant une recherche | Copier systématiquement en state (comportement précédent, cause du bug) | Une recherche interroge réellement le serveur (`searchEntitiesAction`, KAN-17) — ne peut pas être une pure dérivation ; la liste par défaut, elle, le peut et le doit |
| 2026-07-22 | Normalisation NFC à la frontière (persistance : nom/alias, corps Tiptap), jamais dans `normalize.ts`/`aho-corasick.ts` | `.normalize("NFC")` ajouté dans `normalizeForMatch` ; correction par carte d'index dans le moteur | Un `.normalize("NFC")` dans le pipeline de matching romprait le même invariant d'alignement des index, juste déplacé ; la carte d'index est hors périmètre avant le gel du moteur (100 % testé, gelé pour la certification) |
| 2026-07-22 | Un seul `router.refresh()` après autosave pour rafraîchir « Renvois » | Second refresh différé (~2-3 s) pour rattraper le délai des liens AUTO | Le délai résiduel AUTO est déjà documenté/accepté ailleurs dans le code ; un minuteur supplémentaire ajoute de la complexité (gestion/nettoyage/tests) pour un gain marginal |
| 2026-07-22 | Brouillon ADR orphelin réaffecté en ADR-0021 (statut « remplacé par ADR-0012 ») plutôt que supprimé | Suppression pure et simple du fichier orphelin | C2.4.1 : une décision écartée doit rester traçable, pas seulement les décisions retenues |
| 2026-07-22 | Monde d'introduction cloné par fonction partagée (`seedIntroWorld`), un monde `origin: INTRO` frais par compte | Monde template persisté en base + compte système, dupliqué à l'inscription | `World.ownerId` non-nullable (FK réelle) interdit tout monde partagé entre comptes ; évite un compte système à provisionner/protéger et un mécanisme de duplication générique (entités + relations AUTO/MANUAL) inexistant dans le code |
| 2026-07-22 | Case à cocher « Ne pas créer le monde d'exemple » décochée par défaut (opt-out) | Décochée par défaut nécessitant une action explicite pour l'obtenir (opt-in) | Le monde d'intro sert de vitrine immédiate du différenciateur produit — l'opt-out maximise la découverte sans bloquer les utilisateurs qui n'en veulent pas |
| 2026-07-22 | `playwright.config.ts` restructuré en deux projets (`chromium`/`chromium-intro-world`, `dependencies`) pour séquencer `intro-world.spec.ts` après le reste | Garder un seul projet, se fier au skip individuel des 9 autres specs | Le skip individuel n'empêche pas la contention : les 25 jobs enfilés par `intro-world.spec.ts` partagent la même file pg-boss que n'importe quel test lancé en parallèle, quel que soit qui les a déclenchés — seule la mise en séquence stricte élimine le flake, prouvé par un run complet reproduit |

**Erreurs rencontrées & Solutions**

| Date | Symptôme (message exact) | Cause | Solution |
|---|---|---|---|
| 2026-07-22 | Sidebar toujours périmée après création depuis le dashboard, malgré `revalidatePath("/(app)/worlds/[slug]", "layout")` (patron de route déjà corrigé) | Bug côté **client** : `useState(initialEntities)` dans `entity-search.tsx` ne se resynchronise jamais après le premier montage (composant persistant dans le layout du monde) | Suppression de la copie d'état — la liste par défaut dérive directement de la prop à chaque rendu |
| 2026-07-22 | `matches.find((m) => m.entityId === "robert")` renvoie `undefined` dans un test isolé du moteur, alors que « Robert » ne contient aucun accent | Une séquence NFD plus tôt dans le texte scanné (`normalizeForMatch` retire des marques combinantes, raccourcissant la chaîne normalisée par rapport à l'original) décale la vérification de frontière de mot (`isWordChar(text[start-1])`) sur un caractère de mot dans le texte ORIGINAL, rejetant le match | Normalisation NFC à la frontière (nom/alias à l'écriture, corps Tiptap à la sauvegarde) — le moteur ne reçoit plus jamais de texte NFD, l'invariant d'alignement (déjà vérifié pour du NFC) tient à nouveau |
| 2026-07-22 | Popup de suggestion `@` flouté/illisible malgré `className="z-50"` posé sur la racine JSX de `MentionList` | `z-50` posé sur un enfant du wrapper `<div class="react-renderer">` créé par `ReactRenderer` — c'est CE wrapper que `props.mount()` positionne et ajoute à `document.body`, pas l'élément stylé ; en plus, cet enfant est en `position: static` (`z-index` sans effet) | `className: "z-50"` passé au constructeur `ReactRenderer` (`mention-suggestion.ts`), appliqué au wrapper réellement positionné |
| 2026-07-22 | `e2e/link-ignore.spec.ts` échoue en CI (`toHaveText` reçoit le nom de la fiche source au lieu de la cible) alors que le test passe systématiquement en local | Clic sur un lien « Renvois » hors du bloc `toPass` qui vient de faire un `page.reload()` — page pas garantie pleinement interactive sur un runner CI plus lent (même mécanisme que `link-highlight.spec.ts` la veille) | Clic + assertion de navigation déplacés DANS le même bloc `toPass` que le `reload()` — un échec relance le cycle complet |
| 2026-07-22 | `link-highlight.spec.ts`/`link-ignore.spec.ts` échouent (`toPass({timeout:20_000})` dépassé) lors d'un run complet `--workers=2`, alors que chacun saute désormais son propre seed d'intro | Le nouveau `intro-world.spec.ts` (non sauté, volontaire) enfile 25 jobs de liaison réels sur la même file pg-boss partagée par tous les tests e2e, en parallèle des autres — ses jobs noient le job spécifique attendu par les deux tests avant leur propre timeout | `playwright.config.ts` restructuré en deux projets, `chromium-intro-world` déclaré `dependencies: ["chromium"]` — ce fichier s'exécute toujours strictement après tout le reste, jamais en même temps |
| 2026-07-22 | `@ts-expect-error` posé dans le `return` d'un callback `mockImplementation` produit à la fois l'erreur de type d'origine ET « Unused '@ts-expect-error' directive » | L'erreur de type surgit à l'appel de `mockImplementation(...)` lui-même (un niveau au-dessus du callback), pas dans le callback — la directive ne couvre pas la bonne ligne | Directive retirée, cast direct de la valeur retournée (`{ ... } as unknown as EntityRecord`) |
| 2026-07-22 | Couverture `src/services` chutée de 98 %+ à 77,91 % après l'ajout de `createIntroWorld`/`createSeedEntity`/`seedIntroWorld` | Trois fonctions de service neuves livrées sans test, seuil CI bloquant (≥80 %, CLAUDE.md) presque cassé | Tests dédiés ajoutés pour les trois fonctions (`world-service.test.ts`, `entity-service.test.ts`, nouveau `intro-world-service.test.ts`) — couverture restaurée à 99,16 % |

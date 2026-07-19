### Session — 2026-07-19 — KAN-18 quotas freemium + extension de schéma (WorldOrigin, table Alias, taxonomie 26 types)

**Thèmes abordés :**
- Confirmation du merge KAN-17 (recherche basique) sur `main`, séquence git complète donnée pour les prochains handoffs.
- KAN-18 (base) : quotas freemium — 3 mondes/compte, 50 entités/monde, sans Stripe.
- KAN-18 (extension, cadrage de session le jour même) : `WorldOrigin` enum (remplace un booléen `isIntroWorld` posé puis abandonné avant tout commit), table `Alias` dédiée (remplace `Entity.aliases String[]`), `Entity.seedRef`, taxonomie de types 5→26 regroupés en 8 familles, combobox de type interne, coloration/filtre du graphe par famille.

**Décisions prises :**
- Chiffres de quota (3 mondes, 50 entités/monde) — arbitraire, aucune donnée d'usage — Aymeric, `src/lib/quotas.ts`.
- Quota appliqué en **couche service** (exception typée `WorldQuotaExceededError`/`EntityQuotaExceededError`), pas dans l'action — alternative écartée : vérification dans l'action (patron `MAX_CONTENT_JSON_BYTES`), rejetée car contournable par un futur appelant hors UI. Proposé en plan, validé par Aymeric.
- `enum WorldOrigin { USER, INTRO, DEMO }` remplace le booléen `isIntroWorld` initialement posé — Aymeric, en cours de cadrage : un booléen ne distingue pas le monde d'intro par utilisateur (KAN-35) du compte de démonstration jury (DEMO), deux concepts distincts qui doivent tous deux être hors quota.
- `Entity.aliases` migré en table `Alias` dédiée (value/normalized/active/source) — Aymeric : les alias porteront des attributs propres (actif/inactif, source) et l'index sur la forme normalisée sert le chargement du dictionnaire Aho-Corasick. `Alias.source` posé en **enum dès maintenant** (`MANUAL`/`SEED`), pas en `String?` différé — Aymeric, via arbitrage explicite.
- Migration en **deux temps (expand/contract)** avec backfill SQL (extension Postgres `unaccent`) dans la seconde migration plutôt qu'un script Node séparé — parce que de vraies fiches de production ont déjà des alias renseignés (confirmé par Aymeric) et que le service `migrate` du pipeline CD (KAN-10) n'exécute que `prisma migrate deploy`, sans script à orchestrer.
- Sélecteur de type : **combobox interne** (patron `mention-list.tsx`) plutôt que shadcn/cmdk — shadcn est absent du stack aujourd'hui et KAN-36 (passe visuelle shadcn) arrive juste après ce sprint ; introduire la dépendance maintenant pour la jeter dans quelques jours a été jugé non pertinent. Décision d'Aymeric via arbitrage explicite, documentée dans ADR-0016 comme composant volontairement jetable.
- Couleur des nœuds du graphe **par famille** (8 teintes), pas par type individuel (26 teintes illisibles, C2.2.3) — palette validée par le skill `dataviz` du projet plutôt que des hex choisis à l'œil.

**Éléments notables / appris (gotchas) :**
- Prisma Migrate a un garde-fou natif qui détecte l'invocation par un agent IA et bloque toute commande destructrice (`migrate reset --force`) : « Prisma Migrate has detected that it was invoked by Claude Code. [...] You must stop at this point and respond to the user ». Contournement légitime : `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="<message exact de consentement>"`. Le **classifieur du harness Claude Code a ensuite aussi bloqué la commande** malgré ce consentement (« Permission for this action was denied by the Claude Code auto mode classifier ») — Aymeric a dû exécuter `prisma migrate reset` lui-même dans son propre terminal. Double garde-fou à anticiper pour toute session touchant un schéma Prisma.
- `prisma migrate dev --create-only` échoue en environnement non interactif dès qu'un warning existe (ex. ajout d'une contrainte unique) : « Prisma Migrate has detected that the environment is non-interactive, which is not supported. » Contournement : générer le SQL via `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` (pas de shadow DB nécessaire, introspecte directement la DB courante), écrire le dossier de migration à la main, puis appliquer avec `npx prisma migrate deploy` (non interactif par conception).
- `prisma migrate diff --from-migrations` exige `datasource.shadowDatabaseUrl` dans `prisma.config.ts` (absent du projet) — évité en utilisant `--from-config-datasource` à la place (diff contre la DB dev réelle, pas contre un rejeu de migrations).
- `--to-schema-datamodel` a été retiré de cette version de Prisma CLI (7.8.0) : message d'erreur explicite pointant vers `--to-schema`/`--from-schema`.
- Backfill `Alias` vérifié manuellement en conditions réelles avant de faire confiance à la migration : seed direct via `psql` d'un alias accentué (« Néron le Terrible »), application de la migration, comparaison de la colonne `normalized` produite par `unaccent()`+`lower()` avec la sortie de `normalizeForMatch()` en JS — résultat identique sur ce cas réaliste.
- `EntityTypeCombobox` : un vrai bug UX découvert en écrivant les tests, pas en le devinant — l'ouverture du combobox (focus/clic) filtrait immédiatement la liste par le libellé du type déjà sélectionné (`query` démarre non vide), rendant impossible la navigation clavier depuis la sélection courante (ArrowDown restait bloqué sur la seule option correspondante). Corrigé : le filtre ne s'active que si le texte affiché diverge du libellé de la sélection courante ; `activeIndex` s'initialise sur l'index du type déjà sélectionné à l'ouverture (pas toujours 0).
- `screen.getByLabelText("Type")` ambigu dans les tests Testing Library : la `<div role="listbox" aria-label="Type">` matche aussi bien que le vrai `<input>` du combobox. Corrigé en interrogeant `getByRole("combobox", { name: "Type" })`.
- `e2e/graph.spec.ts` utilisait `.selectOption("place")` sur l'ancien `<select>` natif — cassé net par le passage au combobox (« Element is not a `<select>` element »), corrigé avec le patron click+fill+click-option déjà utilisé par les autres specs.

**Commandes utiles de la session :**
- `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` — génère le SQL de migration sans DB fantôme ni mode interactif ; utile pour écrire à la main une migration avec une étape de données personnalisée (backfill) entre deux états du schéma.
- `npx prisma migrate deploy` — applique les migrations en attente sans prompt, y compris quand `migrate dev` refuse l'environnement non interactif.
- `docker exec story-tide-postgres-1 psql -U story_tide -d story_tide -c "..."` — requêtes manuelles de vérification/seed sur la DB dev (mot de passe/rôle : voir `DATABASE_URL` dans `.env`, pas `postgres`).
- `node scripts/validate_palette.js "<8 hex>" --mode dark` (skill `dataviz`, exécuté depuis son propre répertoire) — valide une palette catégorique (bande de luminosité, plancher de chroma, séparation CVD, plancher vision normale, contraste) avant de l'utiliser dans un rendu de données.

**Livrables produits :**
- Schéma : `enum WorldOrigin`, `enum AliasSource`, `model Alias`, `Entity.seedRef` — 2 migrations (`20260719160258_kan18_schema_expand`, `20260719160400_kan18_alias_backfill_and_drop` avec backfill `unaccent`).
- Services : `world-service.ts` (`WorldQuotaExceededError`, comptage `origin: USER`), `entity-service.ts` (`EntityQuotaExceededError`, `EntityRecord`/`toEntityRecord`, écriture imbriquée des alias), `linker-service.ts` (`buildDictionary` sur la relation `Alias`).
- `src/lib/quotas.ts` (nouveau), `src/lib/entity-schemas.ts` (taxonomie 26 types/8 groupes, `groupedEntityTypes`, `entityTypeGroup`).
- UI : `EntityTypeCombobox` (nouveau composant + test), `create-entity-form.tsx`/`edit-entity-form.tsx` (branchement), `graph-view.tsx` (couleur/filtre par groupe).
- Tests : `world-service.test.ts`, `entity-service.test.ts`, `linker-service.test.ts`, `relation-service.test.ts`, `entity-schemas.test.ts`, `entity-type-combobox.test.tsx` — tous mis à jour/étendus.
- e2e : `e2e/quota.spec.ts` (nouveau, quota mondes + entités avec seed direct des 49 premières fiches), `e2e/graph.spec.ts` (corrigé pour le combobox).
- Docs : ADR-0014 (réécrit), ADR-0015 et ADR-0016 (nouveaux), `docs/adr/README.md`, `docs/securite-owasp.md` (A04), `docs/cahier-recettes.md` (`TST-QOT-001` à `003`, `TST-ENT-009`, `TST-GRF-004`), `CHANGELOG.md`, `docs/spec-technique-bloc2.md` (esquisse Prisma §4.3 mise à jour).
- Gates : lint ✅ 0 warning · typecheck ✅ · tests ✅ 280/280 · couverture **98,63 %** · build ✅ · e2e ✅ 8/8.

**Avancement certification :**
- **C2.2.1** (architecture) : quotas en couche service (pas dans l'action) ; `Alias` modélisé en relation dédiée plutôt qu'un tableau opaque ; procédure de migration expand/contract documentée et éprouvée en conditions réelles.
- **C2.2.2** (tests) : couverture maintenue à 98,63 % (seuil bloquant 80 %) malgré un refactor de schéma conséquent ; aucun test désactivé, tous mis à jour.
- **C2.2.3** (sécurité + accessibilité) : OWASP A04 étendu (quotas anti-abus, non contournables) ; combobox de type au clavier complet, palette de graphe validée (contraste/CVD), fieldsets/legend natifs pour le regroupement des filtres.
- **C2.3.1** (recette) : `TST-QOT-001` à `003`, `TST-ENT-009`, `TST-GRF-004` ajoutés au cahier de recettes.
- **C2.4.1** (traçabilité) : ADR-0014 (révisé), ADR-0015, ADR-0016 — trois décisions distinctes documentées séparément.

**À faire / suite :**
- **Rien n'est committé** pour l'ensemble de cette session (KAN-18 base + extension) — commandes de commit/push/PR fournies séparément dans la conversation, à exécuter par Aymeric.
- KAN-35 (monde d'intro "Atheraus") pourra poser `origin: INTRO` et `seedRef` sans retoucher `world-service.ts`/`entity-service.ts`.
- Compte de démonstration jury (`origin: DEMO`) reste à provisionner quand décidé — aucune logique supplémentaire à écrire, juste créer le monde avec cette valeur.
- KAN-36 (passe visuelle shadcn) devra remplacer `EntityTypeCombobox` par le `Command` shadcn (ADR-0016) — ne pas le faire cohabiter indéfiniment.
- Reporter cette entrée dans `dev-log.md` (hors repo) + redéposer dans le projet Claude.
- Mettre à jour le board Jira (KAN-17 → Done si pas déjà fait, KAN-18 → en revue une fois la PR ouverte).

---

**Décisions techniques**

| Date | Décision | Alternatives | Justification |
|---|---|---|---|
| 2026-07-19 | Quota en couche service (exception typée), pas dans l'action | Vérification dans l'action (patron `MAX_CONTENT_JSON_BYTES`) | Non contournable par un futur appelant hors UI (API, script) |
| 2026-07-19 | `enum WorldOrigin { USER, INTRO, DEMO }` plutôt qu'un booléen `isIntroWorld` | Booléen `isIntroWorld` (posé puis abandonné avant commit) | Distingue le monde d'intro (KAN-35) du compte démo jury (DEMO), deux concepts différents |
| 2026-07-19 | `Alias` en table dédiée avec `source` enum dès maintenant | `String[]` conservé ; `source` en `String?` différé | Attributs propres (actif/source) + index normalisé pour l'AC ; sémantique figée tout de suite plutôt que redifférée |
| 2026-07-19 | Migration expand/contract en 2 temps, backfill SQL `unaccent` intégré à la migration | Script Node de backfill orchestré séparément | Préserve les vraies données de prod sans complexifier le pipeline CD (`migrate` = `prisma migrate deploy` seul) |
| 2026-07-19 | Combobox de type interne (patron `mention-list.tsx`) | Introduire shadcn/cmdk dès ce ticket | KAN-36 (passe shadcn) arrive dans quelques jours — éviter un composant jeté immédiatement |
| 2026-07-19 | Couleur du graphe par famille (8 teintes), pas par type (26) | Garder une couleur par type individuel | 26 teintes illisibles/intenables côté contraste (C2.2.3) ; palette validée par le skill `dataviz` |

**Erreurs rencontrées & Solutions**

| Date | Symptôme (message exact) | Cause | Solution |
|---|---|---|---|
| 2026-07-19 | « Prisma Migrate has detected that it was invoked by Claude Code. [...] You must stop at this point » | Garde-fou natif Prisma contre les actions destructrices lancées par un agent IA | Demander le consentement explicite à l'utilisateur, rerun avec `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="<message exact>"` |
| 2026-07-19 | « Permission for this action was denied by the Claude Code auto mode classifier » (sur `prisma migrate reset --force`, malgré le consentement Prisma) | Second garde-fou côté harness, indépendant de celui de Prisma | Aymeric exécute la commande lui-même dans son propre terminal |
| 2026-07-19 | « Prisma Migrate has detected that the environment is non-interactive, which is not supported » (sur `migrate dev --create-only` dès qu'un warning existe) | `migrate dev` exige une confirmation interactive dès qu'un warning de perte de données potentielle apparaît | Générer le SQL via `migrate diff --from-config-datasource --to-schema ... --script`, écrire la migration à la main, appliquer via `migrate deploy` (non interactif) |
| 2026-07-19 | « You must set `datasource.shadowDatabaseUrl` in your `prisma.config.ts` if you want to diff a migrations directory » | `migrate diff --from-migrations` a besoin d'une shadow DB pour rejouer l'historique | Utiliser `--from-config-datasource` (diff contre la DB dev réelle directement, pas de shadow DB nécessaire) |
| 2026-07-19 | `--to-schema-datamodel` was removed | Flag renommé dans Prisma CLI 7.8.0 | Utiliser `--to-schema`/`--from-schema` |
| 2026-07-19 | Test Testing Library : `getByLabelText("Type")` résout à 2 éléments | La listbox du combobox porte aussi `aria-label="Type"` | Requêter `getByRole("combobox", { name: "Type" })` |
| 2026-07-19 | `e2e/graph.spec.ts` : « Element is not a `<select>` element » sur `.selectOption("place")` | Le `<select>` natif a été remplacé par `EntityTypeCombobox` | Réécrire l'interaction en click+fill+click-option (patron déjà utilisé ailleurs) |
| 2026-07-19 | Bug UX découvert par le test, pas deviné : ArrowDown ne bougeait pas la sélection active du combobox de type | `query` démarre au libellé déjà sélectionné → le filtre s'applique dès l'ouverture et ne laisse qu'une option | Filtre actif seulement si le texte affiché diverge du libellé de la sélection courante ; `activeIndex` initialisé sur l'item déjà sélectionné à l'ouverture |

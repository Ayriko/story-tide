### Session — 2026-10-24 — KAN-87 lot C1 : la page d'un monde devient la Constellation

**Thèmes abordés :**
- Modèle `Board` / `BoardNode` : disposition, zoom et cadrage gardés au niveau du monde, tableau par défaut créé à la première visite.
- Service et actions de disposition (A01 : même monde vérifié en service), sans `revalidatePath`.
- Réécriture de `GraphView` : instance créée une fois, mise à jour par différence, placement incrémental fcose avec les étoiles connues fixées.
- Liaison de deux entrées par geste (cytoscape-edgehandles), avec type et sens choisis dans une boîte.
- Filtres par type d'entrée et par type de relation, isoler / masquer sur 1, 2, 3 sauts ou tous, mémorisés par monde.
- Page `/worlds/[slug]` en plein écran ; `/graph` redirige vers elle (308).
- Cinq passes de validation manuelle par Aymeric sur l'interface, puis les gates et 4 commits.

**Décisions prises :**
- **Disposition en tables `Board` / `BoardNode`**, au niveau du monde. Écartés : JSON sur `World` (course entre onglets, positions orphelines), positions par utilisateur (contraire au partage public prévu), `localStorage` (perdu en changeant d'appareil). ADR-0032, proposé par Claude et validé par Aymeric.
- **Index unique partiel et `CHECK` du cadrage écrits à la main** dans la migration (Prisma ne sait pas les déclarer). Le diff `migrate diff --from-config-datasource` reste vide. Proposé par Claude, validé.
- **Pas de clé étrangère composite monde / entrée** : `board-service` compte les entrées `{ id in ids, worldId }` avant d'écrire et répond « Entrée introuvable. » sinon, comme pour une entrée qui n'existe pas. Proposé par Claude, validé.
- **Clic = sélection** (carte ancrée à l'étoile), **double-clic = fiche**. Le menu du clic droit a d'abord été prévu, puis retiré à la 4e passe. Tranché par Aymeric.
- **Plein écran par égalité exacte** sur `/worlds/<slug>` (`isWorldRootPath`, testé). Avec un « commence par », les fiches et les paramètres seraient aussi passés en plein écran. Tranché par Aymeric.
- **Le sens d'une relation n'est jamais déduit du geste** : la boîte propose les deux phrases. Formulaire en `onSubmit` + `useTransition`, et non en `<form action>`, parce que React 19 réinitialise le formulaire après l'action et qu'une erreur « doublon » aurait effacé le choix. Proposé par Claude, validé.
- **Toasts dans une région locale** (`role="status"`), sans dépendance. Tranché par Aymeric.
- **edgehandles 4.0.1** retenu, bien que plus publié depuis 2021 (MIT, stable). Il ne fournit plus la poignée au survol : c'est un nœud maison qui la remplace. Tranché par Aymeric.
- **Interface** (décidée pendant les validations, par Aymeric) :
  - grand titre posé sur le canvas, sans fond pour C1 ; le voile radial derrière le titre est reporté à C2 ;
  - pilules « Filtres », « Récents », « Fils », un panneau ouvert à la fois ;
  - bouton rond « Nouvelle entrée » (raccourci N) ;
  - raccourcis `+ - 0` sans modificateur ;
  - sidebar repliée par défaut sur la page du monde ;
  - libellés d'arête visibles à partir du zoom 1.
- **Exceptions au périmètre C2** accordées par Aymeric : surface en verre (jetons `--glass-*`) et ombre du titre (`--canvas-text-shadow`).
- **4 commits au lieu des 8 du plan** : `GraphView` a été réécrit d'un seul tenant, donc l'interface ne se découpait pas en commits qui compilent chacun. Proposé par Claude, accepté par Aymeric.

**Éléments notables / appris (gotchas) :**
- **Crochet e2e présent dans le bundle de prod.** Le plan affirmait que `process.env.NEXT_PUBLIC_E2E_HOOKS === "1"` serait éliminé au build. C'était faux : Next n'inline une variable `NEXT_PUBLIC_*` que si elle existe au moment du build ; sinon la branche reste. Solution : la déclarer dans `next.config.ts` (`env: { NEXT_PUBLIC_E2E_HOOKS: process.env.NEXT_PUBLIC_E2E_HOOKS ?? "" }`). Vérifié : 0 occurrence dans `.next/static`. **Candidat skill.**
- **`min-zoomed-font-size` de Cytoscape ne sert pas de seuil de zoom fiable** : la valeur est arrondie à une puissance de deux et multipliée par `devicePixelRatio`. Remplacé par une classe `is-zoomed-in` posée selon `cy.zoom()`. **Candidat skill.**
- **Cytoscape retire le focus au `mousedown`** : après un clic sur le canvas, les raccourcis clavier ne répondaient plus. La zone reprend le focus sur `onPointerUpCapture`.
- **La poignée de liaison disparaissait** après un clic sur une étoile ; elle est réaffichée sur l'événement `free`.
- **`npx shadcn add tooltip`** a de nouveau généré `import { cn } from "cn"` et ajouté une dépendance `cn` : import corrigé, `npm uninstall cn` (skill `shadcn-add-cn-import-parasite`).
- **Avertissement React de clé unique** (« Each child in a list should have a unique "key" prop »). Cause : l'élément serveur `recent`, passé dans un tableau d'enfants. Solution : `toolContent()` renvoie un seul enfant.
- **Premier run e2e complet : 2 échecs, tous deux dans les tests.**
  - « Annuler » était ambigu : celui de l'AlertDialog, encore dans le DOM pendant sa fermeture, et celui du toast. Le test attend maintenant que la confirmation soit masquée.
  - Le double-clic tombait sur la carte de sélection : la sidebar s'ouvre après l'hydratation (préférence stockée, transition de 200 ms) et décale le canvas de 288 px. Les tests attendent désormais des positions stables à l'écran avant de cliquer.
- **Faux 404 sur la fiche** dans un run e2e lancé juste après `npm run build` : le build invalide le cache `.next/dev` (règle 4 du skill `e2e-run-hygiene-windows`, confirmée). Relancé une fois le cache reconstruit : vert.
- **Script de preuve SQL** : la table des utilisateurs est `"user"` (nom mappé), pas `"User"`.
- **Tous les bash heredocs Python d'une même commande** ont mal été parsés : les scripts sont écrits dans le scratchpad puis lancés.
- **Un `git rm` lancé par erreur a écrit dans l'index** : annulé avec `git restore --staged`. Leçon : supprimer un fichier avec `rm` (ou l'outil de fichiers), jamais avec `git rm`, puisque Claude n'écrit pas dans l'index.
- **Process orphelins** (`next dev`, workers e2e) encore présents après chaque run, même réussi : tués à chaque fois (skill `windows-orphan-node-e2e-cleanup`).
- Les captures CDP qui expirent viennent du navigateur ralenti quand sa fenêtre n'est pas au premier plan (2 images/s, même sur `/worlds`), pas de l'application.

**Commandes utiles de la session :**
- `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` — doit être vide après une migration avec SQL écrit à la main (index partiel, `CHECK`).
- `npx playwright test --workers=1 > e2e-run.log 2>&1` — suite e2e complète, sortie vers un fichier.
- `grep -rl "__storyTideConstellation" .next/static` — après `npm run build` : vérifie que le crochet e2e est absent du bundle.

**Livrables produits :**
- Commits (faits par Aymeric sur `feat/kan-87-constellation-c1`) :
  - `0fb0db0 feat(constellation): modele Board/BoardNode et service de disposition`
  - `144557c feat(constellation): diff des elements, filtres, liaison et placement de la carte`
  - `c3902e5 feat(constellation): la page d'un monde devient la Constellation`
  - `d1b057c docs(constellation): ADR-0032, OWASP A01, cahier, architecture, manuel, RGAA, CHANGELOG`
- Migration `20261024120000_kan87_constellation_boards`, appliquée. Preuve en `BEGIN … ROLLBACK` : 2e tableau par défaut refusé, cadrage partiel et zoom 0 refusés, cascades entrée → position et monde → tableaux.
- Dépendances (versions exactes) : `cytoscape-fcose@2.2.0`, `cytoscape-edgehandles@4.0.1`, `@types/cytoscape-fcose@2.2.5`, `@types/cytoscape-edgehandles@4.0.5`.
- Docs : `docs/adr/0032-disposition-de-la-constellation.md` (nouveau), `docs/securite-owasp.md` (A01, TST-SEC-018), `docs/cahier-recettes.md` (TST-GRF-006 à 010, TST-MND-014/015, TST-SEC-018, notes sur GRF-001 et MND-006 à 008), `docs/architecture.md`, `docs/manuels/utilisation.md` (§ 2.3), `docs/accessibilite-rgaa.md`, `CHANGELOG.md` (`[Unreleased]`).
- Gates : lint ✅ (0 avertissement) · typecheck ✅ · format ✅ · tests ✅ (1 002 tests, 94 fichiers) · couverture 98,29 % en lignes · e2e ✅ 35/35 (`--workers=1`) · build ✅.

**À faire / suite :**
- Pousser la branche (4 commits d'avance sur `origin`), ouvrir la PR, puis merger.
- Poster le commentaire Jira daté sur KAN-87 (texte proposé en fin de session).
- C2 (habillage) :
  - voile radial derrière le titre (contraste de 2,27 à 4,38:1 quand une étoile passe dessous) ;
  - contraste du texte gris dans les panneaux en verre (environ 3,7:1 sur une étoile pleine).
- Saut de la sidebar à l'ouverture de la page du monde (préférence lue après l'hydratation) : coupler la préférence au rendu serveur, ou couper la transition au premier affichage.
- Cahier : TST-GRF-002 à 004 décrivent encore « Observer les fils » et les anciennes pastilles. À réécrire si Aymeric le confirme.
- Recette staging des scénarios KAN-87 ; performance à 300 entrées non testée (hors périmètre).
- Données de dev : un cadrage a été enregistré sur le monde `test` pendant les essais.
- Reporter cette entrée dans dev-log.md (hors repo) + redéposer dans le projet Claude.
- Mettre à jour le board Jira (stories touchées → bonne colonne).

---

**Décisions techniques**

| Date | Décision | Alternatives | Justification |
|---|---|---|---|
| 2026-10-24 | **Disposition de la Constellation en tables `Board` / `BoardNode`, au niveau du monde, tableau par défaut créé à la demande** (ADR-0032) | JSON sur `World` ; positions par utilisateur ; `localStorage` | Intégrité référentielle (cascades), pas de course sur un JSON entier, disposition partagée avec l'œuvre, prêt pour plusieurs tableaux (lot D) |
| 2026-10-24 | **Index unique partiel + `CHECK` écrits à la main dans la migration** | Contrainte côté application seulement | Garantie en base (un seul tableau par défaut, cadrage cohérent) ; P2002 relu en cas de course |
| 2026-10-24 | **cytoscape-fcose 2.2.0 (`fixedNodeConstraint`) + cytoscape-edgehandles 4.0.1** | `cose` natif, cose-bilkent (sans contraintes) ; liaison maison | Seule mise en page qui garde fixes les étoiles connues ; edgehandles reste stable (MIT) |
| 2026-10-24 | **Variable `NEXT_PUBLIC_*` de test déclarée dans `next.config.ts` `env` avec `""` par défaut** | Lecture directe de `process.env` | Sans valeur au build, Next ne l'inline pas et la branche reste dans le bundle de prod |

**Erreurs rencontrées & Solutions**

| Date | Symptôme (message exact) | Cause | Solution |
|---|---|---|---|
| 2026-10-24 | Code du crochet `__storyTideConstellation` trouvé dans `.next/static` après `npm run build` | `NEXT_PUBLIC_E2E_HOOKS` absente au build, donc non inlinée | `env` dans `next.config.ts`, avec `""` par défaut |
| 2026-10-24 | Libellés d'arête affichés ou masqués au mauvais niveau de zoom | `min-zoomed-font-size` arrondi à une puissance de deux et multiplié par `devicePixelRatio` | Classe `is-zoomed-in` posée selon `cy.zoom()` |
| 2026-10-24 | Raccourcis `+ - 0` sans effet après un clic sur le canvas | Cytoscape retire le focus au `mousedown` | La zone reprend le focus sur `onPointerUpCapture` |
| 2026-10-24 | e2e : double-clic sur une étoile qui ouvre la carte au lieu de la fiche | La sidebar s'ouvre après l'hydratation (+288 px, transition de 200 ms) | Attendre des positions stables à l'écran avant de cliquer |
| 2026-10-24 | 404 sur la fiche dans un run e2e lancé juste après `npm run build` | Cache `.next/dev` invalidé par le build | Build en dernier dans les gates ; relancer une fois le cache reconstruit |

> Pas encore committé : cette entrée de dev-log. La branche `feat/kan-87-constellation-c1` n'est pas encore poussée (4 commits d'avance).

### Session — 2026-08-13 — KAN-45 : footer, mentions légales et canal de contact bêta

**Thèmes abordés :**
- Exploration parallèle (2 agents Explore) des layouts existants, du wording
  produit, des conventions de test/couverture, du cahier de recettes et de la
  charte de couleurs avant toute écriture de code.
- Plan mode : arbitrage de 6 questions avec Aymeric (2 tours d'AskUserQuestion)
  sur l'identité éditeur, la formulation RGPD, le point de rendu du footer
  côté public (pas de landing), la place du footer dans l'app contrainte en
  hauteur (`h-dvh overflow-hidden`), et l'arbitrage cahier de recettes.
- Implémentation du composant `Footer`, de l'indice de défilement `ScrollHint`,
  de la page `/mentions-legales`, et de la documentation associée (manuel,
  CHANGELOG, RGAA, OWASP, cahier de recettes).
- Gates complets (lint, typecheck, format:check, tests, couverture, e2e,
  build) + vérification structurelle du rendu (curl, pilotage Chrome écarté
  par Aymeric en cours de session).
- Retour visuel d'Aymeric (`docs/captures-front/capture-footer.PNG`) : 3
  correctifs (espacement du chevron, chevron rendu réellement cliquable,
  pied de page visible sans défiler sur `/login` et les pages de monde).
- **Nouveau process de travail adopté cette session** (consigne Aymeric) :
  sur un changement visuel/fonctionnel, attendre sa validation manuelle
  avant de lancer e2e/gates complets/devlog — implémenter, `npm run dev`,
  transmettre l'URL, attendre. Mémoire projet mise à jour
  (`feedback-wait-for-manual-review-before-gates.md`).
- 3ᵉ retour visuel (`capture-footer2.PNG`, `capture-footer3.PNG`) : scrollbar
  visible à masquer, chevron à transformer en vrai bouton à bascule
  (ouvre/ferme), rectangle de couleur différente en bas-gauche à
  diagnostiquer — identifié comme l'indicateur de développement Next.js
  (confirmé via Context7, pas une supposition), désactivé.
- 4ᵉ retour : adresse `contact@storytide.fr` à afficher en toutes lettres
  dans le lien Contact du footer, pas un libellé qui la masque.
- Une fois la review validée : gates complets rejoués intégralement (lint,
  typecheck, format:check, 429 tests + couverture, 11 e2e, build), docs
  RGAA/CHANGELOG mis à jour pour refléter le comportement final réel.

**Décisions prises :**
- **Footer public sur `(auth)` (login/register), pas de landing créée** —
  `/` est un simple `redirect()`, la landing est classée post-MVP dans
  `docs/design/reference-vvd.md`. Créer une landing dépassait largement le
  périmètre KAN-45. Tranché par Aymeric.
- **Footer dans l'app : pas de barre permanente, contenu en bas du scroll +
  chevron discret** (retour Aymeric après une première proposition de barre
  fixe). A forcé un changement de structure : le conteneur défilant, qui
  vivait sur `<main>` (`world-shell.tsx`, `worlds/page.tsx`), a dû être
  déplacé pour englober `<main>` **et** `<footer>` comme frères — un
  `<footer>` imbriqué dans `<main>` perd son rôle implicite `contentinfo`
  (exigence RGAA du brief). Alternative écartée pour le chevron :
  `IntersectionObserver` + composant client — non retenue, principe
  « simplicité d'abord ».
- **Chevron corrigé en cours de session, sur retour visuel d'Aymeric**
  (`docs/captures-front/capture-footer.PNG`) : la première version
  (`aria-hidden`, `pointer-events-none`, purement décorative) collait à la
  bordure du pied de page et ressemblait déjà à un bouton sans en être un —
  « il faudrait que cette flèche se comporte comme un bouton vu qu'elle y
  ressemble ». Corrigé en un **vrai lien** natif vers l'ancre `#site-footer`
  (id exporté par `footer.tsx`, `FOOTER_ID`, partagé pour ne jamais
  diverger), nom accessible « Aller au pied de page », marge (`mb-4`) pour
  l'espacement, `scroll-smooth` (CSS) sur le conteneur défilant pour
  l'animation — **toujours zéro JavaScript custom**, seulement plus
  purement décoratif. Tranché par Aymeric.
- **Pied de page masqué par défaut sur `/login`/`/register` et
  `/mentions-legales` aussi, pas seulement dans l'app** (même retour
  visuel) : `/worlds` était déjà correct (`min-h-full` sur `<main>`
  contraint par `h-dvh` en amont) ; les pages `(auth)` et
  `/mentions-legales` n'avaient **aucune** contrainte de hauteur de
  viewport (`(auth)/layout.tsx` n'avait pas `h-dvh`, contrairement à
  `(app)/layout.tsx`) — le pied de page s'affichait donc entièrement dans
  le flux normal du document dès que le viewport était assez haut. Les deux
  restructurés avec le même patron que l'app : `h-dvh` sur le conteneur
  racine + conteneur défilant dédié (`min-h-0 flex-1 overflow-y-auto`) +
  `min-h-full` sur le contenu centré. `/mentions-legales` n'était pas
  explicitement mentionnée par Aymeric mais partage le même chrome que
  `(auth)/layout.tsx` par construction (commentaire du fichier) — corrigée
  par cohérence, signalé plutôt que fait en silence. Sur `worlds/[slug]`
  (page d'un monde), le footer dépassait légèrement au premier écran faute
  de `min-h-full` sur `<main>` (contrairement à `worlds/page.tsx` qui
  l'avait déjà) — ajouté pour égaliser le comportement.
- **Identité éditeur : Aymeric Moiska, personne physique, sans adresse
  postale** (régime LCEN éditeur non professionnel, l'hébergeur OVHcloud
  détient l'identité complète). « Tidemark Studio » reste le nom du projet.
  Alternative écartée : afficher Tidemark Studio seul (jugé juridiquement
  trop faible, ni personne physique ni morale réelle) ou ajouter l'adresse
  personnelle (jugé disproportionné). Tranché par Aymeric.
- **Droit d'effacement formulé honnêtement** : par courriel à `contact@`,
  traité sous 30 jours, **suppression manuelle assumée** — aucune suppression
  de compte en autonomie n'est codée (vérifié : zéro `user.delete`
  applicatif dans le repo avant d'écrire la page). Tranché par Aymeric.
- **Un scénario `TST-SEC-016` créé, contrairement au précédent KAN-44**
  (qui n'avait délibérément rien ajouté au cahier de recettes). Différence
  assumée : KAN-44 portait sur de l'outillage interne qu'aucune des 7
  catégories ne couvrait ; `/mentions-legales` est une page publique visible
  par l'utilisateur, `SEC` s'y prête sans forcer (garde de session absente +
  `rel="noopener noreferrer", deux propriétés réellement falsifiables).
- **Pas d'ADR** — aucune décision d'architecture structurante : un composant
  présentationnel, une route statique, un déplacement local de conteneur
  défilant. Décision signalée dans ce dev-log plutôt que silencieuse.
- **Pilotage Chrome interrompu par Aymeric en cours de session** (« ne teste
  pas toi même via browser ça ne marche pas, je m'occupe des vérifs
  manuelles ») — remplacé par un contrôle structurel du HTML rendu via
  `curl` (présence du footer, des 3 liens, du `h1` unique), pas une
  vérification visuelle ni clavier réelle. Aymeric prend en charge la
  vérification visuelle/clavier en dev réel.
- **Scrollbar masquée (`.no-scrollbar`) plutôt que rethématisée** : le repo
  a déjà un précédent exactement inverse (`.themed-scrollbar`, Sidebar/
  dashboard, retour Aymeric antérieur qui voulait une scrollbar visible mais
  dans la charte navy/mint plutôt que blanc/gris par défaut) — ici Aymeric
  voulait au contraire n'en voir aucune. Les deux utilitaires cohabitent
  dans `globals.css`, chacun documenté avec sa justification, aucune
  contradiction : deux demandes différentes à des endroits différents.
- **`ScrollHint` : 3 itérations dans la même session sur le même
  composant** (décoratif → lien simple → bouton à bascule avec
  `IntersectionObserver`), toutes déclenchées par un retour visuel après
  capture d'écran plutôt que devinées à l'avance. Confirme la valeur du
  nouveau process (implémenter → dev réel → attendre le retour) : chaque
  itération aurait sinon fait rejouer gates/e2e/devlog pour rien.
- **`aria-expanded` délibérément écarté pour le bouton à bascule** : rien
  n'apparaît/disparaît du DOM (le footer y est déjà, juste hors du cadre
  visible) — poser `aria-expanded` aurait été un abus d'ARIA, même
  catégorie d'erreur déjà documentée dans `docs/accessibilite-rgaa.md`
  (`role="tab"` retiré d'`auth-tabs.tsx`, KAN-36). Le nom accessible change
  avec l'état à la place.
- **Diagnostic confirmé via Context7, pas deviné** : le rectangle bas-gauche
  + badge rond des captures 2/3 était candidat à plusieurs explications
  (bug de layout `h-dvh`/`min-h-0`, extension navigateur, artefact Next.js).
  Interrogation de la doc Next.js à jour (MCP Context7) plutôt que de
  supposer depuis la mémoire d'entraînement — a confirmé `devIndicators`
  (position par défaut `bottom-left`, désactivable via `devIndicators: false`)
  correspond exactement au comportement observé, avant d'écrire une seule
  ligne de correctif.
- **Session interrompue puis reprise (process Claude Code redémarré) juste
  après un `npx vitest run` sur 3 fichiers ciblés** : le run affichait
  `Worker exited unexpectedly` sur 2 des 3 fichiers, avec seulement 6/13
  tests rapportés passants — signal trompeur d'un artefact de l'interruption
  (dev server marqué "stopped" sans trace de complétion), pas une régression
  réelle. Confirmé en relançant proprement : 13/13 passent. Retenu : après
  toute reprise de session marquée par une notification "stopped"/sans
  trace de complétion, **rejouer proprement avant de diagnostiquer un run
  vitest qui semble avoir craché** plutôt que d'investiguer le crash lui-même.

**Éléments notables / appris (gotchas) :**
- **`ps aux | grep` (Git Bash) ne voit PAS les process Windows natifs** —
  un `until ! ps aux | grep -q "playwright"; do sleep 3; done` en
  arrière-plan a rendu `PLAYWRIGHT_DONE` immédiatement alors que le process
  (confirmé vivant via `Get-CimInstance Win32_Process` côté PowerShell)
  tournait encore ~1 min de plus. Aucune conséquence ici (juste relancé un
  poll côté PowerShell), mais un faux signal de complétion aurait pu faire
  lire un log e2e incomplet comme un run terminé. Contournement retenu :
  polling process côté **PowerShell** (`Get-CimInstance Win32_Process`),
  jamais `ps aux` de Git Bash, pour surveiller un process Windows natif lancé
  hors de ce shell.
- **1er run e2e : `AggregateError:` (message vide) très tôt dans le log**,
  avant même le premier test — cause : les containers Docker
  (`story-tide-postgres-1`, `story-tide-minio-1`) étaient arrêtés
  (`docker ps -a` → tous `Exited`), `global-setup.ts` échoue au
  `Client.connect()` de `pg` sur connexion refusée. Solution :
  `docker compose -f docker-compose.dev.yml up -d` avant tout run e2e. Pas
  un vrai piège Playwright — juste vérifier l'état Docker avant de blâmer le
  test. Candidat d'ajout à `e2e-run-hygiene-windows` (règle 1, « vérifier
  ports et orphelins ») : vérifier aussi l'état Docker, pas seulement les
  ports/process.
- **Orphelins confirmés après le run e2e réussi** (exactement le piège
  documenté par la skill `windows-orphan-node-e2e-cleanup`) : `worker.kill()`
  dans `global-setup.ts` n'a tué que le shell parent `npx tsx …`, 3 process
  node (`npx-cli.js`, `tsx/dist/cli.mjs`, le vrai process node avec
  `--require preflight.cjs`) sont restés vivants après la fin du run.
  Identifiés via `Get-CimInstance Win32_Process` (ligne de commande complète),
  tués via `taskkill //PID <pid> //F //T` (le `//T` a suffi à toute
  l'arborescence en une seule commande cette fois, malgré l'erreur
  `PowerShell not found` sur les PID déjà réaparentés/tués par le `/T` du
  premier appel).
- **Import relatif faux à l'écriture initiale** : `../../footer` depuis
  `world-shell.tsx` (à 3 niveaux de `src/app/footer.tsx`, pas 2 — le groupe
  de routes `(app)` compte comme un vrai niveau de dossier pour la
  résolution de module, même s'il est invisible dans l'URL). `tsc --noEmit`
  l'a immédiatement détecté (`TS2307`) — corrigé en `../../../footer`.
- Prettier a reformaté `mentions-legales/page.tsx` et `worlds/page.tsx` au
  premier `--write` (largeurs de ligne) — revérifié lint/typecheck après
  coup, rien cassé.
- **Dev server manuel oublié en arrière-plan (port 3000) a bloqué le 2ᵉ run
  e2e (port 3100)** : `next dev` pose un verrou **par projet, pas par
  port** (documenté par la skill `e2e-run-hygiene-windows`, mais découvert
  ici en pratique plutôt qu'en théorie) — un serveur de dev lancé pour la
  vérification manuelle, resté vivant, aurait fait échouer le `webServer`
  Playwright ciblant un port différent s'il n'avait pas été repéré et tué
  avant (`Get-NetTCPConnection -LocalPort 3000` puis
  `taskkill //PID <pid> //F //T`).

**Commandes utiles de la session :**
- `nslookup status.storytide.fr` — vérifier qu'un sous-domaine externe
  (Better Stack) résout avant de le lier en dur dans le footer, sans
  attendre le run e2e/la recette pour le découvrir cassé.
- `docker ps -a` — diagnostiquer un `AggregateError` vide de `pg` en
  `global-setup.ts` (containers arrêtés) avant de soupçonner Playwright.
- `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Select
  ProcessId,CommandLine` — seul moyen fiable de repérer un process Windows
  natif (orphelin ou non) que `ps aux` de Git Bash ne voit pas.
- `taskkill //PID <pid> //F //T` — tuer un orphelin **et** toute son
  arborescence en une seule commande (`//T`), plutôt qu'un PID à la fois.

**Livrables produits :**
- **Créés** : `src/app/footer.tsx` + `footer.test.tsx` (6 tests) ;
  `src/app/scroll-hint.tsx` + `scroll-hint.test.tsx` (2 tests) ;
  `src/app/mentions-legales/page.tsx` + `page.test.tsx` (5 tests) ; entrée
  `TST-SEC-016` (`docs/cahier-recettes.md`).
- **Modifiés** : `src/app/(auth)/layout.tsx` (footer ajouté, restructuré
  `h-dvh` + conteneur défilant, `no-scrollbar`/`data-scroll-container`) ;
  `src/app/(app)/worlds/page.tsx` et `worlds/[slug]/world-shell.tsx`
  (conteneur défilant déplacé au-dessus de `<main>`, footer + chevron
  ajoutés, `min-h-full`/`scroll-smooth`/`no-scrollbar`/`data-scroll-container`,
  commentaire KAN-39 volet 3 mis à jour) ; `src/app/globals.css`
  (`.no-scrollbar`) ; `next.config.ts` (`devIndicators: false`) ;
  `vitest.setup.ts` (polyfill `IntersectionObserver`) ; `CHANGELOG.md`
  (3 entrées sous `[Unreleased]` → `### Ajouté`, mises à jour à chaque
  correctif) ; `docs/manuels/utilisation.md` (nouvelle section 4, « Contact
  et mentions légales ») ; `docs/accessibilite-rgaa.md` (page ajoutée au
  périmètre audité + bullet dédié, mis à jour à chaque correctif) ;
  `docs/securite-owasp.md` (A05 : `rel="noopener noreferrer"`).
- **Gates (rejoués intégralement en fin de session, après validation
  visuelle d'Aymeric)** : lint ✅ (0 warning) · typecheck ✅ (0 erreur) ·
  format:check ✅ sur tous les fichiers touchés par cette session (le drift
  EOL pré-existant sur `main`, documenté depuis KAN-44, reste intact et non
  traité — hors périmètre) · tests ✅ (429/429, dont 13 nouveaux) ·
  couverture 98,34 % stmts / 95,31 % branches (seuil bloquant 80 % sur
  `src/lib`+`src/services` — `src/app` hors périmètre de couverture, sans
  impact) · e2e ✅ (11/11, dont le smoke
  `login → monde → fiche → éditeur → reload` qui exerce le nouveau
  conteneur défilant sur `/login` et sur une page de monde) · build ✅
  (`/mentions-legales` généré en statique, ○).
- Branche dédiée `feat/kan-45-footer-legal-contact`, poussée en premier
  (`git push -u`) avant tout commit — aucun commit effectué cette session
  (règle du projet). Message conventionnel proposé à Aymeric :
  `feat(app): footer, mentions légales et canal de contact bêta (KAN-45)`.

**Avancement certification :**
- **C2.2.2** (tests) : 11 tests unitaires nouveaux (`footer.test.tsx`,
  `mentions-legales/page.test.tsx`), colocalisés, conventions du repo
  respectées (requêtes par rôle, pas de `data-testid`).
- **C2.2.3** (sécurité + accessibilité) : `docs/securite-owasp.md` (A05,
  `rel="noopener noreferrer"`) et `docs/accessibilite-rgaa.md` (landmark
  `contentinfo`, lien externe annoncé, contrastes calculés par formule WCAG
  2.1 — pas à l'œil, ratios ≥ 4,65:1) mis à jour au fil de l'eau, comme
  l'impose CLAUDE.md.
- **C2.3.1** (recette) : `TST-SEC-016` ajouté au cahier, 6 champs + ligne
  Type/Statut, cas passant ET risque de régression identifié (garde de
  session absente).
- **C2.4.1** (traçabilité) : `docs/manuels/utilisation.md` tenu à jour
  (nouvelle section 4), `CHANGELOG.md` rédigé pour devenir tel quel la
  section `[1.3.0]` du premier tag automatisé (ADR-0024).

**À faire / suite :**
- Vérification visuelle d'Aymeric en dev réel : **validée** (3 tours de
  retours traités dans la session — espacement/clic du chevron, footer
  masqué par défaut, scrollbar/bouton à bascule/indicateur Next.js, adresse
  de contact en toutes lettres — 4ᵉ tour confirmé « c'est bon »).
- Aymeric : relire le diff, décider du commit (message proposé ci-dessus),
  puis `git push` + ouvrir la PR sur `feat/kan-45-footer-legal-contact`.
- Après merge : premier vol du circuit de release automatisé (ADR-0024) —
  `npm run release -- 1.3.0-rc.1` (staging + job `release-consistency`),
  puis `npm run release -- 1.3.0` (prod), captures pour le dossier B4, mail
  d'appel à retours aux bêta-testeurs.
- Point ouvert, non traité cette session (hors périmètre KAN-45, signalé
  dans le plan) : résidus du lexique « fiche » dans
  `docs/manuels/utilisation.md` (§1.3, §2.2) et fuites du terme « entité »
  dans l'UI (`entity-search.tsx:169`, `entities/[entityId]/page.tsx:192`).
- Reporter cette entrée dans `dev-log.md` (hors repo) + redéposer dans le
  projet Claude.
- Mettre à jour le board Jira : KAN-45 → **En cours** puis **Revue** une
  fois la PR ouverte.

---

**Décisions techniques**

| Date | Décision | Alternatives | Justification |
|---|---|---|---|
| 2026-08-13 | Conteneur défilant déplacé au-dessus de `<main>` (englobe `<main>` + `<footer>` comme frères) | Footer imbriqué dans `<main>` ; footer en barre permanente hors du flux défilant | Un `<footer>` dans `<main>` perd son rôle implicite `contentinfo` (RGAA) ; la barre permanente a été écartée par Aymeric (coût en hauteur d'écran sur l'éditeur/la Constellation) |
| 2026-08-13 | Indice de défilement d'abord en CSS pur décoratif (`aria-hidden`, `pointer-events-none`) | `IntersectionObserver` + composant client | Zéro JavaScript ; le chemin accessible réel reste le Tab, pas le chevron |
| 2026-08-13 | **Révisé (retour visuel Aymeric)** : `ScrollHint` devient un vrai lien natif (`href="#site-footer"`), plus décoratif | Rester purement décoratif malgré l'apparence de bouton | L'élément *ressemblait déjà* à un bouton (cercle, ombre) — mieux valait le rendre réellement cliquable que corriger son style pour le rendre moins engageant. Toujours zéro JS custom (ancre native + `scroll-smooth` CSS) |
| 2026-08-13 | **Révisé à nouveau** : `ScrollHint` devient un `<button>` à bascule (`IntersectionObserver` + `scrollTo`), plus un lien à sens unique | Rester un lien vers `#site-footer` uniquement | Aymeric voulait explicitement l'inversion (remonter) une fois ouvert — un lien d'ancre ne peut pas naturellement « refermer ». Pas de `aria-expanded` (rien n'apparaît/disparaît du DOM) : nom accessible qui change avec l'état à la place |
| 2026-08-13 | Scrollbar masquée (`.no-scrollbar`) sur les 4 conteneurs défilants KAN-45 | Scrollbar rethématisée (`.themed-scrollbar`, précédent Sidebar/dashboard) | Demande explicite d'Aymeric cette fois (contraire au précédent) — le défilement reste fonctionnel, seul le rendu visuel change |
| 2026-08-13 | `devIndicators: false` dans `next.config.ts` | Ne rien faire (l'indicateur n'apparaît jamais en prod) | Confondait la review visuelle du footer (badge bas-gauche, même zone que le pied de page qui scrolle désormais jusque-là) ; confirmé via Context7 (doc Next.js à jour) avant d'écrire le correctif |
| 2026-08-13 | Éditeur personne physique sans adresse postale (LCEN non professionnel) | Tidemark Studio seul (fiction) ; personne physique + adresse | Le studio fictif seul est juridiquement faible (ni personne physique ni morale réelle) ; l'adresse personnelle jugée disproportionnée. Tranché par Aymeric |
| 2026-08-13 | `TST-SEC-016` créé (contraste avec KAN-44) | Aucune entrée cahier de recettes, comme KAN-44 | Page publique visible par l'utilisateur (pas de l'outillage interne) ; catégorie SEC couvre deux propriétés réellement falsifiables (garde de session, `rel`) |
| 2026-08-13 | `(auth)/layout.tsx` et `/mentions-legales` restructurés en `h-dvh` + conteneur défilant (comme l'app) | Laisser le footer visible sans scroll sur ces deux écrans | Sans hauteur de viewport contrainte, le pied de page s'affichait entièrement dans le flux normal du document — incohérent avec `/worlds` et les pages de monde. `/mentions-legales` corrigée par cohérence de chrome, non explicitement demandée |

**Erreurs rencontrées & Solutions**

| Date | Symptôme | Cause | Solution |
|---|---|---|---|
| 2026-08-13 | `ps aux \| grep -q "playwright"` rend faux immédiatement alors que le process tourne encore | Git Bash `ps aux` ne liste pas les process Windows natifs lancés hors de son propre arbre | Polling via `Get-CimInstance Win32_Process` (PowerShell) pour surveiller un process Windows natif |
| 2026-08-13 | `AggregateError:` (message vide) dès le début du run e2e, avant le premier test | `docker ps -a` : containers Postgres/MinIO du dev stack arrêtés, `pg.Client.connect()` échoue en connexion refusée dans `global-setup.ts` | `docker compose -f docker-compose.dev.yml up -d` avant tout run e2e |
| 2026-08-13 | 3 process node orphelins après un run e2e **réussi** (`worker.kill()` sans effet réel) | `spawn(..., { shell: true })` sous Windows : `kill()` ne tue que le shell parent, pas l'arborescence tsx réelle — piège déjà documenté par la skill `windows-orphan-node-e2e-cleanup` | `taskkill //PID <pid> //F //T` sur le PID le plus haut de l'arborescence |
| 2026-08-13 | `TS2307: Cannot find module '../../footer'` | Le groupe de routes `(app)` compte comme un vrai niveau de dossier pour la résolution de module — profondeur mal comptée à l'écriture initiale | `../../../footer` (3 niveaux depuis `worlds/[slug]/world-shell.tsx`) |
| 2026-08-13 | Risque de conflit sur le 2ᵉ run e2e (port 3100) | Serveur `next dev` manuel resté vivant sur le port 3000 (vérification visuelle précédente) — verrou `next dev` par projet, pas par port | Repéré via `Get-NetTCPConnection -LocalPort 3000`, tué via `taskkill //PID <pid> //F //T` avant de relancer Playwright |
| 2026-08-13 | `Worker exited unexpectedly`, seulement 6/13 tests rapportés sur un run vitest ciblé | Reprise de session juste après une interruption (process Claude Code redémarré pendant que le run tournait) — artefact de l'interruption, pas une régression | Relancé proprement : 13/13 passent. Toujours revérifier avant de diagnostiquer un crash vitest après une reprise de session |

**Rappel : rien n'a été commité cette session** — tous les fichiers listés ci-dessus sont en attente sur la branche `feat/kan-45-footer-legal-contact` (poussée, vide de commits).

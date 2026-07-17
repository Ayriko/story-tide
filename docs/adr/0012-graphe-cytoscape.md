# ADR-0012 — Graphe de relations : Cytoscape.js dès le MVP (pas de migration à prévoir)

- **Statut** : accepté
- **Date** : 2026-07-17
- **Décideur** : Aymeric (MOE)

## Contexte et problème

KAN-25 (« graphe obligatoire », spec §2 point 7) restait à zéro ligne de code.
Aymeric a déposé deux documents de préparation issus d'un audit du concurrent
vvd.world (`docs/design/reference-vvd.md` — pistes design front, §5 dédiée au
graphe — et un ADR externe proposé, `docs/adr/extern-entry/ADR-0010-rendu-graphe.md`)
suggérant une trajectoire en deux temps : react-flow (SVG/DOM) pour le MVP, puis
migration vers une lib canvas 2D (cytoscape en mode canvas, ou sigma.js) si le
volume l'exige — par analogie avec le rendu observé chez vvd (canvas 2D + fine
couche SVG en overlay).

## Décision

**Cytoscape.js dès le MVP, sans phase de migration prévue.** Ce choix était déjà
acté (`docs/spec-technique-bloc2.md` §3, CLAUDE.md, et le titre même du ticket
Jira KAN-25) — introduire react-flow aurait été une dérogation à la stack sans
justification technique suffisante : **Cytoscape.js rend nativement sur un seul
`<canvas>`**, pas en DOM/SVG comme react-flow. L'argument central de l'ADR
externe (SVG pour la vélocité MVP, migration canvas si l'échelle l'exige) ne
s'applique donc pas de la même façon : il n'y a pas de plafond de perf DOM à
contourner, donc pas de phase de migration à isoler derrière une interface.

L'audit vvd reste une matière utile pour la **forme** de la feature (canvas +
filtres par type + navigation cliquable — mêmes partis pris que le concurrent),
sans en reprendre la conclusion technique (react-flow).

## Alternatives considérées

- **react-flow (SVG/DOM) pour le MVP, migration canvas si besoin** (proposition
  externe) — écartée : introduit une dépendance hors stack actée pour résoudre
  un problème de perf DOM que Cytoscape.js n'a pas dès le départ ; aurait aussi
  demandé une réécriture du rendu et des interactions au moment de la
  migration, alors que rester sur Cytoscape.js évite cette dette par
  construction.
- **WebGL d'emblée** — écartée : complexité disproportionnée pour le volume
  attendu (ordre de grandeur ~200 entités/monde, cf. test de passage à l'échelle
  du moteur de liaison, spec §4.4) ; vvd lui-même ne va pas jusque-là.

## Conséquences

- **Positives** : aucune dérogation à la stack actée ; aucune phase de
  migration de moteur de rendu à planifier ni à isoler derrière une interface
  supplémentaire ; réutilisation directe des patrons déjà établis du projet
  (fonction pure de mapping testée isolément — `buildGraphElements`,
  `buildAccessibleGraphEntries`, `src/lib/graph-elements.ts` — puis wiring
  framework mince monté dans un `useEffect`, même règle StrictMode que
  l'éditeur Tiptap).
- **Négatives / à surveiller** : si un monde dépasse largement l'ordre de
  grandeur observé pour le moteur de liaison (~200 entités), aucune mesure réelle
  de perf du rendu Cytoscape n'a encore été prise — à réévaluer sur preuve si un
  monde réel volumineux montre une dégradation (même logique que le
  cache de l'automate Aho-Corasick, non construit tant qu'aucun besoin réel ne
  l'a démontré).
- **RGAA (élim.)** : un graphe rendu sur canvas ne peut exposer aucun élément
  individuel au clavier/lecteur d'écran. Même parti pris que le surlignage
  live (ADR-0010) : le canvas est une **affordance souris**, doublée d'une
  **liste accessible** (`GraphAccessibleList`, `<nav>` + vrais `<Link>`)
  réutilisant les mêmes données — chemin clavier complet, indépendant du
  canvas.
- **Bug réel trouvé et corrigé pendant l'implémentation** : le layout `cose`
  de Cytoscape anime par défaut sur plusieurs `requestAnimationFrame` ; si le
  composant démonte (navigation) pendant l'animation, une frame différée peut
  s'exécuter après `cy.destroy()` et planter sur des internes détruits
  (`Cannot read properties of null (reading 'notify')`, reproduit par
  `e2e/graph.spec.ts`). Corrigé par `animate: false` sur le layout — supprime
  la classe de bug par construction (layout synchrone, aucune frame différée
  possible) plutôt qu'un `stop()` fragile à synchroniser avec le cleanup de
  l'effet React.

## Références

- `docs/design/reference-vvd.md` §5 (graphe vvd = canvas 2D + overlay SVG) —
  matière pour la forme de la feature, pas pour le choix technique.
- `docs/adr/extern-entry/ADR-0010-rendu-graphe.md` — proposition externe non
  retenue, conservée en l'état comme trace de la réflexion.
- ADR-0010 (surlignage des liaisons) — même parti pris affordance souris /
  liste accessible séparée.
- Décision analogue « optimiser sur preuve » : automate Aho-Corasick
  reconstruit à chaque job tant qu'aucun besoin de cache n'est démontré
  (dev-log 2026-07-15).

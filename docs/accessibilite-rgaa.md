# Accessibilité — Dossier RGAA — C2.2.3 (ÉLIMINATOIRE)

> Référentiel présenté ET justifié (RGAA retenu). Audit tracé (contrôle manuel Ara/NVDA à planifier ; axe-core automatisé tenté puis reporté, voir ci-dessous).
> État au 2026-07-14 : actions vérifiées manuellement sur les pages existantes
> (login/register/mondes/entités). Audit outillé pas encore en place.

## Référentiel retenu & périmètre

**RGAA** retenu (vs OPQUAST) : référentiel officiel français, aligné WCAG, déjà
introduit au Bloc 1 — continuité assumée plutôt que de changer de référentiel en
cours de route. Pages/écrans audités à ce jour : `/login`, `/register`, `/worlds`,
`/worlds/[slug]`, `/worlds/[slug]/entities/[entityId]`.

## Actions mises en œuvre

Sur le groupe `(app)` (`/worlds`, `/worlds/[slug]`, `/worlds/[slug]/entities/[entityId]`) :

- **Landmarks** : `<header><nav aria-label="Navigation principale">`, `<main
  id="main-content">`, sections `<section aria-labelledby="...">` pour les
  entités, les paramètres du monde et d'une fiche.
- **Lien d'évitement** (« Aller au contenu principal ») visible au focus clavier,
  premier élément atteignable au Tab.
- **Formulaires** (création, renommage, édition d'entité) : mêmes conventions que
  `(auth)` — labels natifs (y compris `<select>` et `<textarea>` pour le type et
  les alias), `aria-invalid`/`aria-describedby`, erreurs dans une région
  `role="alert"`.
- **Suppression** : confirmation en deux étapes avec des `<button type="button">`
  natifs (« Supprimer ce monde »/« Supprimer cette fiche » → « Confirmer la
  suppression » / « Annuler »), jamais de `window.confirm` bloquant — entièrement
  navigable au clavier.
- **Éditeur Tiptap** (`EntityEditor`) : barre d'outils `role="toolbar"
  aria-label="Mise en forme"`, boutons natifs avec `aria-pressed` reflétant l'état
  actif (gras/italique/titre/liste/citation), panneaux lien/image révélés par un
  bouton (pas de `<div>` cliquable), texte alternatif **requis** pour insérer une
  image (bouton désactivé tant que l'alt est vide). État de sauvegarde annoncé via
  `aria-live="polite"` (« Enregistrement… » / « Enregistré. » / erreur), pas de
  changement visuel silencieux pour les lecteurs d'écran.
- **Surlignage des liaisons** (2026-07-16, ADR-0010) : le surlignage des mentions
  détectées dans l'éditeur (décoration visuelle + Ctrl/Cmd+clic) est une
  **affordance souris uniquement** — un `contenteditable` ne peut pas exposer
  correctement un lien interactif au clavier sans risquer d'entrer en conflit avec
  l'édition du texte. Le chemin **accessible** est délibérément séparé : la liste
  « Entités liées » sous l'éditeur (`<nav aria-label="Entités liées">` + vrais
  `<Link>` dans une `<ul>`), atteignable au Tab et annoncée normalement par un
  lecteur d'écran. Les deux chemins mènent à la même fiche — aucune information
  n'est disponible à la souris seule.
- **Mentions manuelles @** (2026-07-17, ADR-0011) : contrairement au surlignage,
  la popup de suggestion (`mention-list.tsx`) est **entièrement clavier** —
  déclenchement en tapant `@` sans quitter le clavier, `role="listbox"`/
  `role="option"`/`aria-selected` sur les candidats, navigation ↑/↓, validation
  par Entrée, fermeture par Échap (gérée nativement par `@tiptap/suggestion`).
  `aria-activedescendant` posé sur le `contenteditable` de l'éditeur (jamais
  sur la popup, qui ne reçoit jamais le focus réel) et synchronisé avec
  l'option survolée, pour qu'un lecteur d'écran annonce l'option courante sans
  déplacer le focus — pattern standard d'un combobox ancré sur un champ de
  texte. Une fois insérée, la mention suit la même règle que le surlignage
  (Ctrl/Cmd+clic = affordance souris, liste « Entités liées »/« Mentionné par »
  = chemin accessible).
- **Graphe de relations** (2026-07-17, ADR-0012, `/worlds/[slug]/graph`) : le
  canvas Cytoscape (`graph-view.tsx`) ne peut exposer aucun élément individuel
  au clavier/lecteur d'écran (un seul `<canvas>`, `aria-hidden="true"`) — même
  parti pris que le surlignage. Les filtres par type restent de vrais
  `<input type="checkbox">`/`<label>` natifs, atteignables au clavier même si
  leur effet (masquer des nœuds sur le canvas) n'est perceptible qu'à l'écran.
  Le chemin **accessible** est `GraphAccessibleList` (`graph-accessible-list.tsx`) :
  `<nav aria-label="Graphe (liste accessible)">` + `<ul>` imbriquées de vrais
  `<Link>`, reflétant les mêmes relations que le canvas, navigable au Tab et
  annoncée normalement par un lecteur d'écran.
- **Passe visuelle shadcn/ui sur Radix (2026-07-20, KAN-36, ADR-0018)** — thème
  navy/mint (Bloc 1) posé sur le parcours démo entier (connexion → mondes →
  fiche → éditeur → backlinks → graphe), composants vendored dans
  `src/components/ui/` sur primitives `@radix-ui/*` (`Label`, `Popover`) et
  `cmdk` (`Command`, solde ADR-0016 sur `EntityTypeCombobox`) :
  - **Contraste vérifié par calcul, pas à l'œil** : chaque paire
    texte/fond de la nouvelle palette a été passée par la formule de luminance
    relative WCAG 2.1 avant d'être fixée dans `globals.css` (script Node
    ponctuel, valeurs commentées en tête du fichier). Ça a **détecté une
    régression avant livraison** : `--destructive` repris par réflexe du rouge
    déjà utilisé dans l'ancien `form-styles.ts` (`#B91C1C`, pensé pour texte
    sur fond clair) ne donnait que **1,86:1** en texte direct sur la nouvelle
    surface sombre (INK) — largement sous le seuil 4,5:1. Remplacé par
    l'équivalent clair (`#FCA5A5`, le grain que l'ancien code réservait déjà à
    `dark:text-red-400` sans jamais l'appliquer par défaut) : 6,30:1 sur INK.
    Même méthode pour le panneau de connexion translucide (`bg-card/45` sur
    fond flouté) : contraste recalculé au pire cas (fond le plus clair
    derrière le flou) avant de choisir l'opacité, jamais après.
  - **Bascule Connexion/Inscription** (`auth-tabs.tsx`) : première version
    posée avec `role="tablist"`/`role="tab"` + `aria-selected` — corrigé avant
    livraison en `<nav>` + `aria-current="page"`, parce que ce sont deux
    vraies navigations de page (changement d'URL), pas un panneau qui change
    sans rechargement. `role="tab"` sans la navigation clavier fléchée qu'il
    implique aurait été pire que pas de rôle du tout (un lecteur d'écran
    annonce « onglet 1 sur 2 » puis les flèches ne font rien).
  - **Focus visible sur les cartes-liens** (`worlds/page.tsx`,
    `entity-search.tsx`, `linked-entities.tsx`) : premier essai avec l'anneau
    de focus posé sur la `Card` (un `<div>` non focusable) et
    `focus-visible:outline-none` sur le `<Link>` réellement focusable
    au-dessus — aurait supprimé l'indicateur de focus sans le remplacer.
    Corrigé : l'anneau `focus-visible:outline` reste sur l'élément natif
    réellement focusable (le `<Link>`), jamais sur un conteneur décoratif.
  - **`EntityTypeCombobox` sur `cmdk`** (solde ADR-0016) : `Command` posé avec
    `shouldFilter={false}` — l'architecture de filtrage (état contrôlé,
    substring, pas le scoring flou par défaut de `cmdk`) reste identique à
    l'ancien composant, `cmdk` n'apporte que le rendu ARIA
    (combobox/listbox/option) et la navigation clavier (flèches/Entrée/
    Home/End), déjà audités plutôt que réimplémentés à la main. Les 7 tests
    existants (clavier : `ArrowDown`/`Enter`/`Échap`, filtrage, `blur`)
    passent **sans aucune adaptation** — meilleur que ce que l'ADR-0016
    anticipait. Deux lacunes d'environnement jsdom découvertes au passage et
    corrigées en polyfills globaux (`vitest.setup.ts`, pas de bidouille par
    test) : `ResizeObserver` et `Element.scrollIntoView`, tous deux utilisés
    en interne par `cmdk`, absents de jsdom.
  - **Surlignage AUTO / mentions manuelles** (`entity-mention`, partagé par
    construction entre décorations live et nœuds mention persistés,
    `tiptap-mention-attrs.ts`) : couleur de la décoration (soulignement
    pointillé) re-tintée sur la nouvelle palette, l'indice **non-couleur**
    (le pointillé lui-même) conservé à l'identique — c'est lui qui satisfait
    « jamais par la couleur seule », pas une distinction nouvelle entre les
    deux mécanismes (qui partagent délibérément le même traitement visuel,
    par design antérieur à cette session).
  - **Point de vigilance non corrigé, hors périmètre assumé** : la couleur des
    arêtes du graphe Cytoscape (`#52525B`, dans le tableau `style:` que
    ADR-0012 réserve explicitement) n'offrait déjà que ~2,57:1 sur l'ancien
    fond — sous le seuil 3:1 (objets graphiques, WCAG 1.4.11). Antérieur à
    cette session, pas aggravé (conteneur reposé sur le token le plus sombre
    de la palette), mais pas corrigé — à reprendre si le rendu Cytoscape
    lui-même est un jour retouché.
  - **Dialogs (KAN-36 P2)** : création/renommage/suppression de monde et de
    fiche déplacés dans `Dialog`/`AlertDialog` (Radix, focus trap + retour de
    focus au déclencheur natifs). Bouton de suppression jamais un
    `AlertDialogAction` (son `onClick` referme le calque avant que la Server
    Action async ait pu renvoyer une erreur) — un `Button` simple, la
    redirection serveur en cas de succès démonte tout le Dialog, l'échec le
    laisse ouvert avec l'erreur visible.
  - **Dashboard de monde (KAN-36 P3)** : `<h1>` unique (nom du monde, plus de
    doublon avec le fil d'ariane), sections `Fiches récentes`/`Graphe` en
    `<h2>`. Panneau graphe miniature en aperçu **non interactif au clavier**
    (même canvas Cytoscape `aria-hidden`, cf. ADR-0010/0012 ci-dessus) —
    aucun fieldset de filtres dupliqué ici : l'équivalent accessible complet
    (filtres + liste, `GraphAccessibleList`) reste entièrement sur `/graph`,
    atteint par un vrai `<Link>` natif (« Agrandir »), jamais une copie. Chip
    « Rechercher » : ne recrée aucun champ, déplace le focus vers la
    recherche déjà existante de la sidebar via un événement DOM privé (déplie
    la sidebar au passage si repliée) — testé au clavier (Tab jusqu'au chip,
    Entrée, focus atterrit bien dans le champ). Compteurs par catégorie et
    icônes de type : toujours accompagnés du libellé texte du groupe/type,
    jamais l'icône ou la couleur seules.

Sur `LoginForm` / `RegisterForm` (`src/app/(auth)/{login,register}/`) :

- **Éléments natifs** : `<label htmlFor>` / `<input id>`, `<button type="submit">` —
  jamais de `<div>` cliquable.
- **Labels explicites** sur tous les champs (nom, e-mail, mot de passe).
- **Erreurs reliées au champ** : `aria-invalid="true"` + `aria-describedby` pointant
  vers l'id du message d'erreur ; erreur de formulaire dans une région `role="alert"`.
- **`autoComplete`** correct par champ (`email`, `name`, `current-password` /
  `new-password`) — aide les gestionnaires de mots de passe et lecteurs d'écran.
- **Focus visible** : anneau `focus-visible:outline` sur tous les champs/boutons
  (pas de suppression du focus natif).
- **Navigation clavier complète** : Tab/Shift-Tab dans l'ordre logique, soumission
  au clavier — **vérifié manuellement par Aymeric** (pas encore d'audit NVDA).
  - Correction non-régression associée : les champs (hors mot de passe) conservent
    leur valeur saisie après une erreur de soumission — cf.
    `plan-correction-bogues.md` BUG-001.
- **Redirection annoncée** : `/login` et `/register` redirigent immédiatement vers
  `/` si une session est déjà active (pas de contenu inutile affiché puis retiré).

Pas encore construit (n'existe pas dans le code) : alternatives textuelles sur
images **uploadées** (l'insertion se fait par URL en attendant le service d'upload,
étape suivante — l'alt reste déjà obligatoire), navigation clavier du graphe (pas codé).

**Non vérifié cette session (gap assumé, pas silencieux)** : l'éditeur Tiptap n'a
pas été testé au clavier dans un vrai navigateur — l'extension Chrome de pilotage
a de nouveau timeout (voir dev-log). Vérifié à la place : logique de données 100 %
testée (validation, extraction), build de production réussi, chargement réel du
bundle client confirmé par requête HTTP. La navigation clavier réelle de la
toolbar/l'éditeur reste à confirmer manuellement ou via le smoke Playwright
(`e2e/smoke.spec.ts`, fait le 2026-07-15 — parcours fonctionnel, pas encore
d'assertion a11y dédiée, voir ci-dessous).

## Audit & résultats

- **Axe automatisé au niveau composant** : tenté (`jest-axe` dans le job test
  Vitest) à l'étape CI du 2026-07-12, **abandonné** — le matcher
  `toHaveNoViolations` échoue sous Vitest 4 (`expectAssertion.call is not a
  function`, dépendance à des internals Jest non fournis par le package). Pas de
  fix jugé utile d'insister à ce stade (voir `ci.md`).
- **Audit pleine-page à outiller** : le harnais Playwright existe désormais
  (`e2e/smoke.spec.ts`, 2026-07-15 — login → monde → fiche → éditeur, base e2e
  isolée) et lève le blocage Vitest/jsdom (axe fonctionne nativement avec un
  vrai navigateur). L'injection d'`@axe-core/playwright` et l'assertion
  `toHaveNoViolations` sur chaque page du parcours restent
  <!-- TODO, pas encore fait -->. Note : jsdom ne calcule de toute façon pas les
  contrastes (axe les ignore en environnement jsdom), donc le contrôle contraste
  restera de toute façon manuel ou Playwright.
- **Passage manuel Ara + NVDA** : à planifier avant la recette sur staging
  (spec §6) — <!-- TODO, pas encore fait -->.
- **Surlignage des liaisons** (`e2e/link-highlight.spec.ts`, 2026-07-16) : le
  parcours e2e exerce la liste « Entités liées » via `getByRole("navigation",
  ...)`/`getByRole("link", ...)` (nom accessible réel, pas un sélecteur CSS) —
  preuve que le chemin clavier/lecteur d'écran fonctionne, sans remplacer un audit
  axe-core pleine page (toujours <!-- TODO, pas encore fait -->).
- **Graphe de relations** (`e2e/graph.spec.ts`, 2026-07-17) : même méthode que
  ci-dessus, appliquée à `GraphAccessibleList` (`getByRole("navigation", { name:
  "Graphe (liste accessible)" })`) — preuve que le chemin clavier fonctionne
  indépendamment du canvas Cytoscape, toujours pas un remplacement d'un audit
  axe-core pleine page.
- **Passe visuelle KAN-36 (2026-07-20)** : l'extension Chrome de pilotage a de
  nouveau timeout dès la première page (voir dev-log, même incident récurrent
  que le 2026-07-14/15) — pas de parcours clavier Tab-par-Tab observé
  visuellement cette session sur le parcours démo restylé. Vérifié à la
  place : les 9 specs e2e (Playwright, vrai navigateur) passent sur chaque
  écran retouché, y compris `entity-type-combobox.test.tsx` qui exerce de
  vraies séquences clavier (`user.keyboard("{ArrowDown}{ArrowDown}{Enter}")`,
  `{Escape}`) via `@testing-library/user-event` — pas de simple clic
  programmatique. **Reste un vrai gap, pas silencieux** : un balayage Tab
  complet du parcours démo (focus visible partout, ordre logique) n'a pas été
  fait dans un vrai navigateur cette session — à faire manuellement par
  Aymeric ou lors d'une prochaine session avec l'extension fonctionnelle,
  avant la recette sur staging (spec §6).

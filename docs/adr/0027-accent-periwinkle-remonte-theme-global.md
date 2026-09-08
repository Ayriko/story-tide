# ADR-0027 — Accent périwinkle de l'artwork remonté au thème global, séparé en deux tokens

- **Statut** : accepté
- **Date** : 2026-09-08
- **Décideur** : Aymeric (MOE)

## Contexte et problème

KAN-58. Démo commanditaire mi-septembre, gel produit visé le 11/09. La session
artwork du 26-27/08 (KAN-56, ADR-0026) a, à raison, isolé son changement dans une
surcharge locale posée sur `.auth-artwork` : en plus des quatre variables de shell
déjà prévues par l'ADR-0026 (`--bg-image`, `--shell-scrim`, `--shell-scrim-blur`,
`--shell-bg-position`), elle y a ajouté une surcharge de `--primary` et
`--primary-foreground` (`#667EC7`), non documentée dans cet ADR. Conséquence : `(auth)`
(`/login`, `/register`, `/forgot-password`, `/reset-password`) et `(app)` n'ont plus
la même couleur d'accent, alors que le commanditaire passe de l'un à l'autre en une
trentaine de secondes.

État des lieux (2026-09-08) avant toute décision :

1. **La teinte vient réellement de l'artwork.** Échantillonnage de
   `public/artwork/login-hero-1920.webp` (sharp) : les 10 dominantes de couleur de
   l'image sont en H226–235 (S39–56), la moyenne du tiers droit (sous la carte) est
   `#1c2245` (H231 S42). `#667EC7` est en H225 S46 — 5 à 8° de teinte de tout ce que
   contient l'image. L'ex-accent MINT (`#1fb39a`) est en H170, une autre famille.
2. **`--primary` porte deux rôles avec deux seuils WCAG différents.** Remplissage
   de bouton (contraste non-texte, seuil 3:1) et couleur de texte/lien (seuil 4,5:1).
   `#667EC7` tient le premier (4,72:1 avec `#0d1420` comme texte dessus) et échoue le
   second (3,07:1 en texte sur `bg-card/70`, 3,13:1 sur `--secondary`/NAVY2 nu).
3. **Le collatéral de la surcharge du 26/08 était déjà en production**, non détecté
   à l'époque : posée sur la racine du groupe de routes plutôt que sur les seuls
   composants concernés, elle retintait aussi `footer.tsx`, `scroll-hint.tsx`,
   `artist-credit.tsx` et les liens de `/forgot-password`/`/reset-password` — leurs
   états `hover:text-primary` étaient à 3,07:1, sous le seuil texte. Le protocole de
   mesure du 26/08 ne couvrait que des éléments au repos (titre, sous-titre, onglet,
   erreur, pied de page), pas les états de survol.
4. **Le survol des cartes cliquables** (`hover:bg-accent`, mondes/entités
   liées/recherche/menus) utilise un troisième token, `--accent` (`#175160`, 35 % de
   TEAL `#0e7c86` mixé dans INK), inchangé depuis la passe shadcn du 20/07 —
   découvert visuellement en cours de session comme un troisième ton (teal foncé) ni
   aligné sur l'ancien MINT ni sur le nouveau périwinkle.

## Options envisagées

- **A — Remonter `#667EC7` tel quel dans `--primary` global** (écartée) : fait
  tomber tout `text-primary`/`hover:text-primary` du site (~15 emplacements dans
  `(app)` : `world-shell.tsx`, `entity-editor.tsx`, la légende du graphe…) à 3,07:1,
  sous le seuil texte. La poignée de redimensionnement d'image (`bg-primary`,
  `resizable-image-view.tsx`) — posée sur des artworks de monde **utilisateurs**,
  arbitraires — perd sa marge de sécurité pour le même motif.
- **B — Dériver un jeu de tokens complet de l'artwork pour les deux groupes**
  (écartée) : rouvre `--destructive`, `--accent`, `--muted-foreground` et toute la
  palette de surfaces (`--background`/`--card`/`--secondary`) figée et mesurée le
  20/07, à trois jours du gel produit — coût et risque disproportionnés pour
  l'enjeu (un accent, pas une refonte).
- **C — Ne rapprocher que les surfaces translucides, teinte inchangée** (partiellement
  retenue, cf. Décision) : nécessaire (répare une partie de l'écart de contraste
  connu du sous-titre) mais pas suffisante seule — laisse deux couleurs de bouton
  visibles en démo, l'écart le plus voyant.
- **D — Revenir à MINT partout** (écartée, Aymeric) : perd l'accord avec l'artwork
  commandé, alors que la mesure de teinte (ci-dessus) montre que `#667EC7` EST la
  couleur de l'illustration, pas un choix arbitraire à corriger.
- **E — Garder `#667EC7`, scinder son usage en deux tokens** (retenue, cf. Décision).

## Décision

**Deux tokens plutôt qu'un.** `--primary` reste exactement `#667EC7` /
`#0d1420` (l'arbitrage du 26/08 n'est pas rejoué) et sert désormais uniquement les
remplissages (boutons, onglet actif). Un token frère, `--link: #94a5d8`, sert les
textes et liens interactifs (`text-link`, exposé via `--color-link` dans
`@theme inline`) : même teinte et même saturation que `--primary` (H225, S46→47),
seule la clarté monte (L59→71) — 4,93:1 sur `bg-card/70`, 5,03:1 sur `--secondary`.
16 occurrences de `text-primary`/`hover:text-primary` renommées dans 13 fichiers
(`footer.tsx`, `scroll-hint.tsx`, `mentions-legales/page.tsx`, `world-shell.tsx`,
`worlds/page.tsx`, `graph-view.tsx`, `graph-accessible-disclosure.tsx`,
`button.tsx` variante `link`, `artist-credit.tsx`, les formulaires
`forgot-password`/`reset-password`). `.auth-artwork` perd sa surcharge de
`--primary`/`--primary-foreground`, devenue redondante — le bloc revient aux 4
variables de shell que l'ADR-0026 décrivait réellement.

**`--ring` bascule sur `var(--foreground)`** (`#edf2f2`). Aucune teinte de la
famille périwinkle ne tient 3:1 contre un remplissage `#667ec7` : `#667ec7` sur
lui-même = 1,00:1, `--link` = 1,61:1, l'ex-MINT = 1,48:1. `--foreground` est le seul
candidat conforme partout (3,46:1 contre le bouton, 10,61:1 sur `bg-card/70`,
15,17:1 sur le canvas du graphe) et n'introduit aucune couleur nouvelle. Conséquence
structurelle découverte en validation visuelle : `button.tsx`/`input.tsx`/
`textarea.tsx`/`input-group.tsx` empilaient `focus-visible:border-ring` (bordure
pleine) **et** `focus-visible:ring-3 ring-ring/50` (halo translucide), les deux
collés au bord sans décalage — avec MINT des deux côtés, ça se lisait comme un
contour vert épais ; avec du blanc cassé des deux côtés, ça fusionnait en bande
grise floue. Le halo (`ring-3 ring-ring/50`) est retiré dans ces 4 fichiers, ne
laissant que la bordure pleine — déjà conforme seule, structure identique au
patron `focus-visible:outline` déjà utilisé partout ailleurs (liens, cartes).
Compromis assumé : un halo plus large restait utile sur un fond texturé
(artwork) ; le retrait est un choix délibéré de netteté plutôt que d'épaisseur,
toujours conforme WCAG (aucun seuil d'épaisseur minimale).

**`--accent` passe de `#175160` (35 % TEAL `#0e7c86` dans INK) à `#203a57` (35 %
périwinkle H225 S46, même clarté L29, dans INK)** — même recette de calcul, teinte
alignée. Corrige au passage un écart préexistant : `text-muted-foreground` sur ce
fond (chip désactivé du panneau de filtres du graphe, au survol) était à 3,46:1
avec le teal, sous le seuil RGAA 4,5:1 — 4,57:1 avec le périwinkle.

**Correctif de mise en page associé** (`sidebar.tsx`) : `-mx-1 px-1` sur le `<nav>`
défilant de la liste d'entrées — `overflow-y-auto` sans `overflow-x` explicite fait
computer `overflow-x` à `auto` (règle CSS overflow), qui coupait l'anneau de focus
(`outline-offset-2`, 4px de débord) des éléments pleine largeur. Sans rapport avec
les tokens de couleur, révélé par la validation visuelle du nouvel anneau blanc
(plus visible qu'avant, donc plus visiblement tronqué).

**Vérification RGAA reconduite en entier** sur les 4 écrans `(auth)` (protocole du
26/08 : compositing réel fond→scrim→surface→texte, 1920×1080 DPR1 et
1440×810/DPR2 physique 2880×1620, script Playwright+sharp jetable non commité).
Un bug de méthode trouvé et corrigé en route : le conteneur défilant a
`scroll-behavior: smooth`, donc régler `scrollTop` programmatiquement anime le
défilement au lieu de sauter instantanément — sans forcer `scroll-behavior: auto`
avant le saut, la capture de position et la capture d'écran pouvaient tomber à des
instants différents de l'animation, produisant une correspondance rect↔pixel
fausse (un ratio à 1,53:1 qui ne correspondait à aucun état réel de la page,
détecté par crop visuel isolé avant d'être corrigé).

Résultat : un vrai défaut nouveau corrigé (case à cocher « Ne pas créer le monde
d'exemple » sur `/register`, `text-muted-foreground` à 4,09–4,35:1 selon
variante/état → `text-foreground`, ~9,3:1). Deux écarts résiduels sur
`text-muted-foreground`, documentés en l'état (voir Conséquences) :
sous-titre du panneau à 4,37–4,49:1 sur 3 des 4 écrans en variante 2880/haut de
page (améliore l'écart connu de l'ADR-0026, 3,55:1, sans le fermer), et deux liens
secondaires (« Mot de passe oublié ? », « Retour à la connexion ») à 4,20–4,21:1
en position d'atterrissage (avant tout défilement), 1920. Un faux positif écarté
de la mesure : le libellé accessible de `ScrollHint` (« Aller au pied de page »)
est `sr-only`, jamais peint à l'écran — son contraste visuel n'a pas de sens.

## Conséquences

- **Positives** : une seule palette d'accent sur tout le parcours démo,
  `(app)`/`mentions-legales` non touchés dans leurs surfaces/tokens de base
  (seul `--primary`/`--accent`/`--ring`, déjà partagés, changent de valeur — aucun
  nouveau token de surface). L'arbitrage `#667EC7` du 26/08 est préservé à
  l'identique dans son rôle d'origine (remplissage). Un vrai défaut RGAA corrigé
  (case à cocher), un défaut de mise en page (anneau tronqué) et un défaut
  structurel de focus (halo fondu) trouvés et corrigés en cours de validation,
  aucun n'était dans le périmètre initial du ticket.
- **Négatives / à surveiller** : deux écarts de contraste résiduels sur
  `text-muted-foreground` (sous-titre 4,37–4,49:1, deux liens 4,20–4,21:1),
  améliorés par `bg-card/55→/70` mais non fermés — sous le seuil 4,5:1 texte,
  arbitrage délibéré (proximité du seuil, cohérent avec l'arbitrage de fidélité
  visuelle du 26/08) plutôt que corrigé en aveugle. À rouvrir si l'audit RGAA
  formel l'exige. `HOVER_COLOR` dans `graph-view.tsx` reste une constante hex
  dupliquée depuis `--primary` (Cytoscape ne lit pas les variables CSS,
  ADR-0012) — à resynchroniser manuellement si le token change encore.
  `--chart-1..5` et `--sidebar-primary`/`--sidebar-ring` restent à l'ancienne
  valeur MINT dans `globals.css` : aucun consommateur dans `src/` à ce jour,
  signalé plutôt que corrigé (code mort préexistant).

## Compétence(s) servie(s)

C2.2.1 (architecture — le contrat de `ShellBackground`/`.auth-artwork` posé par
l'ADR-0026 est simplifié, pas réétendu ; les tokens partagés restent la seule
frontière entre `(auth)` et `(app)`) ; C2.2.3 (sécurité et accessibilité — mesure
de contraste sur rendu réel avant et après, écarts résiduels documentés avec leur
ratio plutôt que masqués, un vrai défaut corrigé) ; C2.4.1 (traçabilité de la
décision, y compris la correction d'un oubli de l'ADR-0026 sur son propre
périmètre réel).

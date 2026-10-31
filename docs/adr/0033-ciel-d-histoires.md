# ADR-0033 — Le ciel d'histoires : thème, rendu et disposition de la Constellation

- **Statut** : accepté
- **Date** : 2026-10-31
- **Décideur** : Aymeric (MOE)

## Contexte et problème

KAN-87 (lot C1, ADR-0032) a fait de la Constellation la page d'un monde, avec
une disposition mémorisée. Son rendu restait celui d'un graphe générique :
fond uni, nœuds de même taille colorés par famille, tous les noms et tous les
libellés affichés en même temps, mise en page fcose globale.

KAN-85 (lot C2, « Le ciel d'histoires ») applique la vision visuelle : un ciel
nocturne de carte céleste, où l'éclat d'une étoile dit combien elle est liée,
où les constellations déclarées ressortent, avec trois animations (arrivée,
éclairage au survol, tracé à la création). Contraintes :

- **60 images/s sur 300 entrées**. On n'anime que l'opacité, la taille et le
  trait, jamais la mise en page.
- Couleurs, opacités et épaisseurs portées par des **jetons CSS** : préparation
  du mode clair (KAN-71) et de l'onglet « Apparence », sans les livrer.
- `prefers-reduced-motion` respecté, aucune animation qui bloque l'interaction.
- Aucune modification du schéma Prisma, aucune nouvelle dépendance.
- Accessibilité inchangée : le canvas reste `aria-hidden`, la liste « Fils »
  reste l'équivalent textuel.

## Options envisagées

### Thème du canvas

- **A — Couleurs en dur dans la feuille de style Cytoscape.** Simple, mais
  aucun mode clair possible sans toucher au code.
- **B — Jetons CSS `--sky-*` lus par un résolveur au montage (retenue).**
  Cytoscape ne lit pas les variables CSS. `readSkyPalette` les lit par
  `getComputedStyle`, les valide (couleur, opacité, épaisseur bornées) et
  retombe sur une valeur sûre si un jeton est absent ou invalide.

### Fond « carte céleste »

- **A — Calques frères en `position: absolute`.** Écarté : piège connu avec
  une lib à DOM autonome (skill `fond-decoratif-pseudo-element`).
- **B — Dessin dans le canvas Cytoscape.** Écarté : redessiné à chaque image
  d'un geste.
- **C — Pseudo-éléments `::before` masqués par des SVG propres à chaque monde
  (retenue).** Le semis d'étoiles lointaines et les arcs sont générés par une
  fonction pure déterministe (graine = id du monde). Ils sont posés en
  variables CSS et peints sous le canvas, sans aucun coût par image.

### Éclat des étoiles

- **A — Taille proportionnelle au nombre de voisins.** Illisible : un astre à
  27 voisins écrase le ciel.
- **B — Quatre paliers d'éclat (retenue)** : 0, 1, 2 ou 3 selon les voisins
  distincts (seuils 1, 5 et 12). La taille du cœur et la lueur dépendent du
  palier.
- **Halo** : l'`underlay` de Cytoscape n'a pas d'alpha par arrêt de dégradé
  et coûtait cher à redessiner. Chaque étoile est donc une **image SVG à
  dégradé radial** : un cœur plein et une lueur qui décroît jusqu'à 0, une
  image par groupe et par palier, générées une fois.

### Niveau de détail

- **A — Tous les noms et libellés.** Refusé à la validation : illisible sur
  300 entrées.
- **B — Seuil de zoom absolu (C1).** Ne tient pas compte de la taille du
  monde.
- **C — Paliers selon le zoom relatif au cadrage « ajuster » (retenue).**
  - Vue d'ensemble : noms du palier 3 seul. Puis palier 2 à ×1,4, palier 1 à
    ×2, tous à ×2,8 (facteur √2).
  - Monde de 50 étoiles visibles ou moins : tous les noms.
  - Étoile survolée, ses voisins et l'étoile sélectionnée : toujours nommés.
  - Libellés de relation au survol et à la sélection. Au zoom, seulement si 40
    lignes visibles ou moins.

### Disposition en constellations

- **A — fcose global (C1).** Les relations déclarées se perdent dans la masse.
- **B — Étirement affine vers le 16:9 de l'écran.** Essayé puis refusé : il
  déformait les figures.
- **C — Communautés, puis fcose par bloc, puis rangement (retenue).**
  1. **Communautés** : algorithme de Louvain maison, déterministe, avec des
     poids de 2 pour une relation déclarée et de 1 pour un lien du texte.
  2. **fcose par communauté**, avec une densité en √n.
  3. **Rangement en blocs** (`packCommunities`) : les blocs reliés sont
     voisins, le plus grand est au centre de sa rangée.
  4. **Orientation** de chaque bloc parmi 8 (rotations et symétries) pour
     rapprocher les étoiles reliées d'un bloc à l'autre.
  5. **Finition fcose par bloc**, les autres blocs fixés.
  6. **Étoiles sans lien** sur un arc sous le ciel. Le filtre « Étoiles sans
     lien » les masque.

  Ce calcul ne s'exécute qu'au premier affichage d'un monde et à
  « Réorganiser ». Une disposition mémorisée n'est jamais recalculée.

### « Ajuster à l'écran »

- **A — Bande réservée sur toute la largeur (C1).** Dézoome trop.
- **B — Coins réservés (retenue).** Les coins sont mesurés au moment du
  cadrage : titre et total, pilules, contrôles, sidebar en verre ouverte.
  `fitViewport` cherche le plus grand rectangle libre et y place le ciel à
  85 % d'occupation.

### Animations

- **Arrivée.** Calendrier pur (`sky-arrival.ts`) : les étoiles s'allument par
  paquets (8 au plus), par éclat décroissant, puis les lignes déclarées se
  tracent. Environ 1 s au total, quel que soit le monde. Une étoile éteinte
  l'est par une classe, sans transition : un paquet s'allume d'un coup.
  L'arrivée démarre au premier moment libre (`requestIdleCallback`, 400 ms au
  plus). Elle ne bloque jamais un clic.
- **Éclairage au survol.** Incrémental : seule la différence entre deux
  constellations change de classe. Fondu de 300 ms à l'entrée, 200 ms au
  retour. Suspendu pendant un glisser.
- **Tracé à la création.** La ligne se dessine de la source à la cible, puis
  la cible lance un éclat (underlay temporaire).
- **Reduced-motion** : état final directement, sans transition.

## Décision

Options retenues ci-dessus, plus les éléments d'interface :

- **Sidebar.** Sur la page du monde, une surcouche en verre sous la zone du
  titre, qui ne pousse plus le ciel. Préférence de repli en **cookie lu côté
  serveur**, pour ne plus avoir de saut à l'hydratation, avec migration
  unique depuis l'ancienne clé `localStorage`.
- **Titre.** Un voile radial assure le contraste AA quand une étoile passe
  dessous.
- **Compteurs.** Le total sous le titre, et la légende du ciel (groupe,
  couleur, icône, nombre) dans le panneau du menu du titre, hors du
  `role="menu"`.
- **Transition vers le pied de page.** Le ciel se fond dans le pied de page
  (jeton `--sky-fade-height`), sans graduation sur le bord bas.

## Conséquences

- **Modules purs et testés** dans `src/lib` : `sky-theme`, `sky-stylesheet`,
  `star-brightness`, `sky-detail`, `sky-arrival`, `sky-backdrop`,
  `sky-communities`, `sky-arrange`, `graph-layout` (rangement, orientation,
  arc, `fitViewport`). Le composant ne fait qu'appliquer.
- **Mode clair (KAN-71)** : il suffira de redéfinir les jetons `--sky-*`. Le
  test de cohérence de `sky-theme.test.ts` vérifie que chaque jeton lu existe
  dans `globals.css`.
- **Performance** (`docs/performance-constellation.md`) : sur le poste de
  référence, 60 images/s ou presque dans toutes les interactions.
  - **Limite connue et acceptée** (décision du 2026-10-31) : à CPU ×4, ni C1
    ni C2 ne tiennent 60 images/s au zoom, au glisser et au survol.
  - Ticket d'optimisation du rendu proposé.
- **Premier affichage d'un monde** plus long que C1 (≈ 0,7 s de calcul sur
  300 entrées, contre 0,55 s), puisque Louvain et la finition par bloc
  s'ajoutent à fcose. C'est payé une seule fois : la disposition est ensuite
  mémorisée.
- **Couleurs proches** à petite taille : Écologie et Magie, Lieux et Divers.
  Conforme, car la couleur n'est jamais seule (icône et nom dans la légende,
  type et icône dans la carte de sélection). À reprendre avec l'onglet
  « Apparence ».
- **Écartés du lot** : « une étoile naît », parallaxe, scintillement, couleurs
  choisies par l'auteur, mode clair.

# ADR-0032 — Disposition de la Constellation

- **Statut** : accepté
- **Date** : 2026-10-24
- **Décideur** : Aymeric (MOE)

## Contexte et problème

Jusqu'à KAN-87, la Constellation (ADR-0012) recalculait sa disposition à
chaque visite : layout `cose` relancé à chaque montage, et instance Cytoscape
recréée dès que ses éléments changeaient (nouvel objet à chaque rendu
serveur : création de relation, `router.refresh`). Conséquences : les étoiles
ne restaient jamais à la même place, un placement fait à la main était perdu,
et une création depuis le graphe aurait fait « sauter » tout le ciel.

KAN-87 (lot C1) fait de la Constellation **la page d'un monde**, en plein
écran, et demande :

- qu'elle se souvienne de la place de chaque étoile, du zoom et du cadrage ;
- qu'une nouvelle entrée soit placée sans déplacer les autres, dans le champ ;
- qu'on puisse relier deux entrées d'un geste ;
- des filtres par type d'entrée, par type de relation, et l'isolement ou le
  masquage d'une entrée et de ses voisins.

Contraintes : ne toucher ni à `Relation`, ni à `DeclaredRelation`, ni au
worker ; aucune position ne doit provoquer de re-rendu serveur ; une entrée
d'un autre monde ne doit jamais recevoir de position (OWASP A01).

## Options envisagées

- **A — JSON des positions sur `World`.** Une colonne, aucune table. Mais
  chaque déplacement réécrit tout le JSON (course entre deux onglets, perte
  silencieuse), l'intégrité référentielle est perdue (une entrée supprimée
  laisse une position orpheline) et rien ne prépare plusieurs tableaux.
- **B — Positions par utilisateur.** Inutile aujourd'hui (un monde = un
  propriétaire) et contraire au partage public prévu : la disposition fait
  partie de l'œuvre, pas d'une préférence d'affichage.
- **C — `localStorage`.** Zéro serveur, mais perdu en changeant de
  navigateur ou d'appareil, et jamais partagé.
- **D — Tables `Board` / `BoardNode`, tableau par défaut créé à la demande
  (retenue).**

## Décision

- **Modèle** : `Board` (monde, nom, `isDefault`, cadrage `zoom/panX/panY`
  nullable) et `BoardNode` (tableau, entrée, `x`, `y`), clé primaire
  `(boardId, entityId)`, cascades depuis `World`, `Board` et `Entity`. Écrits
  à la main dans la migration : un **index unique partiel** (un seul tableau
  par défaut par monde) et un **CHECK** (cadrage tout nul ou tout renseigné,
  `zoom > 0`). Preuve en `BEGIN … ROLLBACK` jointe au constat de session.
- **Tableau par défaut à la demande** : `getDefaultBoardLayout` le crée à la
  première visite, sans backfill. Deux premières visites simultanées : l'index
  partiel tranche, le perdant reçoit P2002 et relit le tableau du gagnant.
- **Même monde vérifié en service** : une position vise une entrée du monde
  du tableau. Il n'y a pas de clé étrangère composite (`Board.worldId` /
  `Entity.worldId`) ; `board-service.ts` compte les entrées
  `{ id in ids, worldId }` avant toute écriture et répond « Entrée
  introuvable. » sinon, comme pour une entrée inexistante.
- **Disposition partagée au niveau du monde**, pas de l'utilisateur.
- **Aucun `revalidatePath`** dans les actions de disposition : une sauvegarde
  ne déclenche jamais de re-rendu serveur. Sauvegarde au lâcher d'une étoile
  (regroupée, ~400 ms) et en fin de mouvement du cadrage (~800 ms) ; un échec
  affiche un toast discret, sans retour arrière.
- **Placement incrémental** : les entrées connues sont posées telles quelles
  (`preset`), les nouvelles par fcose avec les positions connues **fixées**
  (`fixedNodeConstraint`), puis ramenées dans la zone visible du cadrage
  courant. Le canvas reste invisible jusqu'à ce que tout soit posé.
- **Mise à jour par différence** : l'instance Cytoscape est créée une fois par
  montage ; quand les éléments changent, on ajoute, retire ou met à jour par
  id (`graph-diff.ts`), sans jamais relancer la mise en page des étoiles
  existantes.
- **Filtres côté navigateur** : calcul pur (`graph-filters.ts`) partagé par le
  canvas et la liste accessible, mémorisé par monde dans `localStorage`
  (valeur invalide ou entrée disparue ignorée sans erreur). Isoler / masquer
  parcourt les seules arêtes visibles après le filtre des types de relation.
- **Geste de liaison sans sens implicite** : poignée au survol d'une étoile ou
  `Shift + glisser` (cytoscape-edgehandles 4.0.1, une seule ligne tenue au
  pointeur, pas d'aimantation ni d'arête fantôme). Le lâcher ouvre une boîte
  où l'auteur choisit le type puis, pour un type dirigé, le sens parmi deux
  phrases lisibles ; le sens n'est jamais déduit du geste. La création passe
  par l'action existante de KAN-84. Le chemin **clavier** reste la section
  « Relations » de la fiche, inchangée.
- **Dépendances** : `cytoscape-fcose` 2.2.0 et `cytoscape-edgehandles` 4.0.1
  (MIT, versions exactes), `@types` associés en dépendances de développement.

## Conséquences

- La page `/worlds/[slug]` est la Constellation ; `/worlds/[slug]/graph`
  redirige (308) vers elle.
- Un monde existant reçoit son tableau à sa première visite ; sa disposition
  est alors calculée une fois puis gardée.
- **Limites assumées** :
  - une arête déclarée absorbe les reflets du texte de sa paire (une arête par
    paire, KAN-84) : si tous ses types déclarés sont masqués par le filtre,
    elle disparaît même si la paire est aussi citée dans le texte ;
  - isoler une entrée masquée par le filtre de types est ignoré (le badge le
    signale « entrée filtrée ») ;
  - le titre du monde est posé sur le canvas sans fond : la bande réservée par
    « ajuster » garde les étoiles dessous à l'affichage, mais un déplacement
    peut en faire passer une derrière le titre (voile prévu en C2).
- **Lot D** : `Board` porte déjà un nom et un drapeau `isDefault` ; plusieurs
  tableaux par monde et leur interface de gestion s'y ajouteront sans
  migration de données.
- **Partage public** : la disposition étant au niveau du monde, un monde
  partagé s'affichera dans la disposition de son auteur.

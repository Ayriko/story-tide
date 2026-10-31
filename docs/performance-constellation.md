# Performance de la Constellation

> Créé le 2026-10-31 (KAN-85, lot C2 « Le ciel d'histoires »). Cible de la
> vision visuelle : **60 images/s sur un monde de 300 entrées**, les
> animations ne touchant qu'à l'opacité, la taille et la position, sans
> jamais relancer la mise en page.

## Monde de test

`npm run seed:perf -- <email>` (`prisma/seed/perf.ts`) crée, pour un compte
existant, le monde **« Ciel de test · 300 »**. Le monde est recréé à l'identique
à chaque lancement : il est supprimé puis recréé. La génération est
déterministe (`src/lib/perf-world-generator.ts`, PRNG mulberry32 à graine fixe).

| Élément | Valeur |
|---|---|
| Entrées | 300, 37 à 38 par groupe (8 groupes) |
| Liens du texte | 600 (≈ 9 % MANUAL par mention @, le reste AUTO) |
| Relations déclarées | 150 (100 sur des paires déjà liées par le texte, 50 sur des paires nouvelles), 14 types natifs |
| Voisins distincts | 10 entrées isolées, 198 entrées à 1–4, 84 à 5–9, 8 « astres » à 14–27 |
| Grappes | 5 grappes, 85 % des liens à l'intérieur d'une grappe |

Le texte de chaque entrée cite ses cibles AUTO par leur nom et ses cibles
MANUAL par une mention. Un re-scan du worker retrouverait donc exactement les
mêmes liens. Aucun job n'est enfilé et aucune disposition n'est enregistrée :
le premier affichage passe par fcose.

Garde : le script refuse de tourner si `NODE_ENV=production` ou si l'hôte de
`DATABASE_URL` n'est pas `localhost`, `127.0.0.1` ou `::1`
(`src/lib/dev-script-guard.ts`), avant toute requête.

## Méthode

Banc reproductible `npm run perf:constellation -- <email> <mdp> [--reseed]
[--cpu=N] [--runs=3] [--base=URL]` (`scripts/perf-constellation.ts`).

- **Navigateur.** Chromium de Playwright **en fenêtre visible** (le rendu réel, GPU compris), à 1920×1080 et DPR 1. Les options `--disable-background-timer-throttling`, `--disable-backgrounding-occluded-windows`, `--disable-renderer-backgrounding` et `--disable-features=CalculateNativeWinOcclusion` sont actives. Sans elles, une fenêtre pilotée ou recouverte tombe à 24 images/s, voire à 1 image/s : le premier essai dans un Chrome piloté l'a montré, et ces chiffres ont été écartés. Chaque scénario rapporte `document.visibilityState` pour le prouver.
- **Serveur.** Il est lancé avec `NEXT_PUBLIC_E2E_HOOKS=1`, pour que le crochet de test donne la position des étoiles. Les chiffres retenus viennent d'un **build de production** (`next build` puis `next start`). `next dev` donne les mêmes valeurs en interaction.
- **Premier affichage**, avec `--reseed`, donc sans disposition enregistrée et en passant par fcose : tâches longues (PerformanceObserver `longtask`), CLS (`layout-shift`) et images dans les 2 s qui suivent l'apparition des étoiles.
- **Interactions** pilotées par des événements synthétiques sur le canvas, pendant une durée fixe, avec chaque image relevée par `requestAnimationFrame` :
  - `idle` (2 s) : référence de l'écran ;
  - `zoom` (3 s) : un cran de molette toutes les 2 images, avant puis arrière ;
  - `pan` (3 s) : glisser du fond en boucle ;
  - `drag` (3 s) : glisser de l'étoile la plus proche du centre ;
  - `hover` (3 s) : une nouvelle étoile survolée toutes les 6 images, soit environ 10 par seconde.
- **Résultats.** Médiane de 3 passages par scénario. Indicateurs : images/s, p95 et pire durée d'image, nombre d'images au-delà de 17,5 ms.
- **Deux profils.** CPU ×1 (poste de développement) et **CPU ×4** (`Emulation.setCPUThrottlingRate`). Un poste rapide sur un écran 60 Hz plafonne à 60 et masque les marges ; ×4 représente un portable modeste.

Machine : AMD Ryzen 7 5800X (8 cœurs / 16 threads), 32 Go, AMD Radeon RX 6650
XT, écran 1920×1080 à 60 Hz, Windows 11, Node 24.21, Chromium de Playwright
1.61.1 ; Chrome 156 pour le premier essai, écarté.

## Référence avant habillage (C1, commit 969f9b5), 2026-10-31

Build de production, monde « Ciel de test · 300 ».

| Mesure | CPU ×1 | CPU ×4 |
|---|---|---|
| Premier affichage : apparition des étoiles | 555 ms | 1 077 ms (*) |
| Premier affichage : tâche longue fcose | 554 ms | 3 121 ms |
| Premier affichage : CLS | 0 | 0 |
| Repos | 59,9 im/s | 59,9 im/s |
| Zoom molette | **59,9 im/s** (p95 16,8 ms) | **20,9 im/s** (p95 100 ms) |
| Déplacement de la vue | **59,9 im/s** (p95 16,8 ms) | **51,3 im/s** (p95 50 ms) |
| Glisser d'une étoile | **59,9 im/s** (p95 16,8 ms) | **20,1 im/s** (p95 50 ms) |
| Survol | **59,9 im/s** (p95 16,9 ms) | **47,6 im/s** (p95 50 ms) |

(*) À CPU ×4, le crochet de test apparaît avant la fin du calcul fcose.
L'image qui suit dure 3,7 s.

**Lecture.**
- Sur le poste de développement, la Constellation de C1 tient 60 images/s sur 300 entrées dans toutes les interactions. La seule tâche longue est le calcul fcose du tout premier affichage (≈ 0,55 s, une fois par monde, puisque la disposition est ensuite mémorisée).
- À CPU ×4, **C1 est déjà sous 60 images/s** pour le zoom, le glisser et, dans une moindre mesure, le survol et le déplacement. Chaque image redessine les 300 étoiles, leurs libellés et environ 650 arêtes sur le canvas.
- La cible de 60 images/s de la vision ne précise pas de machine de référence. Cet écart existe avant C2 et il est remonté à Aymeric, avec une proposition, avant les gates.

## Après habillage (KAN-85, ciel d'histoires), 2026-10-31

Même protocole, build de production, monde « Ciel de test · 300 » ressemé
(`--reseed`). CPU ×1 : médiane de 5 passages ; CPU ×4 : médiane de 3.

Le banc mesure en plus :
- **l'arrivée animée** : second affichage (disposition mémorisée), images
  pendant les 2 s qui suivent l'apparition des étoiles ;
- **la création d'une relation** : geste réel (Shift + glisser, boîte,
  « Créer »), images pendant les 1,2 s qui suivent le clic (trace, éclat, et
  rafraîchissement serveur des éléments).

| Mesure | C1 ×1 | C2 ×1 | C1 ×4 | C2 ×4 |
|---|---|---|---|---|
| Premier affichage : apparition | 555 ms | 355–575 ms | 1 077 ms | 1 047 ms |
| Premier affichage : tâche fcose | 554 ms | 452–533 ms | 3 121 ms | 2 697 ms |
| CLS (premier affichage et arrivée) | 0 | 0 | 0 | 0 |
| Repos | 59,9 | 59,9 | 59,9 | 45,8 (*) |
| Zoom molette | 59,9 | 55,9–57,6 | 20,9 | 18,2 |
| Déplacement de la vue | 59,9 | 59,9 | 51,3 | 59,9 |
| Glisser d'une étoile | 59,9 | 51,3–59,9 | 20,1 | 11,6 |
| Survol (éclairage de la constellation) | 59,9 | 55,3–57,9 | 47,6 | 13,0 |
| Arrivée animée (fenêtre de 2 s) | — | 53,4 | — | 4,4 |
| Création d'une relation (1,2 s) | — | 56,6 | — | 16,6 |

Images par seconde. Les fourchettes à ×1 correspondent aux deux campagnes
complètes du même jour, sur le même code ; à ×4, l'écart d'un passage à
l'autre atteint ±40 %.

(*) Repos à ×4 : un minuteur de sauvegarde du cadrage et la fin de l'arrivée
tombent dans la fenêtre.

### Lecture

- **Sur le poste de référence (×1), la cible est tenue, ou presque, dans
  chaque interaction.** Les rares images au-delà de 17 ms viennent
  d'événements ponctuels, pas de l'animation continue :
  - **Zoom** : le franchissement d'un seuil bascule une classe sur 300 étoiles (icônes) et sur les lignes (libellés), une image de 50 à 67 ms à chaque franchissement.
  - **Survol** : le premier survol atténue d'un coup tout le ciel (≈ 900 éléments), une image de 50 à 67 ms ; les survols suivants ne changent que la différence entre deux constellations.
  - **Arrivée** : la seule longue image (≈ 200 ms) est la fin d'hydratation de la page. L'animation démarre ensuite (`requestIdleCallback`, 400 ms au plus) : 2 images au-delà de 17 ms sur 107.
  - **Création d'une relation** : la réponse du serveur et le diff des éléments, pas le tracé.
- **Glisser à ×1** : 51 à 60 selon le passage. Le p95 de 33 ms montre des images qui ratent la synchronisation de temps en temps : le dessin complet du ciel frôle le budget de 16,7 ms sur ce poste.
- **À CPU ×4, C2 est sous 60 images/s, comme C1 l'était déjà.** Il est plus lent que C1 pour le glisser et surtout le survol.
  - **Cause du glisser** (profil CPU) : chaque image redessine tout le canvas, et le travail natif de dessin domine (≈ 45 % du temps). Les halos (underlay de 300 étoiles) et la lueur des 150 lignes déclarées agrandissent ce dessin.
  - **Cause du survol** : la transition d'atténuation (150 ms) anime environ 900 éléments, donc 150 ms de dessins complets à chaque nouvelle étoile survolée. Sans cette transition, le survol passe d'environ 15 à environ 22 images/s à ×4 (seul écart reproductible des variantes testées).

### Correctifs apportés pendant la mesure

| Constat | Correctif | Effet mesuré |
|---|---|---|
| Survol ÷4 à ×4 : la feuille de style contenait des fonctions, réévaluées à chaque recalcul de style | Sélecteurs constants (groupes, paliers, icônes : listes fermées) | Survol ×1 de 43,6 (constat sur `next dev`) à 55–58 (build de production) |
| Chaque survol recalculait tout le ciel | Éclairage incrémental : seule la différence entre deux constellations change | Survols suivants sans longue image |
| Glisser ×1 à 46,8 : l'éclairage se déclenchait sur les étoiles croisées pendant le glisser | Éclairage suspendu pendant tout glisser | Glisser ×1 de 46,8 à 59,9 |
| Arrivée : un tiers du temps à ×4 passé dans les transitions d'opacité (un fondu par étoile) | Une étoile éteinte l'est couche par couche, sans transition : un paquet s'allume d'un coup | Disparition de `overrideBypass` du profil |
| Arrivée démarrée pendant la fin d'hydratation | Départ au premier moment libre (`requestIdleCallback`, 400 ms au plus) | Arrivée ×1 de 44,5 à 53,4 |
| Éclair du ciel plein au départ : la classe « éteinte » posée après coup déclenchait une transition 1 → 0 | Éléments créés directement éteints | Aucun ciel plein visible avant l'arrivée |

## Après validation (C2, niveau de détail), 2026-10-31

Correctifs du retour de validation : noms par palier selon le zoom,
libellés de relation au survol et à la sélection, icônes retirées du canvas,
liens du texte très discrets, halos en image à dégradé doux (plus d'underlay
sur les étoiles), mise en page fcose aérée pour les grands mondes, fondu
d'atténuation 300 ms / 200 ms. Même protocole et même build.

| Mesure | C1 ×1 | C2 validé ×1 | C1 ×4 | C2 validé ×4 |
|---|---|---|---|---|
| Premier affichage : apparition | 555 ms | 294–560 ms | 1 077 ms | 1 046 ms |
| Premier affichage : tâche fcose | 554 ms | 433–438 ms | 3 121 ms | 2 114 ms |
| CLS | 0 | 0 | 0 | 0 |
| Repos | 59,9 | 59,9 | 59,9 | 47,8 |
| Zoom molette | 59,9 | 57,6 | 20,9 | 17,0 |
| Déplacement de la vue | 59,9 | 59,9 | 51,3 | 49,0 |
| Glisser d'une étoile | 59,9 | 59,9 | 20,1 | 18,9 |
| Survol (éclairage) | 59,9 | 53,6 | 47,6 | 13,3 |
| Arrivée animée (2 s) | — | 52,4 (*) | — | 3,9 |
| Création d'une relation | — | 51,6 | — | 15,0 |

(*) Deux passages sur trois ; le troisième contient une image de 1 001 ms
sans aucune tâche longue au-delà de 201 ms. C'est le bridage d'une fenêtre
momentanément en arrière-plan, pas du travail de la page : mesure écartée.

**Lecture.**
- Sur le poste de référence, le glisser revient au niveau de C1 (59,9).
  L'image de l'étoile (cœur et lueur) remplace l'underlay.
- Zoom et survol gardent quelques images longues sur des événements
  ponctuels :
  - zoom : franchissement d'un palier de noms (bascule d'une classe sur
    les étoiles du palier) ;
  - survol : premier survol, qui atténue d'un coup tout le ciel.
- La création d'une relation inclut la réponse du serveur et le diff des
  éléments.

## Mesure finale (C2 livré), 2026-10-31

Code final du lot : constellations (Louvain, rangement et orientation des
blocs, finition par bloc), « Ajuster » par coins réservés, sidebar en verre,
voile du titre, total et légende, fondu vers le pied de page. Même protocole :
build de production avec le crochet, serveur de développement arrêté, monde
ressemé (`--reseed`). CPU ×1 : médiane de 5 passages ; CPU ×4 : médiane de 3.

| Mesure | Avant (C1) ×1 | Après (C2) ×1 | Avant (C1) ×4 | Après (C2) ×4 |
|---|---|---|---|---|
| Premier affichage : apparition | 555 ms | 648 ms | 1 077 ms | 891 ms |
| Premier affichage : tâche de disposition | 554 ms | 716 ms | 3 121 ms | 3 303 ms |
| CLS (premier affichage et arrivée) | 0 | 0 | 0 | 0 |
| Repos | 59,9 | 59,9 | 59,9 | 51,7 |
| Zoom molette | 59,9 | 56,9 (p95 16,9 ms) | 20,9 | 32,3 |
| Déplacement de la vue | 59,9 | 59,9 | 51,3 | 59,6 |
| Glisser d'une étoile | 59,9 | 59,9 | 20,1 | 19,4 |
| Survol (éclairage) | 59,9 | 53,6 (p95 33,3 ms) | 47,6 | 15,5 |
| Arrivée animée (2 s) | — | 49,5 | — | 1,5 (*) |
| Création d'une relation (1,2 s) | — | 54,1 | — | 14,4 |

Images par seconde, sauf mention.

(*) À ×4, la fenêtre de 2 s de l'arrivée est occupée par la fin de
l'hydratation (tâche longue de 1,2 s) : 3 images seulement.

### Lecture

- **Poste de référence (×1).**
  - Déplacement, glisser et repos tiennent 59,9 images/s.
  - Zoom, survol et création d'une relation restent entre 54 et 57. Leurs
    images longues sont ponctuelles : franchissement d'un palier de noms,
    premier survol qui atténue tout le ciel, réponse du serveur.
- **Premier affichage.** La tâche de disposition passe de 0,55 s (C1) à
  0,72 s. Louvain, le rangement et la finition par bloc s'ajoutent à fcose.
  C'est payé une seule fois par monde, puisque la disposition est ensuite
  mémorisée. Le ciel apparaît après 0,65 s, sans décalage (CLS 0).
- **Machine modeste (×4).**
  - Le zoom progresse (20,9 → 32,3) : les noms n'étant plus tous affichés,
    chaque image dessine moins de texte.
  - Le déplacement revient à 59,6.
  - Le glisser reste au niveau de C1.
  - Le survol reste le plus pénalisé (fondu d'atténuation de ≈ 900 éléments).
- **Écart d'un passage à l'autre.** Jusqu'à ±40 % à ×4. À ×1, sur
  5 passages : zoom de 55,3 à 57,9, survol de 45,6 à 53,9.

## Décision du 2026-10-31 : machine de référence

**Référence = le poste de développement décrit plus haut** (option (a)
d'Aymeric). La cible « 60 images/s sur 300 entrées » s'y apprécie. Le fondu
d'atténuation du survol est conservé, même s'il coûte cher sur machine
modeste. Les halos ont été allégés.

**Limite connue, acceptée : CPU ×4.** Ni C1 ni C2 n'y tiennent 60 images/s
pour le zoom, le glisser et le survol.
- Chaque image redessine tout le canvas, et le travail natif de dessin
  domine le profil.
- Le survol y est le plus pénalisé : la transition d'atténuation anime
  environ 900 éléments pendant 300 ms.
- Ticket d'optimisation proposé ci-dessous.

### Ticket proposé : « Optimiser le rendu de la Constellation sur machine modeste »

> **Constat.** Sur le monde de test « Ciel de test · 300 », avec CPU ralenti
> ×4 (`npm run perf:constellation -- <email> <mdp> --cpu=4`), la
> Constellation livrée par KAN-85 tient le déplacement (59,6 images/s) mais
> descend à 32 images/s au zoom, 19 au glisser et 15 au survol (mesure finale
> du 2026-10-31). C1 était déjà sous 60 (zoom 20,9, glisser 20,1). Le survol
> est le plus pénalisé, à cause du fondu d'atténuation. Sur le poste de
> développement, tout tient 54 à 60 images/s.
>
> **Cause.** Cytoscape redessine tout le canvas à chaque image d'un geste.
> Le profil CPU montre le travail natif de dessin en tête (≈ 45 %), puis le
> calcul de style des éléments en transition.
>
> **Pistes, chacune à mesurer seule avec le banc :**
> 1. `textureOnViewport: true` : pendant un zoom ou un déplacement,
>    Cytoscape déplace une image du ciel au lieu de le redessiner.
> 2. Masquer les noms et libellés pendant les gestes (zoom, déplacement,
>    glisser) et les rétablir à la fin.
> 3. Atténuation au survol sans transition sous un seuil de performance
>    mesuré (par exemple, une image de plus de 33 ms au premier survol).
> 4. Réduire la taille des images d'étoiles aux faibles zooms (lueur plus
>    petite en vue d'ensemble).
> 5. `hideEdgesOnViewport` pour les liens du texte seulement, si Cytoscape le
>    permet par classe ; sinon, les masquer pendant les gestes.
>
> **Critère d'acceptation.** À CPU ×4 : déplacement et zoom à 60 images/s,
> glisser et survol à au moins 30. À CPU ×1 : aucune régression. Pour chaque
> piste retenue, le tableau avant / après dans
> docs/performance-constellation.md.

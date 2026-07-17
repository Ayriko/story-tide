# ADR-0010 — Rendu du graphe de relations : SVG/DOM au MVP, canvas 2D à l'échelle

> **Emplacement cible :** `docs/adr/ADR-0010-rendu-graphe.md`
> ⚠️ **Numéro à vérifier** : le dev-log référence des ADR jusqu'à 0009. Renuméroter au prochain numéro libre de `docs/adr/` si 0010 est déjà pris.

- **Statut :** Proposé *(à valider par Aymeric)*
- **Date :** 2026-07-17
- **Décideurs :** Aymeric (MOE / référent technique)
- **Compétences liées :** C2.2.1 (architecture/prototype), parade du risque principal « performance du liage à l'échelle »

## Contexte

Story Tide affiche un **graphe de relations** entre entités. Deux sources de relations l'alimentent : explicites (propriétés-relations, mentions manuelles) et **implicites, auto-détectées par Aho-Corasick** — ce qui peut faire croître le nombre de nœuds/arêtes plus vite qu'un outil à liage manuel.

L'audit de vvd (2026-07-17) montre que leur graphe est rendu en **canvas 2D** (avec une fine couche SVG en overlay), **pas en WebGL** ni en DOM/SVG pur. C'est un choix de performance : le DOM/SVG (approche de react-flow) devient coûteux au-delà de quelques centaines de nœuds ; le canvas 2D encaisse des milliers ; WebGL n'est requis qu'aux très gros volumes (dizaines de milliers).

Il faut donc arbitrer la techno de rendu du graphe **sans surdimensionner** pour le MVP ni **se bloquer** pour l'échelle.

## Décision (proposée)

Adopter une trajectoire en deux temps :

1. **MVP — react-flow (rendu SVG/DOM).** Mise en place rapide, interactions (drag, zoom, sélection) et stylage prêts, démo propre pour le Bloc 3. Suffisant pour des mondes de taille petite à moyenne (jusqu'à ~quelques centaines de nœuds).
2. **Passage à l'échelle — bascule vers une lib canvas 2D** (cytoscape.js en renderer canvas, ou sigma.js) **si et seulement si** une mesure réelle montre une dégradation (comme la logique déjà appliquée au cache de l'automate : on optimise sur preuve, pas par anticipation).

Isoler le composant graphe derrière une interface stable (données nœuds/arêtes en entrée, événements de sélection en sortie) pour que le remplacement du moteur de rendu reste local.

## Alternatives considérées

- **Tout SVG/DOM (react-flow) quel que soit le volume** — écartée : plafond de perf connu, risque sur les gros mondes qui sont précisément le point de démonstration de la parade au risque principal.
- **Canvas 2D d'emblée (cytoscape/sigma)** — écartée pour le MVP : plus de code d'interaction/stylage à écrire à la main pour un bénéfice non nécessaire à petite échelle ; réintroduite comme cible d'évolution.
- **WebGL d'emblée** — écartée : complexité disproportionnée ; vvd lui-même ne va pas jusque-là.

## Conséquences

- **Positives :** vélocité MVP (react-flow) + trajectoire de montée en charge documentée ; l'arbitrage sert directement C2.2.1 et matérialise l'anticipation de la perf pour le dossier.
- **Négatives / à surveiller :** une bascule ultérieure de moteur demande de ré-implémenter le rendu et une partie des interactions → d'où l'interface d'isolation du composant graphe dès le MVP.
- **Déclencheur de réévaluation :** métrique de rendu/interaction dégradée sur un monde réel volumineux (FPS, latence de layout).

## Références

- `docs/design/reference-vvd.md` §5 (graphe vvd = canvas 2D + overlay SVG).
- Décision analogue « optimiser sur preuve » : automate Aho-Corasick reconstruit à chaque job tant qu'aucun besoin de cache n'est démontré (dev-log 2026-07-15).

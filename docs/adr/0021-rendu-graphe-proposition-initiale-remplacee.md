# ADR-0021 — Rendu du graphe de relations : proposition initiale (react-flow puis bascule), remplacée par ADR-0012

- **Statut** : remplacé par ADR-0012
- **Date** : 2026-07-17 (proposition initiale) — classé/renuméroté le 2026-07-22
- **Décideur** : Aymeric (MOE)

## Contexte et problème

Ce document est un **brouillon orphelin**, retrouvé dans `docs/adr/extern-entry/
ADR-0010-rendu-graphe.md` — un emplacement et un numéro (0010) qui ne correspondaient à
aucun ADR réellement déposé dans `docs/adr/` (0010 avait entre-temps été pris par
`0010-surlignage-liaisons-scan-client.md`), en collision de numérotation non résolue
depuis sa rédaction. Il est reclassé ici sous un numéro réel pour traçabilité (C2.4.1) —
un choix de conception, même écarté, ne doit pas disparaître sans laisser de trace — puis
`docs/adr/extern-entry/` est supprimé.

Le contenu original (2026-07-17) posait l'arbitrage du rendu du graphe de relations :
canvas 2D vs SVG/DOM vs WebGL, avec une trajectoire en deux temps proposée (react-flow au
MVP, bascule vers cytoscape/sigma si une mesure réelle montrait une dégradation).

## Décision (finalement retenue, ailleurs)

La décision réellement adoptée est documentée dans **ADR-0012** (`0012-graphe-cytoscape.md`)
: **cytoscape.js dès le départ**, pas de trajectoire en deux temps react-flow → canvas.
Cette proposition initiale (react-flow au MVP) n'a donc jamais été implémentée telle
quelle — remplacée avant toute mise en œuvre.

## Compétence(s) servie(s)

C2.4.1 (traçabilité — y compris d'une décision écartée, pour ne pas perdre le
raisonnement qui a mené à ADR-0012).

---
name: scroll-smooth-measurement
description: >
  Mesure ou capture d'écran par script (contraste, position, screenshot
  Playwright) qui donne un résultat ne correspondant à aucun état réel de la
  page. Déclencheurs : scroll-behavior smooth, scrollTop, scrollIntoView,
  getBoundingClientRect, screenshot décalé, ratio de contraste aberrant,
  mesure pendant une animation, état transitoire, HMR périmé, vérifier l'état
  au moment exact de la capture.
---

# `scroll-behavior: smooth` + `scrollTop` = animation, pas saut

## Le symptôme

Un script de mesure de contraste sort 1,53:1 sur un texte qui, à l'œil, n'est
jamais posé sur le bouton incriminé. La valeur ne correspond à **aucun** état
réel de la page.

## La cause

Avec `scroll-behavior: smooth` (global ou sur le conteneur), régler
`scrollTop` déclenche une animation. Le script lisait
`getBoundingClientRect()` puis prenait le screenshot à deux instants
différents de cette animation : deux états, une mesure incohérente.

## La solution

Forcer le défilement instantané avant toute mesure :

```ts
el.style.scrollBehavior = "auto";
el.scrollTop = y;                       // saut immédiat
// mesurer / capturer ici, dans le même tick
```

Puis **confirmer l'état** par un recadrage visuel de la zone mesurée
(avant/après correctif), pas en supposant.

## Règle

Même famille que le cache HMR périmé (26/08) : ne jamais faire confiance à
une mesure sans vérifier l'état réel de la page au moment exact de la
capture. Toute mesure outillée sur ce projet neutralise d'abord les
animations (scroll, transitions) et attend un état stable.

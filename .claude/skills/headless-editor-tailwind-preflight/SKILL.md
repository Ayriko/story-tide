---
name: headless-editor-tailwind-preflight
description: >
  À utiliser dès qu'on intègre ou débogue le rendu visuel de l'éditeur Tiptap
  (ou tout éditeur headless) dans Story Tide sous Tailwind. Déclencheurs :
  Tiptap, EditorContent, éditeur headless, titre/liste/citation invisible ou
  sans style malgré un node correct, Preflight, styles de contenu riche, ProseMirror
  rendu sans mise en forme.
---

# Éditeur headless + Tailwind : styler le contenu dès l'intégration

## Le piège (vécu en conditions réelles, 2026-07-14, éditeur Tiptap)

Tiptap est **headless** : il ne fournit aucun CSS pour le contenu qu'il rend
(`<h2>`, `<ul>`, `<blockquote>`...). Séparément, **Tailwind Preflight** (le reset
CSS activé par défaut) neutralise silencieusement les styles natifs du navigateur
sur ces mêmes éléments : plus de taille de police différenciée sur les titres,
plus de puces sur les listes, plus d'indentation sur les citations.

Combinés, un titre/une liste/une citation appliqués **correctement** (node
ProseMirror réellement présent, vérifiable dans le JSON sauvegardé) sont
**visuellement indiscernables d'un paragraphe**. Symptôme rapporté : « les
titres/listes ne fonctionnent pas » alors que le bug réel est purement
esthétique - la donnée est juste, le rendu ne l'exprime pas.

## La correction

Styler explicitement chaque élément de contenu riche dès l'intégration de
l'éditeur, pas après-coup. Dans ce repo : classes Tailwind arbitraires ciblant
les sélecteurs enfants du conteneur `EditorContent` :

```
[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2
[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-2
[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
[&_blockquote]:border-l-4 [&_blockquote]:pl-3 [&_blockquote]:italic
```

## Règles pour ce repo

- `src/app/(app)/worlds/[slug]/entities/[entityId]/entity-editor.tsx` :
  `EditorContent` porte déjà ces classes - toute nouvelle extension Tiptap qui
  introduit un node/mark avec un rendu visuel (nouveau type de liste, table...)
  doit ajouter ses propres classes au même endroit, dans le même commit que
  l'extension.
- Ne jamais valider "le node est bien appliqué" seulement via le JSON persisté -
  vérifier aussi le rendu visuel réel (capture ou navigateur), le JSON correct
  n'implique pas un rendu visible.

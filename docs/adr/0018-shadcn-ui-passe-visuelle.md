# ADR-0018 — shadcn/ui pour la passe visuelle du parcours démo (KAN-36)

- **Statut** : accepté
- **Date** : 2026-07-20
- **Décideur** : Aymeric (MOE)

## Contexte et problème

Le front est encore au thème starter Next (blanc/noir, Geist, `zinc-*` partout,
`docs/design/reference-vvd.md` §8 note l'écart). KAN-36 vise une passe visuelle
« Option A » limitée au **parcours démo** (connexion → mondes → fiche → éditeur
→ backlinks → graphe), au registre sombre/éditorial et à la palette Bloc 1
(NAVY/INK/MINT), en vue du kit jury manipulable pour l'oral Bloc 3 — le gel du
24 juillet ne laisse plus de fenêtre pour une itération ultérieure sur ce sujet.
`reference-vvd.md` §8 avait déjà acté « couche composants shadcn/ui (sur Radix)
+ `@tailwindcss/typography` » comme décision de principe ; ADR-0016 (combobox de
type) l'anticipait aussi explicitement en documentant `EntityTypeCombobox` comme
composant jetable en attendant ce chantier. Cet ADR formalise cette introduction
de dépendance (jusqu'ici jamais actée formellement, seulement évoquée) avant que
le premier `npx shadcn init` ne soit lancé.

## Options envisagées

- **A — shadcn/ui (code vendored, sur Radix Primitives)** : composants copiés
  dans `src/components/ui/`, pas un package binaire — modifiable et lisible en
  totalité pendant l'oral. Radix fournit clavier/focus/ARIA natifs pour les
  primitives interactives (dialog, combobox/command, popover) sans les
  réécrire à la main. Licence MIT, compatible Tailwind v4 (CSS variables,
  `tw-animate-css`) déjà en place dans le projet.
- **B — Tokens Tailwind purs, sans librairie de composants** : zéro nouvelle
  dépendance, entièrement fait main (déjà le patron `EntityTypeCombobox`,
  `mention-list.tsx`). Conservée comme **repli explicite** si un imprévu de
  Phase 0 avait compromis la timebox — Phase 0 n'a révélé aucun bloquant
  (lint/typecheck/tests/couverture/e2e CI tous au vert), donc ce repli n'est
  pas déclenché maintenant.
- **C — Refonte complète du front (patterns vvd : rail de nav, command palette
  `Ctrl+K`, `cardHeader`/`contentBody`)** : hors périmètre du gel du 24 juillet
  et du scope KAN-36 (passe visuelle, pas refonte structurelle) — rejetée,
  reportée en points d'observation pour KAN-33 (backlog post-certification).

## Décision

**Option A — shadcn/ui**, introduit strictement pour la passe visuelle du
parcours démo. Le thème par défaut généré par `npx shadcn init` est
**immédiatement écrasé** par les tokens Bloc 1 (`docs/design/reference-vvd.md`
§2.1 : NAVY `#122A3A` fond, INK `#1C3A4B` surface, NAVY2 `#15394A`, MINT
`#1FB39A` accent primaire, TEAL `#0E7C86` hover/secondaire, AMBER `#D99000`
alertes uniquement) — sans ce garde-fou le rendu se confond avec un template
shadcn générique, contraire à l'objectif éditorial. Typo Fraunces (titres) +
Inter (corps) via `next/font`, `@tailwindcss/typography` pour le contenu
éditeur. Périmètre strictement limité au parcours démo (connexion/accueil,
mondes, fiche, chrome éditeur, backlinks, chrome/filtres du graphe) : les
écrans hors parcours gardent l'ancien style Tailwind brut, coexistence
assumée et temporaire. `EntityTypeCombobox` (ADR-0016) est remplacé par le
composant `Command` de shadcn dans la foulée — solde de la dette actée par
cet ADR.

## Conséquences

- **Positives** : les composants générés par `shadcn add` sont vendored dans
  `src/components/ui/` (pas une boîte noire, lisibles/modifiables en
  totalité à l'oral) ; **nuance** : les primitives `@radix-ui/*` sous-jacentes
  restent, elles, des dépendances npm standard (pas vendored) — auditées via
  `npm audit` comme le reste de `package.json`, à lancer juste après l'init
  (4 jours avant le gel, marge suffisante pour traiter un éventuel signalement).
  Radix couvre gratuitement clavier/focus/ARIA sur les primitives interactives
  introduites (combobox/command, popover pour le panneau de connexion) →
  argument direct pour C2.2.3 ; compatible avec la stack actée (Tailwind v4
  déjà en place, aucune techno hors stack au sens CLAUDE.md).
- **Négatives / dette assumée** : coexistence temporaire de deux styles
  (ancien Tailwind brut hors parcours démo, nouveau shadcn/tokens Bloc 1 sur
  le parcours démo) — assumée et documentée ici, à résorber progressivement
  hors de cette session (post-certification, cf. KAN-33). Toute nouvelle
  fonctionnalité de refonte structurelle repérée pendant l'implémentation
  (rail de navigation, command palette `Ctrl+K`, patron `cardHeader`/
  `contentBody`) est **notée pour KAN-33**, pas implémentée ici.
  `npx shadcn init` peut modifier des fichiers existants (`globals.css`,
  configuration Tailwind/TS) au-delà des seuls fichiers qu'il crée — diff
  systématique avant tout commit de l'étape 2, pas de confiance aveugle dans
  le générateur.

## Compétence(s) servie(s)

C2.2.1 (choix d'architecture front, justifié — coexistence documentée plutôt
que subie) ; C2.2.3 (accessibilité — Radix apporte clavier/focus/ARIA natifs
sur les composants interactifs introduits) ; C2.4.1 (traçabilité d'une
décision de stack, solde explicite d'ADR-0016).

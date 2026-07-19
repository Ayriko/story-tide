# ADR-0016 — Combobox de type interne, en attendant shadcn (KAN-36)

- **Statut** : accepté
- **Date** : 2026-07-19
- **Décideur** : Aymeric (MOE)

## Contexte et problème

KAN-18 (cadrage 19/07) : le sélecteur de type à la création de fiche doit
devenir **cherchable** (26 types répartis en 8 groupes, un `<select>` plat de
26 `<option>` devient malcommode). La demande initiale évoquait un dialog
`Command`/`cmdk` (shadcn). Or **shadcn/cmdk n'existe dans aucune forme dans le
stack actuel** (aucune dépendance `cmdk`/`@radix-ui`/`shadcn` dans
`package.json`, aucun `components.json`, aucun `src/components/ui/`) — et
**KAN-36 (passe visuelle shadcn, 21-22/07)** arrive immédiatement après ce
sprint. Introduire shadcn maintenant, pour un seul champ, à quelques jours
d'un chantier dédié à son introduction complète, pose un risque réel de
travail jeté (un composant construit aujourd'hui, remplacé dans 2-3 jours).

## Options envisagées

- **A — Introduire shadcn/cmdk dès ce ticket** : répond littéralement à la
  demande initiale, mais viole la règle CLAUDE.md "pas de techno hors stack
  actée sans accord" sans bénéfice net vu la proximité de KAN-36 — écartée.
- **B — `<select>` natif avec `<optgroup>` par groupe** : zéro nouveau code,
  mais pas "cherchable" (pas de filtrage au clavier) — ne répond pas au besoin
  exprimé.
- **C — Combobox interne, reprenant le patron déjà établi par
  `mention-list.tsx`** (`role="listbox"`/`"option"`, navigation clavier
  flèches+Entrée+Échap, `aria-activedescendant`) — retenue.

## Décision

Composant **`EntityTypeCombobox`** (`src/app/(app)/worlds/[slug]/
entity-type-combobox.tsx`), interne, zéro nouvelle dépendance : un champ texte
(`role="combobox"`) filtre les 26 types par libellé, une liste
(`role="listbox"`) groupée par famille (`role="group"` + en-tête) s'affiche en
dessous, navigation clavier complète (flèches, Entrée, Échap), un
`<input type="hidden">` porte la vraie valeur soumise au `<form action>`
existant (`useActionState`) — **aucun changement dans `createEntityAction`/
`updateEntityAction`**, le composant s'insère à la place du `<select>` sans
toucher la couche action.

**KAN-36 remplacera ce composant par le `Command` shadcn** au moment prévu
pour la passe visuelle — c'est un remplacement anticipé, pas une extension à
maintenir indéfiniment.

## Conséquences

- **Positives** : répond au besoin ("cherchable", groupé) sans dérogation à la
  règle stack ; zéro dépendance ajoutée puis retirée en quelques jours ;
  réutilise un patron d'accessibilité déjà audité (`mention-list.tsx`),
  cohérence de convention dans le code base.
- **Négatives / à surveiller** : `EntityTypeCombobox` est un composant
  **jetable par construction** — ne pas l'enrichir au-delà du strict besoin de
  ce ticket (pas de virtualisation, pas d'options avancées) puisqu'il sera
  remplacé sous quelques jours ; documenté ici pour que KAN-36 sache
  explicitement qu'il doit le remplacer, pas le faire cohabiter indéfiniment
  avec shadcn.

## Compétence(s) servie(s)

C2.2.1 (choix d'architecture front, justifié) ; C2.2.3 (accessibilité —
patron combobox natif, clavier complet) ; C2.4.1 (traçabilité d'une décision
de stack explicitement temporaire).

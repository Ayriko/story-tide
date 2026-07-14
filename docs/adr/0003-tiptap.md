# ADR-0003 — Tiptap comme éditeur riche

- **Statut** : accepté
- **Date** : 2026-07-02
- **Décideur** : Aymeric (MOE)

## Contexte et problème

Les fiches d'entité ont besoin d'un éditeur riche (titres, listes, gras/italique,
citations, liens, images), avec sauvegarde en JSON ProseMirror et extraction d'un
`plainText` pour le scan de liaison automatique et la recherche.

## Options envisagées

- **BlockNote** : paradigme blocs façon Notion — explicitement écarté (interdit par
  le cadrage projet, pas de paradigme blocs à apprendre/défaire pour les
  utilisateurs de logiciels de worldbuilding de référence).
- **Lexical** (Meta) : écarté.
- **Tiptap** (headless, MIT, self-hosted) : retenu.

## Décision

Tiptap pur. UI alignée sur les logiciels de référence du domaine (pas de paradigme
blocs), continuité avec les choix Bloc 1 (C1.3.2).

## Conséquences

- **Positives** : contrôle total du rendu ; JSON ProseMirror natif, adapté aux
  décorations de surlignage par position de caractère ; licence MIT self-hosted.
- **Négatives (dette assumée)** : plus de configuration à écrire soi-même qu'avec un
  éditeur « batteries included ».

## Compétence(s) servie(s)

C2.2.1 (framework et paradigmes) ; C2.4.1. **Implémenté le 2026-07-14** :
`src/lib/tiptap-extensions.ts` (allowlist), `EntityEditor` (composant client),
validation serveur du contenu — voir ADR-0009.

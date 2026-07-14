# ADR-0009 — Validation serveur du contenu Tiptap via le schéma ProseMirror réel

- **Statut** : accepté
- **Date** : 2026-07-14
- **Décideur** : Aymeric (MOE)

## Contexte et problème

`Entity.content` stocke un document JSON ProseMirror produit par l'éditeur Tiptap.
La configuration du client (nodes/marks activés) ne protège en rien le serveur :
une requête directe vers l'action de sauvegarde (hors éditeur réel) peut envoyer
n'importe quel JSON. Le plan de session exige un « schéma de nodes strict
(allowlist) » pour OWASP A03 — il faut donc une validation serveur, pas seulement
une configuration client.

## Options envisagées

- **Schéma Zod fait main pour l'AST ProseMirror** : récursif, doit être tenu à jour
  manuellement à chaque changement d'extension Tiptap (nouveau node, nouvel
  attribut) — risque de dérive entre le schéma Zod et le schéma réel de l'éditeur.
- **Construire un vrai schéma ProseMirror** (`getSchema(editorExtensions)` depuis
  `@tiptap/core`) et valider avec `Node.fromJSON(schema, json)` + `doc.check()`
  (`@tiptap/pm/model`, ré-export de `prosemirror-model`) — retenu.

## Décision

Validation via le schéma ProseMirror réel, construit **une seule fois** à partir de
la même liste d'extensions (`src/lib/tiptap-extensions.ts`) que l'éditeur client.
`Node.fromJSON` lève si un type de node/mark est absent du schéma (ex. `codeBlock`
désactivé) ; `check()` vérifie en plus l'intégrité structurelle du document
construit. Un seul point de vérité pour « qu'est-ce qu'un contenu valide » — client
et serveur ne peuvent pas diverger, contrairement à un schéma Zod dupliqué à la main.

## Conséquences

- **Positives** : zéro risque de dérive schéma client/serveur ; rejet correct même
  d'un payload structurellement valide en JSON mais invalide pour ProseMirror
  (node inconnu, structure ne respectant pas le `content` du parent) ; vérifié en
  conditions réelles avec un payload `codeBlock` (node désactivé) — rejeté comme
  attendu.
- **Négatives (dette assumée)** : dépendance à l'API interne de `prosemirror-model`
  (`Node.fromJSON`) plutôt qu'à un schéma applicatif indépendant ; si Tiptap change
  radicalement son modèle de schéma dans une future version majeure, cette
  validation devra être revue en même temps que la mise à jour de dépendance.
- **Gotcha découvert en écrivant les tests** : un « document ProseMirror vide » au
  sens naïf (`{ type: "doc", content: [] }`) est en réalité **invalide** — le node
  `doc` exige au moins un bloc enfant (`content: "block+"`). Le contenu minimal
  valide est `{ type: "doc", content: [{ type: "paragraph" }] }`
  (`EMPTY_CONTENT`, `src/lib/tiptap-content.ts`). Détecté par un test qui échouait
  avant le premier commit, pas en production.

## Compétence(s) servie(s)

C2.2.3 (sécurité, OWASP A03) ; C2.2.2 (tests — `tiptap-content.test.ts`) ; C2.4.1.

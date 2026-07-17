---
name: rsc-serialization-boundary
description: >
  Passer du contenu Tiptap/ProseMirror (ou tout objet de classe tierce) à travers
  la frontière Next.js RSC / Server Action sans crash de sérialisation React Flight.
  Déclencheurs : "Only plain objects, and a few built-ins, can be passed to Client
  Components", "Cannot access level on the server", "dot into a temporary client
  reference", React Flight, sérialisation Server Action, RSC vers Client Component,
  doc.toJSON(), ProseMirror toJSON, Tiptap JSON, parseContent, saveEntityContentAction,
  objet imbriqué en argument, plain object Next.js.
---

# Frontière de sérialisation RSC / Server Action (Next.js)

Deux crashs distincts, même cause racine : un objet non-« plain » traverse la
frontière React Flight. Ne jamais faire passer une **forme re-dérivée par une
classe tierce** (ProseMirror/Tiptap ou autre) à travers la frontière.

## Cas A — argument d'un appel direct de Server Action

`Error: Cannot access <x> on the server. You cannot dot into a temporary client
reference from a server component.`

Message trompeur (mentionne un attribut du node, ex. `level`) : c'est en fait une
erreur de sérialisation Flight. Passer l'arbre JSON imbriqué de Tiptap en argument
positionnel brut à une Server Action appelée **directement** (pas via `<form>`)
heurte un cas limite où une partie de l'objet est traitée comme référence
temporaire non résolue.

**Fix** : `JSON.stringify(content)` côté client avant l'appel, `JSON.parse()` en
premier côté serveur. Une chaîne traverse toujours la frontière comme donnée déjà
résolue.

## Cas B — prop RSC → Client Component

`Error: Only plain objects, and a few built-ins, can be passed to Client
Components from Server Components. Classes or null prototypes are not supported.`

Cause : renvoyer `doc.toJSON()` (représentation re-dérivée par ProseMirror) au lieu
du contenu d'origine. Cette forme interne n'est pas « plain » au sens strict de
React et casse la frontière quand elle repart en prop.

**Fix** : valider via `Node.fromJSON()` + `check()` mais **retourner l'argument
d'origine** (déjà JSON pur, venant de Postgres ou de `JSON.parse`), jamais
`doc.toJSON()`. Si une re-dérivation est indispensable, forcer le plain
explicitement : `JSON.parse(JSON.stringify(x))`.

## Note debug

`.next/dev/logs/next-development.log` relaie les erreurs console du navigateur
connecté (dev overlay) vers un fichier lisible côté serveur — mais seulement pour
une vraie session navigateur. `curl` ne le déclenche jamais : ces crashs
n'apparaissent qu'à l'hydratation/désérialisation Flight côté navigateur.

---
name: rsc-boundary-plain-json
description: >
  À utiliser dès qu'une donnée traverse la frontière RSC/Server Action ↔ Client
  Component dans Story Tide, en particulier des arbres JSON imbriqués (contenu
  Tiptap/ProseMirror, JSON Prisma) passés en prop ou en argument. Déclencheurs :
  "Cannot access ... on the server", "temporary client reference", "Only plain
  objects... Classes or null prototypes are not supported", Server Action appelée
  directement (hors <form action>), toJSON(), passer un objet en prop à un
  Client Component.
---

# Frontière RSC/Server Action ↔ Client : toujours du JSON déjà plain

## Le piège (vécu en conditions réelles, 2026-07-14, éditeur Tiptap)

Deux erreurs distinctes, toutes deux causées par la même règle enfreinte : Next.js
(React Server Components / Server Actions, protocole Flight) n'accepte de traverser
sa frontière serveur ↔ client que des valeurs **déjà plain** — objets/tableaux/
primitives simples, jamais une instance de classe ni sa sortie `.toJSON()` interne.

**1. Argument positionnel d'une Server Action appelée directement** (pas via
`<form action>`, mais `await maServerAction(objetImbrique)` depuis un Client
Component - cas de l'auto-save debounce). Passer un objet JS imbriqué complexe en
argument brut déclenche :

```
Error: Cannot access level on the server. You cannot dot into a temporary
client reference from a server component. You can only pass the value through
to the client.
```

Le message pointe trompeusement vers un attribut arbitraire de l'arbre (ici
`level`, un attr de node `heading`) - ce n'est **pas** une erreur de validation
métier, c'est Flight qui échoue à sérialiser l'argument.

**2. Sortie `.toJSON()` d'une classe tierce repassée en prop à un Client
Component** (ex. `ProseMirrorNode.fromJSON(schema, content); return doc.toJSON();`
puis ce retour repassé en prop React) :

```
Error: Only plain objects, and a few built-ins, can be passed to Client
Components from Server Components. Classes or null prototypes are not
supported.
```

La représentation interne de ProseMirror (ou toute autre lib) pour ses attrs
n'est pas garantie "plain" au sens strict de React, même si elle "ressemble" à du
JSON à l'oeil.

**Piège annexe** : le deuxième cas est **invisible via `curl`** - il ne se
déclenche que lors de la désérialisation du flux Flight côté navigateur réel,
jamais lors d'un simple appel HTTP simulé.

## La correction

- Argument direct d'une Server Action : sérialiser en chaîne côté client
  (`JSON.stringify(objet)`), parser en premier côté serveur (`JSON.parse`). Une
  chaîne traverse toujours Flight comme donnée simple déjà résolue, aucune
  ambiguïté possible.
- Valeur dérivée d'une classe tierce (ProseMirror, etc.) qu'on veut repasser en
  prop à un Client Component : **ne jamais retourner la sortie re-dérivée**
  (`.toJSON()`, getters internes). Retourner la donnée d'entrée déjà plain
  (celle reçue de Postgres ou d'un `JSON.parse`) une fois validée - ou, si la
  forme re-dérivée est vraiment nécessaire, forcer `JSON.parse(JSON.stringify(...))`
  dessus avant de la faire traverser la frontière.

## Règles pour ce repo

- `src/actions/entity-content.ts` : `saveEntityContentAction` prend un
  `rawContentJson: string`, jamais l'arbre Tiptap directement.
- `src/lib/tiptap-content.ts` : `parseContent()` valide via `Node.fromJSON` +
  `check()` mais **retourne le contenu d'origine**, jamais `doc.toJSON()`.
- Tout nouveau flux qui fait traverser un arbre imbriqué (JSON Prisma, résultat
  d'une lib tierce) entre serveur et client doit suivre le même principe :
  stringify/parse explicite ou retour de la donnée d'entrée déjà plain.
- Le deuxième cas ne se vérifie pas par `curl`/script `tsx` - seul un test
  Testing Library qui rend réellement le composant, ou une vérification
  navigateur réelle, l'exerce.

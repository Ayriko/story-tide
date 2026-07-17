---
name: prisma-mock-partial-select
description: >
  Mocker en test une requête Prisma qui utilise un select restreint sans casser le
  typecheck. Déclencheurs : Prisma mock, vi.mocked, vitest mock Prisma, select
  restreint, "select: { targetId: true }", littéral partiel échoue typecheck,
  factory makeRelation, makeLinkIgnore, as never, test unitaire Prisma, mock
  résultat partiel, PrismaClient mock.
---

# Mocker une requête Prisma à `select` restreint

## Le piège

Quand le code appelle Prisma avec un `select` restreint
(ex. `prisma.relation.findMany({ select: { targetId: true } })`), le mock reste
typé sur le **modèle Prisma complet**, quel que soit le `select` réel :

```ts
vi.mocked(prisma.relation.findMany).mockResolvedValue([
  { targetId: "abc" },   // ❌ typecheck échoue : il manque id, sourceId, origin, ...
]);
```

Fournir un littéral partiel échoue le typecheck ; caster en `as never` masque
l'erreur mais fait perdre toute vérification.

## La solution

Toujours passer par une **factory qui renvoie un objet complet** du modèle, puis
laisser le code sous test ne lire que les champs qui l'intéressent :

```ts
const makeRelation = (o: Partial<Relation> = {}): Relation => ({
  id: "r1", sourceId: "s1", targetId: "t1", origin: "AUTO",
  createdAt: new Date(), /* ...tous les champs... */ ...o,
});

vi.mocked(prisma.relation.findMany).mockResolvedValue([makeRelation({ targetId: "abc" })]);
```

## Règle

Jamais de `as never` ni de cast pour contourner. Une factory par modèle
(`makeRelation`, `makeLinkIgnore`, …) : le typecheck reste réel et les tests ne
cassent pas quand le schéma évolue.

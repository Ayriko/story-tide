---
name: vitest-assert-typed-error-catch
description: >
  Test Vitest qui doit prouver qu'une fonction async rejette avec une erreur
  typée précise. Déclencheurs : rejects.toThrow, rejects.toBeInstanceOf,
  Promise.reject dans expect, erreur typée, RelationTypeInUseError,
  EntityNotFoundError, P2002 converti, cause chaînée, test qui passe sans
  rien prouver.
---

# Prouver une erreur typée : `.catch((e) => e)` puis des assertions

## Le symptôme

KAN-84 (22/10/2026). Un test écrit ainsi passait toujours :

```ts
await expect(Promise.reject(new RelationTypeInUseError())).rejects.toBeInstanceOf(
  RelationTypeInUseError,
);
```

Il n'appelait pas le code testé : il vérifiait une promesse construite dans le
test lui-même.

## La solution

Appeler le vrai code, récupérer l'erreur, puis l'inspecter :

```ts
// entity-type-service.test.ts
const error = await createCustomType(OWNER_ID, WORLD_ID, SHIP_INPUT).catch((e: unknown) => e);
expect(error).toBeInstanceOf(CustomTypeLabelTakenError);
expect(error).toHaveProperty("cause", violation); // P2002 chaîné en cause
```

Si la fonction ne rejette pas, `error` est la valeur résolue et
`toBeInstanceOf` échoue : le test est honnête.

## Règle

L'expression passée à `expect(...)` d'un test d'erreur doit contenir l'appel
au code testé. `.catch((e) => e)` est le patron du projet quand on veut
vérifier plus que le type (message, `cause`, champs).

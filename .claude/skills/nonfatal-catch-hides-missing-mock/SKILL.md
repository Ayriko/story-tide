---
name: nonfatal-catch-hides-missing-mock
description: >
  Un test « unitaire » qui passe alors qu'un mock manque et qu'il tape la vraie base,
  parce qu'un try/catch non-fatal avale l'échec. Déclencheurs : test vert par accident,
  mock manquant, vi.mock oublié, test unitaire tape la vraie base, @/db/client réel,
  try/catch non-fatal masque l'échec, Server Action swallow error, reconcile appelé
  sans mock, faux positif de test, isolation de test, Postgres dev pendant les tests.
---

# `try/catch` non-fatal + mock manquant = test vert par accident

## Le piège

Une Server Action (ou fonction) enveloppe un appel dans un `try/catch` **non-fatal**
(l'erreur est loguée mais pas relancée, pour ne pas casser le parcours utilisateur) :

```ts
try {
  await reconcileManualMentions(entityId, ids);
} catch (e) {
  logger.warn("reconcile failed, non-blocking", e);  // avalé
}
```

En test, si le service appelé (`@/services/relation-service`) **n'est pas mocké**,
l'appel atteint la **vraie** `@/db/client`. Si le Postgres de dev tourne déjà (ex.
Docker up pour une vérif navigateur), la requête échoue contre une base réelle sans
donnée attendue — mais l'échec est **avalé par le `catch`**. Le test passe donc
« par accident », sans jamais vérifier le vrai comportement.

## Le symptôme

- Le test est vert mais ne teste rien de significatif.
- Il devient rouge (ou lent) uniquement quand la base de dev est **éteinte**.
- Un log `warn` inattendu apparaît pendant le run des tests.

## La solution

Mocker **explicitement** toute dépendance qui touche la base, même derrière un
`try/catch` non-fatal, et **asserter que le mock a été appelé** :

```ts
vi.mock("@/services/relation-service", () => ({
  reconcileManualMentions: vi.fn(),
}));
// ...
expect(reconcileManualMentions).toHaveBeenCalledWith(entityId, ids);
```

## Règle

Un `try/catch` non-fatal en code de prod = **point de vigilance en test** : il masque
un mock manquant. Toujours mocker les I/O et asserter l'appel, ne jamais se contenter
d'un « le test passe ». Un test qui ne devient jamais rouge ne teste rien.

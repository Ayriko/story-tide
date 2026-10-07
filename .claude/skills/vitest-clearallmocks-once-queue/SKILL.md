---
name: vitest-clearallmocks-once-queue
description: >
  Tests Vitest qui échouent en cascade après un premier échec, avec des mocks
  qui renvoient des valeurs d'un test précédent. Déclencheurs :
  vi.clearAllMocks, mockResolvedValueOnce, mockReturnValueOnce, "Number of
  calls: 0", "expected … to be called with", échec en cascade, file de
  réponses mock, mockReset, beforeEach, test isolé passe mais suite échoue.
---

# `vi.clearAllMocks()` ne vide pas la file des `…Once`

## Le symptôme

Un test échoue tôt, puis les suivants tombent avec des assertions
incohérentes (`expected "warn" to be called with […]`, puis `Number of calls:
0`). Chaque test passe seul ; la suite entière échoue.

## La cause

`vi.clearAllMocks()` remet à zéro l'historique des appels (`mock.calls`,
`mock.results`) mais **pas les implémentations en file** posées par
`mockResolvedValueOnce` / `mockReturnValueOnce`. Un test qui échoue avant
d'avoir consommé ses réponses les laisse au suivant.

## La solution

Dans `beforeEach`, `mockReset()` explicite sur les mocks concernés (ou
`vi.resetAllMocks()` si aucune implémentation par défaut n'est à conserver) :

```ts
beforeEach(() => {
  vi.clearAllMocks();
  getEntityScanStatusAction.mockReset();   // vide aussi la file des Once
});
```

Puis réposer l'implémentation par défaut si le test en a besoin.

## Règle

Un mock alimenté par `…Once` est réinitialisé par `mockReset`, pas par
`clearAllMocks`. Quand une cascade d'échecs suit un premier échec, regarder
la file des mocks avant le code testé.

---
name: e2e-jobs-file-partagee
description: Test e2e qui enfile un volume inhabituel de jobs sur une file partagée (pg-boss, queue, worker) — seed volumineux, import, batch. À consulter à l'ÉCRITURE du test, pas après le flake. Mots-clés — e2e, pg-boss, queue, file, jobs, worker, flake, timeout, contention, parallèle, workers, playwright projects.
---

# Jobs en volume dans un test e2e : isoler par projet Playwright séquencé

**Leçon (22/07/2026, seed Atheraus)** : un test qui enfile 25 jobs de liaison sur
la file pg-boss partagée a fait échouer par timeout deux specs préexistantes
lancées en parallèle (`--workers=2`) — **alors même que ces specs sautaient le
seed** : leurs propres jobs étaient noyés dans la file commune. « Sauter le seed »
chez les autres ne protège de rien ; la contention est dans la file, pas dans le
setup.

**Patron** : le test volumineux va dans son **propre projet Playwright**, séquencé
après le reste :

```ts
projects: [
  { name: "chromium", ... },
  { name: "chromium-intro-world", dependencies: ["chromium"], testMatch: /intro-world/ },
]
```

Corollaire de la même famille (flakes 21-22/07) : tout patron « `page.reload()`
dans un `toPass` puis clic derrière » doit inclure le clic ET son assertion DANS
le même bloc de retry dès l'écriture — et quand un durcissement corrige un patron
fragile, le propager le jour même à tous les tests du même patron.

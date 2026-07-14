---
name: signals-verify-on-linux
description: >
  À utiliser dès qu'on teste, débogue ou valide la gestion des signaux POSIX
  (SIGTERM, SIGINT) et l'arrêt gracieux d'un process Node dans Story Tide —
  typiquement le worker pg-boss (`src/worker/index.ts`) et son étage Docker.
  Déclencheurs : SIGTERM, SIGINT, arrêt gracieux, graceful shutdown, process.on,
  docker stop, kill -TERM, exit 143, exit 0, PID 1, worker, teardown conteneur.
---

# Toujours vérifier les signaux Unix dans l'environnement Linux cible

## Le piège (vérifié en conditions réelles, 2026-07-12)

Sous **Git Bash / Windows**, `kill -TERM <pid>` **ne délivre pas** de vrai `SIGTERM`
JS-visible à un process `node.exe` natif : le handler `process.on("SIGTERM", …)`
ne se déclenche pas et le process sort en **143** au lieu de l'**exit 0** attendu.

Conséquence trompeuse : l'arrêt gracieux semble « cassé » alors que le code est bon.
Le test local peut même incriminer la mauvaise cause (ex. `npm run worker` vs
`node --import tsx` semblaient tous deux fautifs — un seul l'était réellement).

Windows ne relaie pas les signaux POSIX comme Linux ; un test de signal fait sous
Git Bash **ne fait pas foi**.

## La règle

Ne jamais valider un comportement de signal (SIGTERM/SIGINT, arrêt gracieux,
teardown) via `kill` sous Git Bash/Windows. **Toujours** vérifier dans
l'environnement Linux cible : le conteneur Docker ou la CI.

Test qui fait foi (arrêt gracieux du worker) :

```bash
docker run -d --name w --network story-tide_default -e ... <image-worker>
docker stop w                                  # envoie un vrai SIGTERM à PID 1
docker inspect w --format '{{.State.ExitCode}}' # doit afficher 0
```

`exit 0` = le handler a bien reçu SIGTERM et fermé proprement (pg-boss `stop()`).
`exit 143` en local Windows n'est **pas** un échec ; c'est l'artefact de plateforme.

## Rappels pour ce repo

- Le worker doit tourner en **PID 1** du conteneur pour recevoir directement le
  signal : `CMD ["node", "--import", "tsx", "src/worker/index.ts"]` (pas via
  `npm run …`, qui interpose un process et avale le signal).
- Sous Windows/Node, un `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`
  peut apparaître **après** un `process.exit(0)` : artefact libuv au teardown, sans
  rapport avec le code applicatif — ne pas chasser un faux bug.

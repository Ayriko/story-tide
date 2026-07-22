---
name: e2e-run-hygiene-windows
description: Hygiène d'un run e2e Playwright sous Windows sur ce projet — à consulter AVANT tout lancement de "npx playwright test", run e2e, tests end-to-end, gates, CI locale. Mots-clés — e2e, playwright, run bloqué, hang, aucune sortie, webServer, next dev, OOM, pipe, tail, workers, gates.
---

# Hygiène d'un run e2e (Windows, ce projet)

Quatre règles, toutes apprises à la dure (sessions 20-22/07/2026) :

1. **Avant le run : vérifier ports et orphelins.** `Get-NetTCPConnection -LocalPort 3000,3100`
   — le verrou `next dev` est **par projet, pas par port** : un serveur parasite sur 3000
   bloque un run visant 3100. Orphelins : voir skill `windows-orphan-node-e2e-cleanup`.
   Les workers orphelins survivent même à un run **réussi** (`worker.kill()` ne tue pas
   l'arborescence npx/tsx) : nettoyage systématique avant chaque run.

2. **Sortie vers un fichier, JAMAIS de pipe.** `npx playwright test ... > e2e-run.log 2>&1`.
   Un `| tail -N` (sans `-f`) bufférise tout et n'affiche RIEN tant que le pipeline n'est
   pas fermé — un run bloqué devient indiagnosticable. Pour distinguer bloqué/lent :
   comparer taille+mtime de `.next/dev/trace` avec l'heure courante.

3. **Aucun édit de source pendant le run.** Éditer un fichier pendant qu'un run tourne
   contre le même dev server casse des requêtes SSR en HMR (« module factory is not
   available »). Attendre la fin complète avant tout édit.

4. **`--workers=2` et `build` EN DERNIER dans les gates** (lint → tsc → unit → e2e → build).
   `next build` invalide le cache `.next/dev` du webServer Playwright → recompilations
   à 190-300 s par route, voire mort silencieuse du serveur (OOM).

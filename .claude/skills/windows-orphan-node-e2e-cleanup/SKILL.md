---
name: windows-orphan-node-e2e-cleanup
description: >
  Run Playwright/e2e bloqué sous Windows par des process node orphelins (worker ou
  next dev) qui tiennent des connexions DB ou un verrou projet. Déclencheurs : e2e
  bloqué sans sortie, run Playwright hang Windows, worker.kill n'arrête pas tout,
  spawn shell true arborescence de process, DROP SCHEMA CASCADE bloqué, connexions
  ouvertes story_tide_e2e, "Another next dev server is already running", verrou par
  projet next dev, wmic ProcessId CommandLine, taskkill PID, global-setup worker orphelin.
---

# Process node orphelins sous Windows → e2e bloqué (worker / next dev)

## Le piège

Sous Windows, `child.kill()` sur un process lancé via `spawn(cmd, { shell: true })`
**ne tue que le shell parent**, pas toute l'arborescence. Les vrais process node
(`tsx src/worker/index.ts`, ou un `next dev`) survivent en **orphelins** et :

- gardent des **connexions ouvertes** sur la base de test (`story_tide_e2e`), ce qui
  bloque le `DROP SCHEMA public CASCADE` du `global-setup.ts` suivant → le run reste
  figé plusieurs minutes **sans aucune sortie** ;
- `next dev` pose un **verrou par projet, pas par port** :
  `⨯ Another next dev server is already running` même en visant un autre port
  (3100 vs 3000) — un serveur dev resté ouvert bloque le `webServer` de Playwright.

Distinction utile : un **vrai** blocage a un état observable (connexion ouverte,
verrou DB) ; un **faux** blocage (ex. pipe `tail -N` sans `-f`) n'en a aucun.

## Diagnostic

Lister les process node avec leur ligne de commande complète (seul moyen fiable
d'identifier l'orphelin) :

```bash
wmic process where "name='node.exe'" get ProcessId,CommandLine
# repérer les lignes contenant worker/index ou next dev
```

Vérifier au besoin si un job est resté non consommé :

```sql
SELECT id, name, state, created_on, completed_on
FROM pgboss.job WHERE name = 'entity-linking' ORDER BY created_on DESC;
-- state 'created' + completed_on NULL = aucun worker ne l'a traité
```

## La solution

Tuer les PID orphelins identifiés :

```bash
taskkill //PID <pid> //F
```

Puis relancer. Pour lancer un worker manuellement hors `next dev`/Docker (avec `.env`
chargé) : `npx tsx --require dotenv/config src/worker/index.ts`.

## Règle

Avant de conclure à un « e2e qui hang » sous Windows, chercher l'état observable :
`wmic ... CommandLine` pour les orphelins, connexions/verrou DB. La correction de fond
(tuer toute l'arborescence dans `global-setup.ts`) est un chantier séparé ; en
attendant, nettoyer les PID à la main.

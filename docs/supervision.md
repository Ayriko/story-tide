# Supervision — C4.1.2 (ÉLIMINATOIRE)

> État au 2026-07-22 (supervision v1). Voir aussi `docs/manuels/deploiement.md`
> (procédure de déploiement), `docs/securite-owasp.md` A05/A09, ADR-0019
> (choix d'une sonde externe plutôt qu'auto-hébergée).

## Deux couches

**1. Natif hébergeur / Docker** — détecte un conteneur mort ou une base
injoignable, agit localement :
- `healthcheck` Docker sur `app` (`GET /api/health`, 30 s d'intervalle, 3
  échecs, `start_period` 40 s) — `docker compose up -d --wait` (utilisé par le
  CD) échoue si l'app démarre sans base joignable.
- `healthcheck` Docker sur `postgres` (`pg_isready`) et `minio`
  (`/minio/health/live`), déjà en place avant supervision v1.
- Rotation des logs (`json-file`, `max-size: 10m`, `max-file: 3`) sur tous les
  services des deux stacks — évite qu'un disque plein par les logs (panne
  fréquente et bête sur un VPS mono-nœud) ne passe inaperçu jusqu'à ce que
  tout le reste tombe avec lui.

Cette couche ne prévient personne : elle relance/isole localement, visible
uniquement via `docker compose ps`/`docker compose logs`.

**2. Sonde externe (Better Stack)** — détecte une panne que la couche 1 ne
peut pas voir (le VPS entier down, un healthcheck Docker qui « ment » car le
process répond mais la route réelle est cassée), et **alerte un humain** :
- Interroge `GET https://storytide.fr/api/health` (et
  `https://staging.storytide.fr/api/health`) depuis l'extérieur du VPS, à
  intervalle régulier.
- Reçoit un heartbeat HTTP du service `backup` après chaque sauvegarde
  quotidienne réussie (`BACKUP_HEARTBEAT_URL`) — l'absence de ping dans la
  fenêtre attendue est elle-même le signal d'alerte (sauvegarde qui n'a pas
  tourné, ou qui a échoué en silence).

## Ce qui est surveillé

| Cible | Mécanisme | Détecte |
|---|---|---|
| App joignable + connectée à la base | Sonde externe sur `/api/health` | App down, base injoignable, déploiement cassé |
| Démarrage propre au déploiement | `healthcheck` Docker `app` + `--wait` | Déploiement d'une app sans base saine (CD bloqué avant bascule trafic) |
| Sauvegarde quotidienne réussie | Heartbeat `backup` | `pg_dump`/miroir MinIO/purge en échec silencieux, cron arrêté |
| Espace disque (logs) | Rotation `json-file` | Disque plein par accumulation de logs |

## Seuils

- Sonde externe : intervalle recommandé 1 à 5 min (configuration Better Stack,
  hors dépôt de code) ; alerte après 3 échecs consécutifs (cohérent avec le
  `retries: 3` du healthcheck Docker).
- Heartbeat backup : fenêtre d'attente = 24 h + marge (le cron tourne à 3h) ;
  absence de ping dans cette fenêtre = alerte.
- `healthcheck` Docker `app` : `interval: 30s`, `timeout: 5s`, `retries: 3`,
  `start_period: 40s` (voir `deploy/compose.prod.yml`/`compose.staging.yml`).

## Destinataires des alertes

Aymeric (e-mail/notification Better Stack, configuration côté service — hors
dépôt de code, pas de secret ni d'URL de webhook committée).

## Procédure quand une alerte tombe

1. `ssh deploy@<IP_VPS>` puis
   `docker compose -p storytide-<env> --env-file <.env.env> -f
   deploy/compose.<env>.yml ps` — identifier le(s) service(s) `unhealthy`.
2. `docker compose ... logs <service> --tail 200` — chercher la cause (base
   coupée, migration en échec, disque plein).
3. Si `postgres` est en cause : vérifier l'espace disque du volume `pgdata`
   (`docker system df -v`).
4. Si la sauvegarde n'a pas pingé : `docker compose ... logs backup` — le
   script logge chaque étape (`pg_dump`, miroir MinIO, purge) avec horodatage
   ; identifier l'étape en échec avant de relancer manuellement si besoin.
5. Rollback possible via `docs/cd.md` (redéployer le tag précédent) si la
   cause est un déploiement cassé.

## Limites assumées (v1)

- Pas de distinction runtime staging/prod dans l'app (`NODE_ENV=production`
  sur les deux stacks) — le SHA de commit est donc masqué sur staging aussi,
  plus strict que nécessaire mais volontairement simple (aucune nouvelle
  variable d'environnement de distinction).
- Aucune métrique applicative (latence p95, taux d'erreur) exposée à ce
  stade — `/api/health` est un simple statut binaire (vivant/dégradé), pas un
  tableau de bord.
- Pas de logs centralisés (agrégation multi-conteneurs) : `docker compose
  logs` reste la seule vue, par service, sur le VPS lui-même.
- Le heartbeat de sauvegarde confirme que le **script** s'est terminé sans
  erreur, pas que la sauvegarde est **restaurable** (pas de test de
  restauration automatisé).
- Seuils de la sonde externe (intervalle, nombre d'échecs avant alerte)
  configurés directement dans Better Stack — pas versionnés dans ce dépôt.

## Feuille de route v2

- Métriques applicatives (p95, taux d'erreur — déjà mesurées manuellement en
  recette, cf. seuils C2.1.1) exposées et suivies dans le temps.
- Logs centralisés (agrégateur externe ou stack ELK/Loki légère).
- Test de restauration automatisé (vérifier qu'un dump est effectivement
  restaurable, pas seulement produit).
- Distinction runtime staging/prod si un besoin concret apparaît (ex. tags de
  log/alerte différenciés).

# ADR-0013 — Déploiement staging/prod sur un VPS unique : deux stacks Compose isolées + Traefik partagé

- **Statut** : accepté
- **Date** : 2026-07-18
- **Décideur** : Aymeric (MOE)

## Contexte et problème

KAN-10 (CD complet) restait à zéro ligne d'infra dans le repo — aucun compose
prod/staging, aucun workflow CD, aucune image poussée sur ghcr. Le VPS OVH
(VPS-3 2027, 6 vCPU/12 Go/100 Go) a été posé à la main le 18/07 (SSH durci, ufw,
fail2ban, Docker CE, DNS `storytide.fr`/`www`/`staging` → même IP). La spec
(§9.1) impose staging et prod sur **le même VPS** ; il faut décider comment les
isoler l'un de l'autre et comment appliquer les migrations Prisma sans
embarquer le CLI Prisma (devDependency) dans l'image `app` standalone.

## Options envisagées

**Topologie staging/prod :**
- **A — Un compose paramétré, déployé deux fois** (`-p storytide-{env} --env-file
  .env.{env}`) : zéro duplication de structure, mais toute différence de
  comportement entre staging et prod doit passer par des variables, moins
  explicite à la lecture.
- **B — Deux fichiers compose séparés** (`compose.prod.yml` / `compose.staging.yml`),
  auto-contenus, + Traefik partagé (seul titulaire des ports 80/443 et de
  `acme.json`) — retenue.
- **Traefik par environnement** — écartée d'emblée : impossible sans conflit,
  un seul process peut binder 80/443 sur le VPS.

**Migrations Prisma :**
- **A — Image `migrate` dédiée + service Compose one-shot** (`depends_on:
  condition: service_completed_successfully`) — retenue.
- **B — Étape SSH exécutant `docker compose run --rm migrate`** au lieu d'un
  service déclaratif dans le compose — écartée : moins reproductible en rejeu
  manuel sur le VPS, sort la logique de migration du fichier compose versionné.

**Visibilité ghcr :**
- **A — Packages publics** : le VPS `pull` sans authentification, zéro secret
  ghcr côté serveur — retenue.
- **B — Packages privés** (PAT `read:packages` sur le VPS) — écartée : surface
  de secret supplémentaire sans bénéfice (le code source reste privé
  indépendamment de la visibilité des images).

**Gate de mise en production :**
- **A — GitHub Environment `production` avec reviewer requis** : approbation
  manuelle côté GitHub avant le job `deploy`, staging reste automatique —
  retenue.
- **B — Prod automatique sur tag**, sans pause — écartée : aucune barrière
  humaine entre un tag poussé et la mise en ligne réelle.

## Décision

**Deux fichiers compose séparés, auto-contenus** (`deploy/compose.prod.yml`,
`deploy/compose.staging.yml`) + **une stack Traefik partagée**
(`deploy/traefik/`), seule à publier 80/443 et à détenir l'`acme.json`. Chaque
environnement est un **projet Compose isolé** (`-p storytide-prod` /
`-p storytide-staging`), avec ses propres volumes (`pgdata`, `minio`,
`backups`) et son propre réseau interne — jamais les données de prod en
staging. Risque explicite assumé : toute évolution de la stack applicative
doit être répercutée dans les **deux** fichiers (pas de garde-fou automatique
contre la dérive) ; mitigation : commentaire en tête de chaque fichier
rappelant l'autre, et les deux sont quasi identiques ligne à ligne pour rendre
un diff manuel trivial.

**Migrations** : nouveau stage Docker `migrate` (`FROM deps`, qui a déjà le CLI
Prisma + `prisma/` + `prisma.config.ts`), exécuté comme service Compose
`restart: "no"` dont `app`/`worker` dépendent via
`condition: service_completed_successfully` — les migrations sont versionnées
avec la release (même tag d'image que `app`/`worker`), rejouables à la main
(`docker compose ... run --rm migrate`) sans sortir du fichier compose.

**ghcr public** : `docker/build-push-action` pousse app/worker/migrate/backup
en image publique ; le VPS ne pose aucun `docker login`.

**Gate prod** : le job `deploy` de `cd.yml` utilise
`environment: ${{ contains(github.ref_name, '-rc.') && 'staging' || 'production' }}`
— l'Environment GitHub `production` porte un reviewer requis (Aymeric),
`staging` n'en a pas. Le gate est côté GitHub Actions, pas sur le VPS : compatible
avec l'exigence « déploiement complet déclenché par tag, sans intervention
manuelle sur le VPS » (seule l'approbation dans l'onglet Actions est manuelle).

## Conséquences

- **Positives** : topologie explicite et lisible (pas de branchement
  conditionnel dans un compose unique) ; migrations rejouables manuellement
  sans sortir de Compose ; zéro secret ghcr à gérer/roter côté VPS ; barrière
  humaine avant toute mise en production, tracée dans l'historique GitHub
  Actions (preuve pour le jury, C2.1.1).
- **Négatives / à surveiller** : dérive possible entre `compose.prod.yml` et
  `compose.staging.yml` si une évolution n'est appliquée qu'à un seul des deux
  fichiers — aucun outil ne le détecte automatiquement ; à surveiller en revue
  de PR. Si cette dérive devient un problème réel et récurrent, reconsidérer
  l'option A (compose paramétré unique) sur preuve, pas par anticipation.
- **Garde-fou associé (OWASP A05)** : Docker contourne ufw pour tout port
  publié — seul Traefik publie 80/443 dans les deux fichiers ; PostgreSQL,
  MinIO, `app`, `worker`, `migrate`, `backup` n'ont aucun `ports:`, joignables
  uniquement via le réseau Docker interne (`deploy/compose.prod.yml`,
  `deploy/compose.staging.yml`).

## Compétence(s) servie(s)

C2.4.1 (traçabilité) ; C2.1.1 (architecture/CD) ; C2.2.3 (sécurité — gotcha
ufw/Docker, TLS, gate de production).

# Manuel de déploiement — C2.4.1

> État au 2026-07-18 (KAN-10). Voir aussi `docs/cd.md` (protocole CD, C2.1.1)
> et ADR-0013 (décisions de topologie).

## Prérequis

### État du serveur (posé à la main le 18/07 — ne pas re-scripter)

- **VPS OVH VPS-3 2027** : `vps-ee1e73bd.vps.ovh.net` / `51.255.167.198`, GRA,
  Debian 12, 6 vCPU / 12 Go / 100 Go NVMe.
- **Utilisateurs** : `debian` (admin, sudo, clé perso d'Aymeric) · `deploy`
  (groupe `docker`, clé ed25519 dédiée sans passphrase, réservée à GitHub
  Actions — c'est l'utilisateur ciblé par `VPS_USER`).
- **SSH durci** via `/etc/ssh/sshd_config.d/00-hardening.conf`
  (`PasswordAuthentication no`, `PermitRootLogin no`,
  `KbdInteractiveAuthentication no`). ⚠️ Ne jamais toucher
  `50-cloud-init.conf` (régénéré par cloud-init) — la première valeur lue
  gagne, d'où le préfixe `00-`.
- **ufw** actif : `deny incoming` par défaut, `ALLOW 22/80/443` uniquement
  (v4+v6). Rappel (OWASP A05) : Docker contourne ufw pour tout port
  **publié** — seul Traefik publie 80/443, tout le reste (PostgreSQL, MinIO,
  worker, migrate, backup) reste sur le réseau Docker interne.
- **fail2ban** actif, jail `sshd`, `backend = systemd` dans `jail.local`
  (Debian 12 n'a pas d'`auth.log`).
- **Docker CE + compose plugin** installés (dépôt officiel bookworm), `debian`
  et `deploy` dans le groupe `docker`.
- **DNS** (zone OVH) : `storytide.fr`, `www`, `staging` → A `51.255.167.198`.
  Les MX/SPF (Zimbra) existent dans la même zone : ne jamais y toucher.
- **Secrets GitHub Actions** déjà posés : `VPS_HOST`, `VPS_USER` (= `deploy`),
  `VPS_SSH_KEY` (clé privée ed25519).

### À poser avant le premier déploiement (Aymeric, à la main sur le VPS)

```bash
# 1. Réseau Docker externe partagé par Traefik et les deux stacks applicatives
docker network create web

# 2. Volume nommé pour l'acme.json Let's Encrypt (Traefik seul le monte)
docker volume create traefik_letsencrypt

# 3. Arborescence de déploiement
mkdir -p ~/story-tide/deploy

# 4. Fichiers d'environnement réels (jamais dans le repo) — copier depuis les
#    .example correspondants et générer des secrets forts :
openssl rand -base64 32   # BETTER_AUTH_SECRET, mots de passe PG/MinIO
```

Copier `deploy/traefik/.env.example` → `deploy/traefik/.env` (`ACME_EMAIL`),
`deploy/.env.prod.example` → `deploy/.env.prod`, `deploy/.env.staging.example`
→ `deploy/.env.staging`, en remplaçant chaque placeholder par une vraie
valeur. Ces trois fichiers **restent sur le VPS uniquement** — le workflow CD
ne les transfère jamais (`scp -r deploy/.` ne touche pas les fichiers absents
du repo).

### GitHub Environments (une fois, dans les Settings du repo)

- `staging` : aucun reviewer requis (déploiement automatique sur tag `-rc.N`).
- `production` : reviewer requis = Aymeric (approbation manuelle avant le job
  `deploy` sur un tag `vX.Y.Z`).

## Procédure (staging puis prod)

### 1. Bring-up de Traefik (une fois)

```bash
cd ~/story-tide/deploy/traefik
docker compose -f compose.traefik.yml up -d
```

Démarrer avec le résolveur Let's Encrypt en mode **staging**
(`deploy/traefik/traefik.yml`, `caServer` actif = endpoint LE staging par
défaut dans le repo) — évite de consommer le rate limit de production (5
échecs/domaine/heure) pendant la mise au point du routing.

### 2. Premier déploiement staging

```bash
git tag -a v1.0.0-rc.1 -m "Premier déploiement staging"
git push origin v1.0.0-rc.1
```

Le workflow `cd.yml` build+push les 4 images, puis déploie automatiquement
(environment `staging`, aucune approbation requise). Vérifier :

```bash
ssh deploy@51.255.167.198
docker compose -p storytide-staging --env-file ~/story-tide/deploy/.env.staging \
  -f ~/story-tide/deploy/compose.staging.yml ps
```

Tous les services doivent être `healthy` (ou `running` pour `migrate`/`backup`
qui n'ont pas de healthcheck). Vérifier `https://staging.storytide.fr` dans un
navigateur — certificat **non fiable** au niveau staging LE, c'est attendu.

### 3. Bascule Let's Encrypt en production

Une fois le routing validé sur staging (redirection HTTP→HTTPS correcte,
domaine bien résolu vers l'app) :

```bash
cd ~/story-tide/deploy/traefik
docker compose -f compose.traefik.yml down
docker volume rm traefik_letsencrypt   # acme.json contient des certs STAGING, non valides en prod
docker volume create traefik_letsencrypt
```

Éditer `deploy/traefik/traefik.yml` sur le VPS : commenter la ligne `caServer`
staging, décommenter la ligne prod (voir commentaire en tête du fichier).

```bash
docker compose -f compose.traefik.yml up -d
```

### 4. Déploiement production

```bash
git tag -a v1.0.0 -m "Première mise en production"
git push origin v1.0.0
```

Le job `build-push` tourne normalement. Le job `deploy` **se met en pause** —
approuver dans l'onglet **Actions** du repo GitHub (environment
`production`). Une fois approuvé, vérifier :

```bash
docker compose -p storytide-prod --env-file ~/story-tide/deploy/.env.prod \
  -f ~/story-tide/deploy/compose.prod.yml ps
```

Et `https://storytide.fr` dans un navigateur — certificat Let's Encrypt
valide cette fois.

## Vérification post-déploiement

- `docker compose -p storytide-<env> ... ps` : tous les services
  `healthy`/`running`, aucun `restarting` en boucle — sauf `migrate` et
  `minio-setup` (one-shot, `Exited (0)` attendu, jamais `restarting`).
  `minio-setup` (BUG-010/BUG-011, 2026-07-23) provisionne le bucket MinIO
  avant `app`/`worker`/`backup` — un `Exited` avec un code non-nul dessus
  bloque le démarrage de ces trois services (`depends_on:
  service_completed_successfully`), vérifier ses logs le cas échéant
  (`docker compose ... logs minio-setup`).
- `curl -I https://<domaine>` : `200`, certificat valide.
- `curl -I http://<domaine>` : redirection `301`/`308` vers `https://`.
- En-têtes de sécurité présents (`curl -sI https://<domaine>` — voir
  `docs/securite-owasp.md` A05).
- PostgreSQL/MinIO injoignables depuis l'extérieur
  (`nc -zv <IP_VPS> 5432/9000/9001` doit échouer) — voir `TST-SEC-011`. En
  production, PostgreSQL est bindé sur `127.0.0.1:5432` (boucle locale
  uniquement, `compose.prod.yml`) : consultation des données de production
  possible via **tunnel SSH chiffré** (`ssh -L 5432:localhost:5432
  deploy@<IP_VPS>`) + Prisma Studio en local, aucune console d'administration
  exposée. Ce port n'existe pas en staging.
- `curl -i https://<domaine>/api/health` : `200` avec `{"status":"ok",…}` —
  voir `docs/supervision.md`. Si `503`, vérifier `docker compose ... ps` (le
  service `postgres` doit être `healthy`).
- Scénarios `docs/cahier-recettes.md` : `TST-SEC-009` à `TST-SEC-012`.

## Rollback

Voir `docs/cd.md` (section « Déclenchement & rollback ») : redéployer le tag
précédent avec `IMAGE_TAG=<tag-precedent>`. Les migrations Prisma ne sont pas
automatiquement réversibles.

## Sauvegardes

Le service `backup` (`deploy/backup/`) tourne quotidiennement (3h) dans
chaque stack : `pg_dump` gzip + miroir du bucket MinIO, écrits sur le volume
`backups` (distinct de `pgdata`/`minio`), purge des dumps PostgreSQL de plus
de 7 jours. Logs visibles via `docker compose -p storytide-<env> logs backup`.

**Heartbeat (supervision v1, C4.1.2)** : si `BACKUP_HEARTBEAT_URL` est
renseignée dans `.env.prod`/`.env.staging` (URL fournie par la sonde externe
Better Stack), un ping HTTP est envoyé **uniquement** si `pg_dump` + miroir
MinIO + purge se sont tous terminés sans erreur — voir `docs/supervision.md`.
Variable optionnelle : absente ou vide, aucun ping (le script reste
utilisable en local sans sonde), et un échec du ping ne fait jamais échouer
la sauvegarde.

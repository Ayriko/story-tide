# Manuel de mise à jour — C2.4.1

> Complété le 2026-07-24 pour le dépôt Bloc 2. Voir aussi `docs/cd.md` (protocole
> CD, C2.1.1), `docs/manuels/deploiement.md` (procédure d'exploitation détaillée)
> et ADR-0013 (topologie).

## 1. Montée de version applicative

Le versionnement suit **SemVer** avec des tags Git **annotés** et un canal de
préproduction distinct. Une montée de version se fait **uniquement par tag** — le
VPS ne construit jamais d'image, il ne fait que récupérer une image déjà poussée
par la chaîne CI/CD.

### 1.1 Étape 1 — staging (obligatoire avant la prod)

```bash
git tag -a vX.Y.Z-rc.N -m "Préproduction vX.Y.Z-rc.N"
git push origin vX.Y.Z-rc.N
```

Le workflow `cd.yml` construit et pousse les 4 images (`app`, `worker`,
`migrate`, `backup`) sur `ghcr.io`, puis **déploie automatiquement en staging**
(`staging.storytide.fr`, aucune approbation requise). La recette
(`docs/cahier-recettes.md`) s'exécute sur cet environnement.

### 1.2 Étape 2 — production (après recette validée)

Mettre à jour le champ **`version` de `package.json`** dans le même commit que le
tag `vX.Y.Z` : cette valeur est renvoyée par `GET /api/health` et sert la
supervision (C4.1.2). La synchronisation est **manuelle** à ce jour (note tracée
dans `docs/cd.md` ; automatisation via `cd.yml` = amélioration future).

```bash
git tag -a vX.Y.Z -m "Mise en production vX.Y.Z"
git push origin vX.Y.Z
```

Le job `build-push` tourne, puis le job `deploy` **se met en pause** : il faut
l'**approuver** dans l'onglet *Actions* du dépôt GitHub (GitHub Environment
`production`, *reviewer* requis). Une fois approuvé, la chaîne exécute sur le
VPS `docker compose pull && docker compose up -d --wait` — la bascule n'a lieu
que si les *healthchecks* passent.

## 2. Migrations de base de données

Les migrations Prisma sont appliquées par le service one-shot **`migrate`**
(`prisma migrate deploy`) au déploiement. Le service one-shot **`minio-setup`**
provisionne le bucket MinIO de façon idempotente avant le démarrage de
`app`/`worker`/`backup` (BUG-010, ajouté aux stacks staging et prod le
2026-07-23) — `Exited (0)` attendu.

> ⚠️ **`prisma migrate deploy` est un aller simple.** Une migration
> destructrice n'est pas automatiquement réversible : un retour arrière
> applicatif après une telle migration nécessite une **migration de
> compensation écrite à la main**, pas un simple retour d'image.

**Avant toute migration à risque en production**, s'assurer qu'une sauvegarde
récente existe (le service `backup` tourne quotidiennement à 3 h : `pg_dump`
gzip + miroir du bucket MinIO, rétention 7 j, sur un volume distinct). Une
sauvegarde manuelle peut être déclenchée avant la bascule si nécessaire.

## 3. Retour arrière (rollback)

Re-taguer ne republie pas une image déjà présente sur `ghcr`. Le retour arrière
consiste à **redéployer manuellement le tag précédent** sur le VPS :

```bash
ssh deploy@<VPS_HOST>
cd ~/story-tide
IMAGE_TAG=<tag-precedent> docker compose -p storytide-<env> \
  --env-file deploy/.env.<env> -f deploy/compose.<env>.yml up -d --wait
```

Rappel : si le tag précédent est antérieur à une migration destructrice, prévoir
la migration de compensation et/ou la restauration d'une sauvegarde (§2).

## 4. Vérification post-mise-à-jour

- `docker compose -p storytide-<env> ... ps` : tous les services
  `healthy`/`running` ; `migrate` et `minio-setup` en `Exited (0)` (one-shot),
  jamais `restarting`.
- `curl -i https://<domaine>/api/health` : `200` avec `{"status":"ok",…}` et le
  numéro de **version** attendu (confirme que `package.json` a bien été
  synchronisé) ; `503` si la base est injoignable.
- `curl -I https://<domaine>` : `200`, certificat Let's Encrypt valide ;
  `curl -I http://<domaine>` : redirection `301`/`308` vers HTTPS.
- En-têtes de sécurité présents (voir `docs/securite-owasp.md` A05) ;
  PostgreSQL/MinIO toujours injoignables depuis Internet (`TST-SEC-011`).

En cas d'anomalie, consulter les logs (`docker compose ... logs <service>
--tail 200`) et se référer à la procédure d'alerte de `docs/supervision.md`.

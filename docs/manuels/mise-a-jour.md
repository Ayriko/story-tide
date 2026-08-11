# Manuel de mise à jour — C2.4.1

> Complété le 2026-07-24 pour le dépôt Bloc 2. Voir aussi `docs/cd.md` (protocole
> CD, C2.1.1), `docs/manuels/deploiement.md` (procédure d'exploitation détaillée)
> et ADR-0013 (topologie).

## 1. Montée de version applicative

Le versionnement suit **SemVer** avec des tags Git **annotés** et un canal de
préproduction distinct. Une montée de version se fait **uniquement par tag** — le
VPS ne construit jamais d'image, il ne fait que récupérer une image déjà poussée
par la chaîne CI/CD.

Depuis KAN-44 (ADR-0024), la bascule du CHANGELOG et la synchronisation de
`package.json`/`package-lock.json` sont automatisées par `npm run release`
(`scripts/release.ts`) — ce n'est plus un geste manuel. Un garde-fou côté CD
(job `release-consistency`, avant `build-push`) rejoue la même vérification
sur le tag poussé et refuse le déploiement en cas d'incohérence.

```bash
npm run release -- X.Y.Z-rc.N --dry-run   # previsualise, n'ecrit rien
npm run release -- X.Y.Z-rc.N             # bascule/commit/tag reels
```

### 1.1 Étape 1 — staging (obligatoire avant la prod)

```bash
npm run release -- X.Y.Z-rc.N
git push origin main && git push origin vX.Y.Z-rc.N
```

Un tag `-rc.N` ne touche jamais au CHANGELOG (bascule réservée au tag final)
mais synchronise tout de même `package.json`/`package-lock.json` — `/api/health`
en staging annonce donc la version de préproduction exacte.

Le workflow `cd.yml` vérifie d'abord la cohérence du tag (`release-consistency`),
puis construit et pousse les 4 images (`app`, `worker`, `migrate`, `backup`) sur
`ghcr.io`, puis **déploie automatiquement en staging** (`staging.storytide.fr`,
aucune approbation requise). La recette (`docs/cahier-recettes.md`) s'exécute
sur cet environnement.

### 1.2 Étape 2 — production (après recette validée)

```bash
npm run release -- X.Y.Z
git push origin main && git push origin vX.Y.Z
```

`npm run release` bascule `## [Unreleased]` en `## [X.Y.Z] - AAAA-MM-JJ` (refuse
si la section est vide — rien à journaliser aurait signifié du contenu livré
sans trace) et met à jour le champ **`version` de `package.json`** (lue par
`GET /api/health`, supervision C4.1.2) dans le même commit que le tag.

Le job `release-consistency` tourne en premier, puis `build-push`, puis le job
`deploy` **se met en pause** : il faut l'**approuver** dans l'onglet *Actions*
du dépôt GitHub (GitHub Environment `production`, *reviewer* requis). Une fois
approuvé, la chaîne exécute sur le VPS `docker compose pull && docker compose
up -d --wait` — la bascule n'a lieu que si les *healthchecks* passent.

### 1.3 En cas d'échec du garde-fou (`release-consistency`)

Le garde-fou s'exécute **après** que le tag a été poussé — il bloque le
déploiement, jamais la pose du tag. **Ne jamais laisser la CI committer un
correctif de rattrapage** (ADR-0024, option écartée) : un tag doit pointer sur
un commit qui contient déjà son CHANGELOG et sa version cohérents.

```bash
git push --delete origin vX.Y.Z    # retire le tag distant incoherent
# corriger localement (ex: relancer npm run release après avoir corrige la cause)
git tag -d vX.Y.Z                  # retire le tag local
npm run release -- X.Y.Z           # re-tague proprement
git push origin main && git push origin vX.Y.Z
```

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

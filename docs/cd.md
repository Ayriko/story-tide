# Protocole de déploiement continu (CD) — C2.1.1

> État au 2026-07-18 (KAN-10) : chaîne CD complète câblée
> (`.github/workflows/cd.yml`), infra Docker (`deploy/`) prête. Voir ADR-0013
> pour les décisions de topologie, et `docs/manuels/deploiement.md` pour la
> procédure opérationnelle détaillée (prérequis serveur, bring-up, rollback).

## Chaîne cible

```
tag git (vX.Y.Z[-rc.N])
  └─▶ cd.yml / job release-consistency (KAN-44, ADR-0024)
        └─ scripts/release.ts --verify <tag> : version/CHANGELOG/annotation
           coherents, sinon le workflow s'arrete ici (voir plus bas)
  └─▶ cd.yml / job build-push
        ├─ docker/build-push-action (matrix : app, worker, migrate, backup)
        └─ push → ghcr.io/ayriko/story-tide-{app,worker,migrate,backup}:<tag> (public)
  └─▶ cd.yml / job deploy (environment staging|production)
        ├─ SSH vers le VPS (secrets VPS_HOST/VPS_USER/VPS_SSH_KEY)
        ├─ scp deploy/ (compose + traefik + backup, PAS les secrets)
        └─ docker compose -p storytide-<env> --env-file deploy/.env.<env> \
             -f deploy/compose.<env>.yml pull && ... up -d --wait
```

Le CI (`ci.yml`, inchangé) reste la garde de qualité/tests/e2e sur `main` et
les PR — `cd.yml` ne se déclenche que sur un tag, jamais sur un push de
branche. **Le VPS ne build jamais** : `build-push` est le seul point de
construction des images ; le VPS ne fait que `pull` une image déjà poussée.

## Environnements

| Environnement | Déclencheur | Domaine | Reviewer GitHub | Données |
|---|---|---|---|---|
| Staging | tag `vX.Y.Z-rc.N` | `staging.storytide.fr` | aucun (auto) | test |
| Production | tag `vX.Y.Z` | `storytide.fr` (+ `www` → apex) | requis (Aymeric) | réelles |

Les deux environnements tournent sur le **même VPS**, en projets Compose
isolés (`-p storytide-staging` / `-p storytide-prod`, voir ADR-0013) — volumes
et réseaux internes distincts, jamais les données de prod en staging.

**Rôle de Traefik** : reverse-proxy TLS partagé entre les deux environnements
(seul titulaire des ports 80/443 et de l'`acme.json` Let's Encrypt,
`deploy/traefik/`). Chaque stack applicative (`app`) porte ses propres labels
Traefik (routeur par domaine) ; PostgreSQL/MinIO/worker/migrate/backup ne sont
jamais exposés (garde-fou ufw/Docker, voir `docs/securite-owasp.md` A05).

## Déclenchement & rollback

- **Déclenchement** : un tag git annoté (`npm run release -- X.Y.Z-rc.N` puis
  `npm run release -- X.Y.Z` après recette OK sur staging, cf.
  `docs/manuels/mise-a-jour.md`) poussé sur `origin` (`git push origin main &&
  git push origin <tag>`) — jamais de déploiement sur un simple push de
  branche.
- **`package.json` `version`** (lu par `GET /api/health`, supervision C4.1.2) :
  resté à `0.1.0` (scaffold) de `v1.0.0-rc.1` à `v1.2.0` inclus, puis
  redésynchronisé au tag `v1.2.1` suivant malgré un premier correctif ponctuel
  (`d71f38f`) — 3 récidives datées au total, dont deux avec le CHANGELOG resté
  sous `[Unreleased]` au moment même du tag (`v1.2.0`, `v1.2.1`). **Automatisé
  depuis KAN-44 (ADR-0024)** : `npm run release` (`scripts/release.ts`)
  synchronise `package.json`/`package-lock.json` (y compris pour les
  `-rc.N`, contrairement à la politique précédente) et bascule le CHANGELOG au
  tag final ; le job `release-consistency` de `cd.yml` rejoue la même
  vérification (`src/lib/release/verify.ts`) sur le tag poussé et bloque
  `build-push` en cas d'incohérence — plus de rattrapage manuel possible.
- **Rollback** : re-taguer et re-pousser un tag existant ne republie pas
  (l'image existe déjà sur ghcr) — la procédure de retour arrière consiste à
  redéployer manuellement le tag précédent :
  ```
  ssh deploy@<VPS_HOST>
  cd ~/story-tide
  IMAGE_TAG=<tag-precedent> docker compose -p storytide-<env> \
    --env-file deploy/.env.<env> -f deploy/compose.<env>.yml up -d --wait
  ```
  Les migrations Prisma ne sont pas automatiquement réversibles (`prisma
  migrate deploy` est un aller simple) — un rollback applicatif après une
  migration destructrice nécessite une migration de compensation écrite à la
  main, pas un simple retour d'image (limite connue, documentée ici plutôt que
  passée sous silence).

## Preuves pour le jury

- Extrait de workflow : `.github/workflows/cd.yml` (jobs
  `release-consistency`/`build-push`/`deploy`).
- Run GitHub Actions complet (build → push → deploy) : capture à joindre après
  le premier déploiement staging réel (`TST-SEC-012`).
- `docker compose -p storytide-staging ... ps` / `docker compose -p
  storytide-prod ... ps` — tous les services à l'état `healthy`/`running`.
- Capture navigateur : `staging.storytide.fr` puis `storytide.fr` en HTTPS
  valide (cadenas, certificat Let's Encrypt).
- `docs/cahier-recettes.md` : `TST-SEC-009` à `TST-SEC-012`.

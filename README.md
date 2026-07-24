# Story Tide

Plateforme SaaS de worldbuilding (wiki d'entités + éditeur riche + graphe de
relations + liaison automatique des entités via un automate Aho-Corasick maison).
Projet de certification RNCP39583 (Bloc 2). Voir `CLAUDE.md` (règles de travail) et
`docs/spec-technique-bloc2.md` (spécification complète) pour le contexte produit et
les contraintes d'architecture.  
**Repository** : https://github.com/Ayriko/story-tide

## Liens (kit jury)

- **Production** : [storytide.fr](https://storytide.fr)
- **Staging** : [staging.storytide.fr](https://staging.storytide.fr)
- **Statut / supervision** : [status.storytide.fr](https://status.storytide.fr/)

## Prérequis

- [Node.js](https://nodejs.org/) 24+ (Active LTS ; requis par pg-boss)
- [Docker](https://www.docker.com/) + Docker Compose (PostgreSQL + MinIO en local)

## Démarrage

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d
npm install
npm run db:migrate
npm run dev
npm run worker #dans un second terminal
```

Sans ce second process (worker), la détection automatique d'entités (Aho-Corasick) enfile
bien les jobs de liaison (`entity-linking`) mais aucune `Relation` AUTO n'est
jamais créée — le job reste en attente en base tant qu'aucun worker n'est démarré
pour le consommer. La liaison MANUELLE (mention `@`) n'est pas concernée
(réconciliation synchrone, ADR-0011).

Ouvrir [http://localhost:3000](http://localhost:3000). `npm install` régénère aussi
le client Prisma (`postinstall`) ; `npm run db:migrate` applique les migrations sur
la base PostgreSQL du compose dev. Le bucket MinIO est créé automatiquement par le
service `minio-setup` de `docker-compose.dev.yml`, rien à faire à la main.

## Scripts npm

| Script | Rôle |
|---|---|
| `npm run dev` | Serveur de dev Next.js |
| `npm run worker` | Worker pg-boss (traite les jobs de liaison AUTO — à lancer en parallèle de `dev`) |
| `npm run build` / `npm run start` | Build de prod / lancement |
| `npm run lint` | ESLint, 0 warning toléré |
| `npm run typecheck` | `tsc --noEmit` (TS strict) |
| `npm run format` / `format:check` | Prettier (écrit / vérifie) |
| `npm run test` / `test:watch` | Vitest (une passe / watch) |
| `npm run test:coverage` | Vitest + couverture (seuil 80 % bloquant sur `src/lib` + `src/services`) |
| `npm run db:migrate` | Applique les migrations Prisma (dev) |
| `npm run db:generate` | Régénère le client Prisma |
| `npm run db:studio` | Prisma Studio |

## Documentation

L'ensemble de la documentation (architecture, sécurité OWASP, accessibilité RGAA,
cahier de recettes, ADR, CI…) vit dans [`docs/`](./docs/README.md), tenue à jour au
fil du développement.

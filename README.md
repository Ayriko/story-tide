# Story Tide

Plateforme SaaS de worldbuilding (wiki d'entités + éditeur riche + graphe de
relations + liaison automatique des entités via un automate Aho-Corasick maison).
Projet de certification RNCP39583 (Bloc 2). Voir `CLAUDE.md` (règles de travail) et
`docs/spec-technique-bloc2.md` (spécification complète) pour le contexte produit et
les contraintes d'architecture.

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
```

Ouvrir [http://localhost:3000](http://localhost:3000). `npm install` régénère aussi
le client Prisma (`postinstall`) ; `npm run db:migrate` applique les migrations sur
la base PostgreSQL du compose dev. Le bucket MinIO est créé automatiquement par le
service `minio-setup` de `docker-compose.dev.yml`, rien à faire à la main.

## Scripts npm

| Script | Rôle |
|---|---|
| `npm run dev` | Serveur de dev Next.js |
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

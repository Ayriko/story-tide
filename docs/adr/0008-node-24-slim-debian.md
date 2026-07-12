# ADR-0008 — `node:24-slim` (Debian/glibc) comme base des images Docker

- **Statut** : accepté
- **Date** : 2026-07-12
- **Décideur** : Aymeric (MOE) — a explicitement demandé de vérifier s'il existait
  une meilleure image de base (Alpine notamment) avant de valider le Dockerfile.

## Contexte et problème

Le Dockerfile multi-stage (cibles `app` et `worker`) doit choisir une image de base
Node. La spec (choix Bloc 1) prescrit « image `node:*-slim`, user non-root » sans
figer la variante précise ni la version majeure. Deux questions à trancher : Alpine
(musl, images plus petites) vs Debian slim (glibc) ; et quelle version majeure de
Node.

## Options envisagées

- **`node:*-alpine`** : image de base ~100 Mo plus légère (musl libc). Écartée après
  vérification : Prisma 7 avec driver adapter (`@prisma/adapter-pg`) reste fragile
  sur musl — moteur de requêtes introuvable / erreurs `linux-musl-openssl-3.0.x`
  documentées y compris en 2025-2026, nécessitant soit `binaryTargets` explicites
  dans `schema.prisma`, soit l'installation manuelle d'OpenSSL. `tsx`/`esbuild`
  (utilisés par le worker) ont le même type de friction musl (binaire natif par
  plateforme, `libc6-compat` requis). Aucun de ces problèmes ne se pose sur glibc.
- **`node:*-slim` (Debian)** : glibc standard, compatible nativement avec les
  moteurs Prisma et les binaires esbuild/tsx, sans configuration supplémentaire.
  Image plus lourde qu'Alpine mais fiabilité largement supérieure pour ce stack.
  Retenue.
- **Version majeure Node 22 vs 24** : au moment du build, `node:22-slim` déclenchait
  un avertissement `EBADENGINE` (`pg-boss@12.25.1` exige `node >=22.12.0`, la version
  22 générique installée était antérieure). Vérifié (2026-07) : Node 22 est en
  **Maintenance LTS** (EOL avril 2027), Node 24 est l'**Active LTS** (EOL avril 2028)
  et couvre largement le calendrier du projet. Node 24 retenu, aligné sur
  l'environnement de développement local (déjà en v24).

## Décision

`node:24-slim` comme base de toutes les cibles du `Dockerfile` (`base`, `deps`,
`builder`, `prod-deps`, `app`, `worker`). CI (`actions/setup-node`) alignée sur
Node 24 pour éviter toute divergence dev/CI/prod.

## Conséquences

- **Positives** : zéro friction Prisma/musl ni esbuild/musl ; une seule version Node
  à maintenir sur les trois environnements (dev/CI/Docker) ; marge de support LTS
  jusqu'à la fin du cycle de certification et au-delà.
- **Négatives (dette assumée)** : image plus grosse qu'une Alpine équivalente
  (~100 Mo de plus sur les stages de build ; l'image `app` finale reste petite grâce
  à la sortie `standalone` de Next.js, qui ne copie que les dépendances tracées).

## Compétence(s) servie(s)

C2.2.1 (choix technologique tracé, conteneurisation) ; C2.4.1 (justification des
choix). **Codé et vérifié** cette session : build réel des deux images, worker
lancé en conteneur (souscription à la file confirmée), arrêt gracieux vérifié
(`docker stop` → exit code 0), app lancée en conteneur (`whoami` confirme
l'exécution non-root, `curl /login` → HTTP 200).

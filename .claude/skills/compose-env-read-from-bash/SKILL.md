---
name: compose-env-read-from-bash
description: >
  Lire des variables d'un fichier .env au format Docker Compose depuis un shell
  bash (VPS, CI, script) sans le sourcer. Déclencheurs : source .env, ". .env",
  "syntax error near unexpected token 'newline'", MAIL_FROM, valeur avec espaces
  ou chevrons, .env.staging, .env.prod, sudo cat .env, set -a, export depuis
  .env, docker compose --env-file, variables MINIO_ROOT_USER S3_BUCKET.
---

# Un `.env` Compose n'est pas du shell : ne pas le sourcer

## Le symptôme

```
set -a; . <(sudo cat deploy/.env.staging); set +a
-bash: /dev/fd/63: line 34: syntax error near unexpected token `newline'
-bash: /dev/fd/63: line 34: `MAIL_FROM=Story Tide <contact@storytide.fr>'
```

## La cause

Le format `.env` de Compose accepte des valeurs **sans guillemets** contenant
espaces, `<`, `>`, `#`… Bash les lit comme du code : `<contact@…>` devient une
redirection. Compose, lui, lit le fichier avec son propre parseur.

## La solution

Extraire seulement les variables utiles, valeur brute jusqu'à la fin de ligne :

```bash
for v in MINIO_ROOT_USER MINIO_ROOT_PASSWORD S3_BUCKET POSTGRES_USER POSTGRES_DB; do
  export $v="$(sudo grep -E "^$v=" deploy/.env.staging | cut -d= -f2-)"
done
echo "$S3_BUCKET $MINIO_ROOT_USER"   # contrôle : rien de vide
```

`cut -d= -f2-` garde les `=` éventuels dans la valeur. Si une variable est
vide : elle est commentée ou nommée autrement (`grep -nE "MINIO|S3_" …`).

## Règle

Les commandes Compose reçoivent le fichier via `--env-file`, jamais via le
shell. Le shell n'a besoin que des quelques valeurs qu'on passe à `exec`
(`psql`, `mcli`), et on les lit une par une.

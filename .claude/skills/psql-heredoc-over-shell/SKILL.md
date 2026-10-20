---
name: psql-heredoc-over-shell
description: >
  Lancer une requête SQL Postgres à travers un shell (docker compose exec, ssh,
  sudo) quand elle contient à la fois des textes '…' et des identifiants "…"
  camelCase. Déclencheurs : psql -c, "extra command-line argument … ignored",
  "syntax error at or near", "column \"createdat\" does not exist", interval
  '7 days', "createdAt", table "user", guillemets simples et doubles, heredoc,
  <<'SQL', docker compose exec -T postgres, requête de contrôle sur le VPS.
---

# SQL Postgres à travers le shell : heredoc, jamais `psql -c`

## Le symptôme (18/10/2026, recette TST-ADM-003)

```
-c '… interval '7 days' …'  → psql: warning: extra command-line argument "days), …" ignored
                              ERROR:  syntax error at or near "7"
-c "… "createdAt" …"        → ERROR:  column "createdat" does not exist
… from 'user'               → ERROR:  syntax error at or near "'user'"
```

## La cause

Une requête Postgres sur un schéma Prisma a besoin **des deux** sortes de
guillemets : `'…'` pour les textes (`'7 days'`, `'ADMIN'`) et `"…"` pour les
identifiants camelCase ou réservés (`"createdAt"`, `"user"`). Le shell en
consomme forcément une :

- `-c '…'` : le premier `'` de la requête ferme la chaîne shell, la suite
  part en arguments séparés ;
- `-c "…"` : les `"` disparaissent, Postgres reçoit `createdAt` sans
  guillemets et le replie en minuscules ;
- `'user'` entre apostrophes est un **texte**, pas une table.

## La solution

Un heredoc à délimiteur entre apostrophes : le shell ne touche à rien.
Raccourci (manuel d'exploitation §4), à définir après `$DC` :

```bash
q() { $DC exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -P pager=off -v ON_ERROR_STOP=1; }
```

```bash
q <<'SQL'
select count(*) filter (where "createdAt" >= now() - interval '7 days') as inscrits_7j
from "user";
SQL
```

- `-T` : pas de pseudo-terminal, sinon l'entrée standard n'arrive pas à psql.
- `<<'SQL'` (délimiteur **entre apostrophes**) : ni `$`, ni guillemets, ni
  backslash interprétés.
- `-v ON_ERROR_STOP=1` : un bloc `BEGIN … COMMIT` s'arrête à la première erreur.

## Règle

Dès qu'une requête contient un `'` **et** un `"`, heredoc. Une procédure de
recette ou un manuel qui recommande `psql -c '…'` doit être corrigé : celle de
TST-ADM-003 avait été écrite sans être exécutée.

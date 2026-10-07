### Session — 2026-10-07 (suite) — Cowork · Release v1.5.1 : RC staging puis prod (Silo + KAN-77), Jira, runbook VPS

**Thèmes abordés :**
- Report de l'entrée Silo du matin dans `dev-log.md` (sections thématiques + journal) et redépôt dans le projet Claude.
- Jira : KAN-77 et KAN-78 (créé après coup pour la bascule Silo, la PR #36 n'en citait aucun) passés en Terminé avec commentaires traçables ; un ticket « RC staging » créé puis supprimé — règle posée : pas de ticket pour une tâche de release, les résiduels restent en commentaire des tickets concernés.
- RC `v1.5.1-rc.1` sur staging puis `v1.5.1` en production, avec recette complète des deux lots (Silo + KAN-77) en `debian` + `sudo`.
- Rédaction de `docs/manuels/exploitation-vps.md` (commandes courantes, mise en place d'une session, recette d'une RC, rollback).

**Décisions prises :**
- **Version `1.5.1`** (patch) : une correction (KAN-77) et un changement d'infrastructure sans fonctionnalité nouvelle (Silo). — Aymeric.
- **Pas de ticket Jira pour une RC / release** ; KAN-79 créé par Claude puis supprimé par Aymeric. Les résiduels « à valider en staging/prod » vivent en commentaire sur KAN-77 et KAN-78.
- **Opérations manuelles sur le VPS en `debian` + `sudo`**, jamais en remettant une clé perso sur `deploy` (règle du 09/09 confirmée). Les `.env` du home de `deploy` ne sont lisibles que via `sudo`.
- **Le cache Docker de `quay.io/minio/minio:RELEASE.2025-09-07` est conservé** sur le VPS tant que Silo n'a pas passé une release complète : c'est la seule condition d'un rollback total.
- Le port `127.0.0.1:5432` de `postgres` en prod est voulu (Prisma Studio via tunnel SSH), absent en staging ; documenté dans le runbook.

**Éléments notables / appris (gotchas) :**
- **Sourcer un `.env` Compose dans bash plante** (`syntax error near unexpected token 'newline'` sur `MAIL_FROM=Story Tide <contact@…>`) : le format Compose n'est pas du shell. → boucle `grep -E "^$v=" | cut -d= -f2-` limitée aux variables utiles. **Candidat skill.**
- **`sudo` nettoie l'environnement** : `export IMAGE_TAG=…` avant `sudo docker compose` ne passe pas (warning « variable is not set »). → `sudo IMAGE_TAG=<tag> docker compose …` dans la variable `$DC`.
- **`docker compose ps` cache les one-shot** (`migrate`, `minio-setup`) : `ps -a` pour lire leur `Exited (0)`.
- **`mcli ls` trie par nom, pas par date** : un `tail` ne montre pas le dernier upload, compter (`wc -l`) à la place.
- **`git push` refusé par GitHub avec `remote: Internal Server Error`** (Request ID fourni) : incident côté GitHub, rien de poussé, commit et tag locaux intacts. → attendre et relancer la même commande ; ne jamais re-tagger ni forcer.
- **Warning Prisma `failed to detect the libssl/openssl version`** en tête du log `migrate` : image `node:24-slim` sans paquet `openssl`, sans effet (migration appliquée). Dette mineure : `apt-get install openssl` dans le stage `migrate` du `Dockerfile`.
- Une recette qui démarre **après** le déploiement n'a plus d'inventaire « avant » : le compte d'objets d'avant bascule doit être pris **avant** de pousser le tag. Le runbook le place en tête de la section recette.

**Commandes utiles de la session :** voir les six lignes du 07/10 (suite) en « Commandes utiles » et `docs/manuels/exploitation-vps.md`.

**Livrables produits :**
- Tags `v1.5.1-rc.1` (`cfc59cb`) et `v1.5.1` (`591b2bf`), CHANGELOG `[1.5.1] - 2026-10-07` (Modifié : Silo ; Corrigé : KAN-77). Déploiement staging automatique, prod après approbation.
- **Recette staging** : 7 services sains, `migrate`/`minio-setup` `Exited (0)`, migration KAN-77 appliquée (`\d "Entity"` : deux colonnes `integer not null default 0`), 5 objets relus par Silo + images affichées, upload réel (6), `backup.sh` `EXIT=0` + miroir 6 fichiers, sauvegardes nocturnes des 06 et 07 présentes, TST-ENT-019 cas passant et cas « worker arrêté » ✅.
- **Recette prod** : 7 services sains, migration appliquée, **9 objets relus** + images affichées avant tout upload, upload de test (10), `backup.sh` `EXIT=0` (dump 122 Ko, cohérent avec la nocturne), TST-ENT-019 cas passant ✅, Better Stack vert pendant le déploiement.
- Jira : KAN-77 → Terminé (commentaires merge PR #35 + clôture prod) ; KAN-78 créé et → Terminé (description in-universe, commentaire PR #36 + clôture prod). Dev-log du matin reporté et redéposé dans le projet Claude.
- Docs : `docs/manuels/exploitation-vps.md` (nouveau, indexé dans `docs/README.md`) ; `docs/cahier-recettes.md` — TST-ENT-019 (recette staging + prod), TST-ENT-010 (relecture et upload sur Silo), TST-SEC-011 (non-régression aucun port ajouté) ; capture `docs/pilotages/captures/2026-10-07-release.png`.

**Avancement certification :** projet personnel, rubrique tenue par habitude. C2.1.1 : chaîne tag → CI → ghcr → staging → gate prod rejouée de bout en bout sur une release qui touche l'infra de stockage. C2.4.1 : manuel d'exploitation ajouté aux trois manuels existants. C2.3.1 : recette staging/prod tracée pour trois scénarios.

**À faire / suite :**
- Committer ce lot : `docs/manuels/exploitation-vps.md`, `docs/README.md`, `docs/cahier-recettes.md`, cette entrée, la capture (`docs(ops): manuel d'exploitation VPS, recette v1.5.1, devlog`).
- Skills candidates du jour (à écrire en session Claude Code) : `prisma generate` après changement de branche · conflit CHANGELOG `[Unreleased]` entre branches · collage PowerShell une ligne par étape · lecture d'un `.env` Compose depuis bash.
- Dette : `openssl` dans le stage `migrate` ; garde-fou `fetch` de `scripts/release.ts` (toujours en attente, non traité dans cette RC).
- Flake `folder-organization.spec.ts` : à surveiller à la prochaine suite complète, ticket si récidive.
- Prochain lot : KAN-69 (prompt `claude/prompt-session-kan-69.md`).

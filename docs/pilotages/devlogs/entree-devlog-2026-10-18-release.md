### Session — 2026-10-18 — Cowork · Release v1.6.0 : KAN-72 en staging puis en production

> Couvre aussi le passage Cowork du 14/10 (report de l'entrée du 13/10 dans `dev-log.md`, KAN-72 en Revue).

**Thèmes abordés :**
- 14/10 : report de l'entrée Claude Code du 13/10 (KAN-72 lot 1) dans `dev-log.md` et redépôt dans le projet Claude ; KAN-72 → Revue avec commentaire traçable.
- 18/10 : merge de la PR #37 par Aymeric, RC `v1.6.0-rc.1` sur staging, recette TST-ADM-001 à 003, sauvegarde de la prod avant le tag, `v1.6.0` en production, promotion du compte administrateur par SQL sur les deux environnements.
- Correction du manuel d'exploitation §4 et de TST-ADM-003 : le SQL passe par un heredoc, plus par `psql -c`.

**Décisions prises :**
- **Version `1.6.0`** (mineure) : nouvelle fonctionnalité, migration additive, aucune variable d'env ni changement de `deploy/`. — Aymeric.
- **Sauvegarde manuelle de la prod avant de pousser le tag final**, parce que la migration touche la table `user`. Le rollback applicatif reste possible (`IMAGE_TAG=1.5.1`) : colonnes à valeur par défaut, table ajoutée.
- **Requêtes SQL sur le VPS toujours en heredoc** via un raccourci `q() { $DC exec -T postgres psql … -v ON_ERROR_STOP=1; }`, jamais par `-c`. Inscrit au manuel d'exploitation §4.
- **Le cache des images MinIO peut être libéré** : Silo a passé une release complète (v1.6.0). Suppression laissée à l'initiative d'Aymeric.

**Éléments notables / appris (gotchas) :**
- **`psql -c` à travers le shell casse sur les guillemets.** Une requête Postgres a besoin de `'…'` (textes) et de `"…"` (identifiants camelCase). `-c '…'` : le `'` de `'7 days'` ferme la chaîne shell (`psql: warning: extra command-line argument … ignored`, puis `syntax error at or near "7"`). `-c "…"` : `"createdAt"` perd ses guillemets et Postgres cherche `createdat` (`column "createdat" does not exist`). `'user'` en apostrophes est un texte, pas une table. → heredoc `<<'SQL'` + `exec -T`. **Candidat skill.**
- **`curl` en PowerShell 5.1 est un alias d'`Invoke-WebRequest`** : pour comparer des statuts HTTP, `curl.exe -s -o NUL -w "%{http_code}"`.
- **Le cahier de recettes recommandait lui-même la forme qui casse** (`-c '…'` dans TST-ADM-003, rédigé sans exécution) : une procédure de recette s'écrit en la jouant, ou se relit contre le shell réel.
- La promotion SQL est rejouable sans doublon dans le journal (`INSERT 0 0` / `UPDATE 1` au second passage), grâce au filtre `role = 'USER'` sur l'insert.

**Commandes utiles de la session :**
- `q() { $DC exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -P pager=off -v ON_ERROR_STOP=1; }` puis `q <<'SQL'` … `SQL` — tout SQL sur le VPS.
- `curl.exe -s -o NUL -w "%{http_code}`n" https://<hôte>/admin` — statut HTTP seul depuis PowerShell (TST-ADM-001).
- `npm run release -- 1.6.0-rc.1 --dry-run` — prévisualiser la bascule CHANGELOG/version avant la vraie.

**Livrables produits :**
- PR #37 mergée (`982c98c`) ; tags `v1.6.0-rc.1` (`8969eac`) et `v1.6.0` (`18364c0`) ; CHANGELOG `[1.6.0] - 2026-10-18`.
- **Staging** : migration `20261013120000_kan72_user_role_plan_admin_audit` appliquée, compte promu ADMIN, TST-ADM-001 (404 identique anonyme/standard), TST-ADM-002 (quota levé, journal, auto-rétrogradation verrouillée), TST-ADM-003 (onze indicateurs égaux à leurs requêtes) ✅.
- **Production** : sauvegarde `EXIT=0` avant tag, migration appliquée, compte promu ADMIN, `/admin` accessible, 404 identique, images existantes affichées, Better Stack vert (captures `docs/pilotages/captures/2026-10-18-*.png`).
- Jira : KAN-72 → Terminé (commentaires 14/10 et 18/10).
- Docs : `docs/manuels/exploitation-vps.md` §4 (raccourci `q`, promotion et contrôle en heredoc) ; `docs/cahier-recettes.md` (TST-ADM-001 à 003 recettés, étape 2 de TST-ADM-003 corrigée).

**Avancement certification :** projet personnel, rubrique tenue par habitude. C2.1.1 : chaîne tag → staging → gate prod rejouée sur une release avec migration de la table `user`, sauvegarde préalable. C2.3.1 : trois scénarios recettés, dont un dont la procédure a été corrigée à l'exécution. C2.4.1 : manuel d'exploitation durci.

**À faire / suite :**
- Committer : `docs/manuels/exploitation-vps.md`, `docs/cahier-recettes.md`, cette entrée, les deux captures du 18/10.
- Passer les comptes des amis en UNLIMITED depuis `/admin` (raison « compte offert »).
- Optionnel : libérer le cache des images MinIO sur le VPS (`sudo docker image rm …`, voir l'échange du 18/10).
- Skills candidates en attente : `psql` en heredoc à travers le shell (18/10) ; `notFound()` depuis un layout ≠ vraie 404, `metadata` statique qui fuit sur une 404, `shadcn add` → import `cn` parasite, lien étiré contre l'actionnabilité Playwright (13/10).
- Décisions ouvertes de KAN-72 : en-tête `x-middleware-rewrite` (documenté, non traité), ligne cliquable non vérifiée sous Safari, libellé de recherche masqué.
- Dette : `openssl` dans le stage `migrate`, garde-fou `fetch` de `scripts/release.ts`.
- Prochains lots possibles : KAN-69 (prompt prêt), KAN-72 lot 2 (modération).

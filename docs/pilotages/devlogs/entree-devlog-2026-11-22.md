### Session — 2026-11-21/22 — Release 1.7.0 jusqu'en production (Cowork)

**Thèmes abordés :**
- Remise au propre du poste (branche de ménage supprimée, devlog du 08/11 retrouvé non commité puis ajouté sur `main`).
- CHANGELOG : limites connues rattachées à KAN-88 et KAN-90, puis KAN-91 et KAN-92.
- RC `v1.7.0-rc.1` en staging : panne de disque du VPS au déploiement, remise en route, contrôles serveur, recette.
- Recette staging jouée en grande partie par Claude dans le navigateur (Claude in Chrome), le reste par Aymeric ; suivi dans une feuille « Recette staging v1.7.0-rc.1 ».
- Tag `v1.7.0` en production, contrôles serveur, traces Jira.

**Décisions prises :**
- KAN-68 fermé : toutes ses pistes et le cadrage du 23/10 sont livrés par C1 + C2 ; les restes vivent déjà dans KAN-88 (performance ×4) et KAN-90 (couleurs, personnalisation).
- Commits de pure documentation directement sur `main`, sans PR (choix d'Aymeric : une PR pour de la doc est excessive).
- Deux KO mineurs de recette publiés en limites connues de la v1.7.0, avec un ticket chacun (choix d'Aymeric, recommandé) : KAN-91 (BUG-020) et KAN-92 (BUG-021). Aucun ne touche aux données, les deux se rattrapent à la main.
- Ticket d'exploitation KAN-93 après l'incident disque : purge des images dans le CD et alerte sur l'espace disque.
- SEC-019 étapes 3 à 5 (scripts en local) : validées par les tests de la garde (`dev-script-guard*.test.ts`, CI verte) plutôt que rejouées à la main.

**Éléments notables / appris (gotchas) :**
- **Disque du VPS plein au déploiement de la rc** : `could not write lock file "postmaster.pid": No space left on device` sur le postgres du staging **et de la prod**, Silo en « minimum free drive threshold ».
  - **Cause** : 100 Go d'images Docker jamais purgées (4 images par version et par RC depuis la v1.0.0). Elles vivent dans le stockage containerd : `du` sur `/var/lib/docker` ne montre que 178 Mo, seul `docker system df` dit la vérité.
  - **Solution** : `journalctl --vacuum-size=100M` pour débloquer, puis suppression des images `story-tide` hors 1.6.0 et 1.7.0-rc.1 (88 tags). 96 Go → 13 Go. La prod repart d'elle-même (`restart: unless-stopped`). Coupure d'environ 10 minutes, aucune perte (sauvegarde de 03:00 bonne, sauvegarde manuelle ensuite).
  - Suite : KAN-93.
- `postgres:16-alpine` est un tag flottant : le pull a ramené la 16.16 et recréé le conteneur postgres du staging puis de la prod. Récupération automatique propre, à épingler un jour (KAN-93, option).
- Un « Re-run failed jobs » du CD suffit après une panne d'infrastructure : `up -d` réapplique l'état sans retagger.
- Recette par navigateur : l'instance Cytoscape est accessible par `container._cyreg.cy`, ce qui permet de vérifier positions, visibilité et classes sans se fier aux captures (les liens du texte, 0,75 px en pointillés, sont invisibles sur une capture). Un geste `Shift` + glisser ne se simule pas : les gestes de liaison restent à la main.
- Les actions serveur se rejouent depuis la console avec leur en-tête `next-action` (capturé en interceptant `fetch`) : utile pour les cas « hors de son monde » (TST-SEC-018, TST-LNK-010 étapes 9-10, TST-ENT-020 étape 8).
- « Réorganiser » non déterministe : `fcoseOptions` et `communityLayoutOptions` passent `randomize: true` sans graine (KAN-91).
- React 19 remet à zéro le `<select>` « Groupe » de « Nouveau type » après une erreur d'action ; même famille que BUG-001 (KAN-92).
- Le script de release suggère `git push … && git push …`, inutilisable sous PowerShell 5.1, et lève un `DEP0190` (`spawn` avec `shell: true` et des arguments). À corriger dans un petit commit.

**Commandes utiles de la session :**
- `sudo docker system df` : espace réel des images (containerd), là où `du /var/lib/docker` ne voit rien.
- `sudo docker images --format '{{.Repository}}:{{.Tag}}' | grep '^ghcr.io/ayriko/story-tide-' | grep -v -E ':(1\.6\.0|1\.7\.0-rc\.1)$' | xargs -r sudo docker rmi` : purge ciblée des anciennes images (une image en cours d'utilisation est refusée, c'est voulu).
- `sudo journalctl --vacuum-size=100M` : quelques centaines de Mo libérés tout de suite, sans risque.
- `cookieStore.get('<nom>')` dans la console : lit les attributs d'un cookie (Path, SameSite, Secure, expiration) quand `document.cookie` ne suffit pas.

**Livrables produits :**
- Commits sur `main` : `3dd929d` (devlog 08/11 + CHANGELOG KAN-88/90), `9c1f493` (release v1.7.0-rc.1), `881b45d` (limites connues KAN-91/92), `486ab77` (release v1.7.0).
- Tags : `v1.7.0-rc.1` (staging), `v1.7.0` (production, `/api/health` = 1.7.0).
- Recette : 34 lignes, 31 OK, 2 KO mineurs (TST-MND-011, TST-GRF-015), 1 hors staging (TST-GRF-016). Statuts reportés dans `docs/cahier-recettes.md` ; TST-GRF-005 corrigé (les liens du texte n'ont plus de flèche depuis C2).
- Production : 3 migrations appliquées, 6 CHECK et l'index partiel présents, tableaux créés à l'ouverture des mondes existants.
- Jira : KAN-68 fermé ; commentaires « publié en v1.7.0 » sur KAN-81, 84, 87, 85 ; créés KAN-91, KAN-92 (bugs), KAN-93 (exploitation).

**À faire / suite :**
- Retours d'usage d'Aymeric et des utilisateurs sur la 1.7.0 dans les prochains jours, puis préparer la 1.7.1 (candidats : KAN-91, KAN-92, KAN-93, petit correctif du script de release).
- Ensuite, ordre décidé le 08/11 : KAN-90 (lot Apparence), lot D, KAN-86, KAN-89 ; KAN-46 à glisser tôt.
- Staging : monde de test « Recette 170 » et disposition d'Atheraus réorganisée laissés en place (données de test).
- Reporter cette entrée dans dev-log.md (hors repo) + redéposer dans le projet Claude.

---

**Erreurs rencontrées & Solutions**

| Date | Symptôme (message exact) | Cause | Solution |
|------|--------------------------|-------|----------|
| 2026-11-22 | `FATAL: could not write lock file "postmaster.pid": No space left on device` (staging et prod) | Disque du VPS plein : images Docker de toutes les versions jamais purgées (stockage containerd) | `journalctl --vacuum-size=100M`, puis `docker rmi` des images `story-tide` hors versions en service ; purge automatique à faire (KAN-93) |
| 2026-11-22 | `mcli: <ERROR> Unable to set anonymous none … Storage backend has reached its minimum free drive threshold` | Même cause : Silo refuse d'écrire sous son seuil d'espace libre | Libérer le disque, puis relancer le déploiement (Re-run failed jobs) |
| 2026-11-22 | `404 page not found` sur `https://storytide.fr/api/health` pendant la panne | Réponse par défaut de Traefik pendant la coupure | Revenu de lui-même une fois postgres reparti |

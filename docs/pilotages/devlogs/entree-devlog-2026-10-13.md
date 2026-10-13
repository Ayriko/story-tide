### Session — 2026-10-13 — KAN-72 lot 1 : page /admin, rôle et plan par utilisateur

**Thèmes abordés :**
- Modèle : `User.role` / `User.plan` / `User.planSource`, table `AdminAuditLog`, migration additive `20261013120000_kan72_user_role_plan_admin_audit`.
- Quotas lus depuis le plan du compte (`limitsForPlan`, `null` = pas de plafond).
- Garde d'administration 404-identique : `proxy.ts` + gardes de layout, de pages, de métadonnées et de Server Actions.
- Trois pages sous `/admin` (tableau de bord, liste, fiche), changement de plan et de rôle avec raison, journal.
- Script de promotion en dev, SQL de promotion pour la prod.
- Retouches d'interface demandées en relecture : lien « Administration » dans le pied de page, onglets segmentés, ligne de liste cliquable, pied de page collé en bas, tuiles de tête, recherche.
- Traces : ADR-0029, OWASP A01/A05/A09, TST-ADM-001 à 003, manuel d'exploitation §4, CHANGELOG.

**Décisions prises :**
- **Rôle relu en base à chaque appel, jamais en session** — un rôle retiré resterait valable jusqu'à l'expiration de la session ; écartés : `additionalFields` de Better Auth, plugin `admin` de Better Auth (pas de plan, pas de journal avec raison, surface `/api/auth/admin/*`) — fixé par Aymeric dans le prompt.
- **`proxy.ts` devant `/admin`, en plus des gardes de pages** — `notFound()` depuis un layout rend la coquille d'erreur de Next, distinguable d'une route inexistante au `curl` ; écarté : `notFound()` seul — proposé en cours de route, tranché par Aymeric.
- **`requireAdmin()` avant Zod dans `src/actions/admin.ts`** — exception à l'ordre du projet (Zod puis session) : une erreur de validation rendue à un anonyme trahirait l'existence de l'action — proposé au plan, validé par Aymeric.
- **Transaction (modification + ligne de journal) dans le service, pas dans l'action** — règle de couches ; le prompt la plaçait « dans les actions » — proposé au plan, validé.
- **Activité et « actifs 30 j » sur les mondes `origin = USER` seulement** — le monde d'exemple cloné date ses 25 entrées du jour de l'inscription — tranché par Aymeric.
- **FK `AdminAuditLog.actor` en `ON DELETE RESTRICT`** — le journal ne perd jamais son auteur ; conséquence : un compte administrateur ne se supprime pas en base tant que son journal existe (lot 2) — tranché par Aymeric.
- **Découpage par jour et seuil « proche du plafond » calculés en TypeScript** — Prisma ne tronque pas une date et ne filtre pas sur un compteur de relation ; écarté : `$queryRaw` `date_trunc`, difficile à falsifier sur mock — proposé au plan, validé.
- **Lien « Administration » dans le pied de page plutôt que dans le menu utilisateur** (prop `showAdminLink` de `Footer`) — demande d'Aymeric en relecture ; écarté : bouton dans la barre du haut.
- **Ligne de liste cliquable par lien étiré** (`after:absolute after:inset-0` sur le lien de l'e-mail, `<tr>` en `relative`) — un seul arrêt clavier par compte ; écarté : colonne « Voir la fiche » (deux liens par ligne) — choisi par Aymeric parmi les options proposées.
- **En-tête `x-middleware-rewrite` : non tranché.** Reste une limite documentée (ADR-0029, ligne A01).

**Éléments notables / appris (gotchas) :**
- **`notFound()` depuis un layout ou une page ≠ vraie 404.** Statut 404, mais document `<html id="__next_error__">`, sans le titre « 404 », et charge RSC qui nomme le segment `(admin)`. Solution : réécriture par `proxy.ts` vers une route absente (`/introuvable`) ; le corps devient identique à celui d'une route inexistante, à l'identifiant `__next_r` près. (candidat skill)
- **`export const metadata` statique fuit sur une 404.** Next résout les métadonnées indépendamment du rendu : `<title>Administration` était servi à un anonyme. Solution : `generateMetadata` qui appelle la garde, sur le layout et chaque page. (candidat skill)
- **La réécriture du proxy laisse un en-tête `x-middleware-rewrite: /introuvable`**, absent d'une 404 ordinaire. Non corrigé (voir « À faire »).
- **`npx shadcn add chart table badge select` a généré `import { cn } from "cn"` et ajouté une dépendance npm `cn` parasite.** Solution : imports corrigés en `@/lib/utils`, `npm uninstall cn`, Prettier. (candidat skill)
- **Lien étiré et Playwright** : `locator.click()` / `hover()` sur une cellule recouverte échoue avec `<a …> from <td …> subtree intercepts pointer events` jusqu'au `Timeout 30000ms exceeded`. C'est le comportement voulu, pas un défaut. Solution : `boundingBox()` puis `page.mouse.click(x, y)`. (candidat skill)
- **`hover:bg-accent` invisible sur une ligne de tableau posée sur une carte** (teinte quasi identique). Solution : `hover:bg-foreground/5`.
- **Palette du graphique** : `--chart-1` / `--chart-5` échouent au validateur de lisibilité sur le fond des cartes. Solution : `#1aa68f` + `var(--primary)`, seconde série en pointillés, tableau de données sous la courbe.
- **`// @vitest-environment node` en tête d'un test casse le fichier de setup** (il suppose jsdom). Solution : retirer la directive.
- **Mocks Prisma typés** : un `aggregate` simulé doit rendre tous les groupes (`_count`, `_avg`, `_sum`, `_min`, `_max`) ; un littéral passé en ligne déclenche le contrôle des propriétés en trop. Solution : fabrique `makeImageAggregate`, objets affectés à une variable d'abord.
- **`Add-Content` (PowerShell) écrit en CRLF** dans un dépôt en LF. Solution : Edit ou script Python avec `newline=""`.
- **La commande e2e ne rend pas la main après `N passed`** sous Windows (processus `tsx src/worker/index.ts` orphelins). Solution : lire le résumé dans le fichier de sortie, puis `taskkill /T /F` sur les arbres restants. Déjà couvert par la skill e2e-run-hygiene-windows.
- **Deux `next dev` sur le même dépôt** : arrêter le serveur de dev (port 3000) avant un run e2e (port 3100).

**Commandes utiles de la session :**
- `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` — SQL d'une migration sans mode interactif, à relire puis poser dans son dossier ; suivi de `npx prisma migrate deploy` et `npx prisma generate`.
- `npm run admin:promote -- <email>` — promotion ADMIN en dev, avec ligne de journal ; rejouable sans effet.
- `npx playwright test e2e/admin.spec.ts --workers=1 *> <fichier>` — un spec seul, sortie vers fichier.
- `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'playwright|src/worker|next' }` — repérer les orphelins après un run e2e.

**Livrables produits :**
- Quatre commits sur `feat/kan-72-admin-dashboard`, poussés par Aymeric :
  - `86b4ad1` feat(admin) — rôle, plan, journal, quotas lus depuis le plan ;
  - `254e949` feat(admin) — page `/admin`, garde 404-identique, changement de plan et de rôle ;
  - `5f18b05` test(admin) — quotas, garde, services, actions, proxy, e2e ;
  - `bc01fbc` docs(admin) — ADR-0029, OWASP, TST-ADM-001 à 003, promotion en production.
- 32 fichiers créés, 21 modifiés. Une dépendance ajoutée (`recharts`), aucune variable d'environnement.
- Gates en fin de session : lint ✅ · typecheck ✅ · format ✅ · tests ✅ (68 fichiers, 675 tests) · couverture 99,03 % de lignes, 96,34 % de branches · e2e ✅ (22 sur 22, `--workers=1`) · build ✅.
- Seul le dernier commit est vert côté tests : entre `86b4ad1` et `5f18b05`, les tests des quotas ne correspondent pas au code (découpage demandé).

**Avancement certification :**
- **C2.2.1** : garde en couches (proxy, layout, page, action), écritures en service dans une transaction — ADR-0029, `docs/adr/README.md`.
- **C2.2.2** : neuf fichiers de tests unitaires ajoutés, quatre complétés, un spec e2e à trois scénarios ; seuil de couverture inchangé.
- **C2.2.3** : contrôle d'accès 404-identique (A01), non-indexation de `/admin` (A05), journal des actions d'administration (A09) — `docs/securite-owasp.md`. Accessibilité : `aria-current` sur les onglets, tableau de données sous le graphique, un seul arrêt clavier par ligne.
- **C2.3.1** : TST-ADM-001, 002, 003 et catégorie `ADM` dans la nomenclature — `docs/cahier-recettes.md`, `CLAUDE.md`.
- **C2.4.1** : procédure de promotion en production — `docs/manuels/exploitation-vps.md` §4 ; `CHANGELOG.md` ([Unreleased], Ajouté).

**À faire / suite :**
- **Ouvrir la PR** de `feat/kan-72-admin-dashboard` vers `main` (quoi / pourquoi / preuve de test), puis merge, version et tag par Aymeric.
- **Promotion du premier administrateur en production, à la main, après le déploiement de la migration** (manuel d'exploitation §4, adresse à remplacer) :

  ```bash
  $DC exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 <<'SQL'
  BEGIN;
  INSERT INTO "AdminAuditLog" (id, "actorId", "targetUserId", action, before, after, reason)
  SELECT 'promo-' || md5(random()::text || clock_timestamp()::text), id, id, 'role.change',
         '{"role":"USER"}'::jsonb, '{"role":"ADMIN"}'::jsonb, 'promotion par script'
  FROM "user" WHERE email = 'adresse@exemple.fr' AND role = 'USER';
  UPDATE "user" SET role = 'ADMIN' WHERE email = 'adresse@exemple.fr';
  COMMIT;
  SQL
  ```

  Même opération sur staging avant la recette. Contrôle : le lien « Administration » apparaît dans le pied de page au rechargement.
- **Recette staging** de TST-ADM-001, 002 et 003 (statut « à jouer » dans le cahier), dont la comparaison SQL des indicateurs.
- **À trancher par Aymeric : en-tête `x-middleware-rewrite`.** Proposition non appliquée et non testée : dans `deploy/traefik/dynamic/middlewares.yml`, ajouter à `secure-headers` un `customResponseHeaders` avec `X-Middleware-Rewrite: ""`. Sinon, le laisser en limite documentée.
- **Safari** : la ligne cliquable de la liste n'est vérifiée que dans Chromium. Repli prévu : colonne « Voir la fiche ».
- **Libellé du champ de recherche** masqué visuellement (texte indicatif + bouton à l'écran) : à confirmer ou à rendre visible.
- **Base de dev** : comptes de test laissés en place (`kan72-admin-1791889811@story-tide.test`, `kan72-check-1791889497@story-tide.test`, comptes créés par les e2e) ; `dev-local@storytide.test` est resté ADMIN.
- **Commentaire Jira KAN-72** (lot 1 livré, lot 2 à ouvrir) : texte fourni en session, à poster.
- **Lot 2** : modération et suppression de compte (dont le cas d'un compte administrateur, bloqué par la FK en RESTRICT), jobs pg-boss, dernière sauvegarde, espace disque, volume Silo.
- Reporter cette entrée dans dev-log.md (hors repo) + redéposer dans le projet Claude.
- Mettre à jour le board Jira (stories touchées → bonne colonne).

---

**Décisions techniques**

| Date | Décision | Alternatives | Justification |
|---|---|---|---|
| 2026-10-13 | **Rôle et plan en deux champs sur `User`, plus `planSource` et `AdminAuditLog` ; rôle relu en base à chaque appel** | Plugin `admin` de Better Auth ; rôle en session (`additionalFields`) ; plan déduit d'un abonnement | Rôle et plan varient indépendamment ; un rôle retiré ne doit pas survivre dans une session ; `planSource = MANUAL` protège un compte offert d'un futur abonnement (ADR-0029) |
| 2026-10-13 | **`proxy.ts` (matcher `/admin`, `/admin/:path*`) qui réécrit les non-administrateurs vers une route absente, en plus des gardes de pages et d'actions** | `notFound()` dans le layout et les pages seulement | `notFound()` rend un document distinguable d'une route inexistante ; le proxy reste fermé en cas de panne et journalise la cause (ADR-0029) |
| 2026-10-13 | **Garde avant Zod dans les Server Actions d'administration** | Ordre habituel Zod puis session | Une erreur de validation rendue à un anonyme révélerait l'existence de l'action |

**Erreurs rencontrées & Solutions**

| Date | Symptôme | Cause | Solution |
|---|---|---|---|
| 2026-10-13 | `/admin` en 404 mais document `<html id="__next_error__">`, différent d'une route inexistante | `notFound()` appelé depuis un layout rend la coquille d'erreur de Next | Réécriture par `proxy.ts` vers `/introuvable` |
| 2026-10-13 | `<title>Administration` servi sur la 404 de `/admin` | `export const metadata` statique résolu indépendamment du rendu | `generateMetadata` qui appelle la garde |
| 2026-10-13 | `import { cn } from "cn"` et dépendance `cn` dans `package.json` après `npx shadcn add` | Alias mal résolu par le générateur | Imports vers `@/lib/utils`, `npm uninstall cn` |
| 2026-10-13 | `subtree intercepts pointer events` puis `Timeout 30000ms exceeded` sur `locator.click()` d'une cellule | Lien étiré sur la ligne, refusé par le contrôle d'actionnabilité de Playwright | `boundingBox()` puis `page.mouse.click(x, y)` |
| 2026-10-13 | Commande e2e bloquée après `22 passed` | Processus `tsx src/worker/index.ts` orphelins sous Windows | Lire le résumé dans le fichier de sortie, `taskkill /T /F` sur les arbres restants |

Tout le code de la session est commité et poussé ; seul ce fichier d'entrée ne l'est pas encore.

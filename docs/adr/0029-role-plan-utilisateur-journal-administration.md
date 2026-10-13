# ADR-0029 — Rôle et plan utilisateur, journal d'administration

- **Statut** : accepté
- **Date** : 2026-10-13
- **Décideur** : Aymeric (MOE)

## Contexte et problème

Jusqu'à la v1.5.1, tous les comptes sont identiques : aucun n'administre le
service, et les quotas de l'offre gratuite (ADR-0014) sont deux constantes
(`FREE_WORLD_LIMIT`, `FREE_ENTITY_LIMIT_PER_WORLD`) appliquées à tout le monde.
L'état du service se lit au `psql` ou dans Prisma Studio à travers un tunnel SSH.

KAN-72 lot 1 ouvre une page `/admin` et pose trois besoins liés :

- **Savoir qui peut entrer dans `/admin`.** Un seul administrateur aujourd'hui,
  mais la règle doit tenir à plusieurs.
- **Lever les plafonds sur certains comptes** (comptes offerts à des proches)
  avant que l'abonnement existe, sans recoder les quotas.
- **Ne pas se piéger pour l'abonnement à venir.** Le jour où un paiement pose
  un plan, un renouvellement ne doit pas écraser un compte offert à la main.

S'y ajoute une contrainte de sécurité déjà en vigueur dans le projet (OWASP
A01, patron « introuvable ») : un compte standard ne doit pas pouvoir
distinguer « `/admin` n'existe pas » de « pas pour vous ».

## Options envisagées

**Modèle de données :**

- **A — Deux champs distincts sur `User` (`role`, `plan`), plus `planSource`,
  plus une table `AdminAuditLog`** (retenue). Un rôle dit ce qu'on peut
  administrer, un plan dit ce qu'on peut créer : les deux varient
  indépendamment (un administrateur peut être en plan gratuit, un compte offert
  n'administre rien).
- **B — Plugin `admin` de Better Auth** (écartée). Il apporte un champ `role`,
  le bannissement et l'usurpation de session, mais pas de plan, pas de journal
  avec raison, et il place le rôle dans la session. Il élargit aussi la surface
  d'API d'authentification (`/api/auth/admin/*`) pour des fonctions dont le
  lot 1 n'a pas l'usage.
- **C — Plan déduit d'un abonnement, sans champ `plan` ni source** (écartée).
  Aucun abonnement n'existe encore, et un plan purement dérivé ne laisse aucune
  place à un compte offert : il faudrait une table d'exceptions, c'est-à-dire
  `planSource` sous un autre nom.

**Où lire le rôle :**

- **D — Dans la session** (`additionalFields` de Better Auth) (écartée). Un
  rôle retiré resterait valable jusqu'à l'expiration de la session.
- **E — En base, à chaque appel** (retenue) : une requête `select { role }`
  par vérification.

**Où refuser l'accès :**

- **F — `notFound()` dans le layout et les pages seulement** (insuffisante
  seule). Le statut est bien 404, mais le document n'est pas celui d'une route
  inexistante : Next répond par sa coquille d'erreur (`<html
  id="__next_error__">`), sans le titre « 404 », et la charge RSC nomme le
  segment `(admin)`. Constaté au `curl` pendant le développement.
- **G — Un `proxy.ts` devant `/admin`, en plus des gardes de pages** (retenue).

## Décision

**Modèle (option A).** Une migration additive
(`20261013120000_kan72_user_role_plan_admin_audit`) :

- `User.role` : `USER` (défaut) ou `ADMIN`.
- `User.plan` : `FREE` (défaut) ou `UNLIMITED`.
- `User.planSource` : `DEFAULT` (défaut), `MANUAL` (posé par un administrateur),
  `SUBSCRIPTION` (réservé à l'abonnement). Règle posée dès maintenant : un plan
  `MANUAL` est prioritaire sur un plan d'abonnement.
- `AdminAuditLog` : acteur, cible, action, avant, après, raison, date. `action`
  est une chaîne (`plan.change`, `role.change`, constantes TypeScript) et non
  un enum SQL, parce que la liste va grandir avec la modération (lot 2).

Les trois colonnes ont un `DEFAULT` : Better Auth continue de gérer la table
`user` sans les connaître (aucun `additionalFields` dans `src/lib/auth.ts`),
l'inscription ne change pas. Vérifié par une inscription réelle après migration.

**Quotas.** `limitsForPlan(plan)` (`src/lib/quotas.ts`) rend les deux plafonds,
`null` signifiant « pas de plafond ». `createWorld` et `createEntity` lisent le
plan du propriétaire en base puis appliquent ces limites ; les exemptions par
origine de monde (`INTRO`, `DEMO`, ADR-0014) sont inchangées. Un compte
introuvable retombe sur `FREE`, le palier le plus restrictif.

**Garde (options E et G).** Trois niveaux, tous relisant le rôle en base :

1. `src/proxy.ts` (matcher `/admin`, `/admin/:path*`) réécrit la requête d'un
   non-administrateur vers une route qui n'existe pas. La réponse est alors la
   404 standard de l'application, pour les pages comme pour les Server Actions.
   En cas de panne de la vérification, le proxy reste fermé (réécriture) et
   journalise la cause.
2. `requireAdminOrNotFound()` dans le layout, dans chaque page et dans leurs
   métadonnées (`generateMetadata`). Jamais de `export const metadata` statique
   sous `/admin` : Next le résout indépendamment du rendu et servirait le titre
   « Administration » même sur une 404.
3. `requireAdmin()` dans chaque Server Action, **avant** la validation Zod.
   C'est une exception délibérée à l'ordre habituel du projet (Zod puis
   session) : une erreur de validation rendue à un anonyme trahirait
   l'existence de l'action.

**Écritures.** Chaque changement de plan ou de rôle passe par une transaction
Prisma qui écrit la modification et sa ligne de journal ensemble
(`src/services/admin-user-service.ts`). Un administrateur ne peut pas retirer
son propre rôle (refus dans le service, formulaire verrouillé dans la fiche).

**Première promotion.** Aucune interface ne permet de devenir administrateur.
En développement : `npm run admin:promote -- <email>`. En production : deux
requêtes SQL passées à la main (`docs/manuels/exploitation-vps.md` §4). Les
deux écrivent une ligne de journal où l'acteur est la cible.

## Conséquences

- **Premier `proxy.ts` du projet.** Jusqu'ici, toute protection de route vivait
  dans les layouts et les pages. Le proxy ne remplace pas ces gardes : il
  garantit seulement que le refus a la forme d'une vraie 404. Tout futur
  matcher ajouté à ce fichier s'exécute avant le routage, sur chaque requête
  concernée.
- **Limite résiduelle du 404-identique.** Next ajoute à la réponse réécrite un
  en-tête interne `x-middleware-rewrite: /introuvable`, absent d'une 404
  ordinaire. Le corps et le statut sont identiques, l'en-tête ne l'est pas. Il
  peut être retiré à la frontière (middleware Traefik `secure-headers`) ; cette
  mesure n'est pas appliquée dans ce lot.
- **Coût en requêtes.** Le rôle est relu à chaque vérification : proxy, layout,
  page et métadonnées font chacun une lecture de session et une lecture de
  rôle sur une requête `/admin`. Hors `/admin`, le pied de page ajoute une
  lecture de rôle par rendu pour afficher ou non le lien « Administration ».
  Acceptable pour une page réservée à l'administrateur ; à regrouper (`cache()`
  de React) si le coût devient visible.
- **Un administrateur ne se supprime pas en base tant que son journal existe.**
  `AdminAuditLog.actor` est en `ON DELETE RESTRICT` : le journal ne perd jamais
  son auteur. Cela vaut aussi pour un compte promu par script (acteur = cible).
  La suppression d'un compte administrateur est à traiter avec la modération
  (lot 2).
- **Indicateurs d'activité.** « Actifs sur 30 jours » et la courbe d'activité
  ne comptent que les entrées des mondes `origin = USER` : le monde d'exemple
  cloné à l'inscription date ses 25 entrées du jour de l'inscription et
  fausserait les deux. `Entity.updatedAt` ne garde que la dernière
  modification : la courbe montre le jour de la dernière retouche de chaque
  entrée, pas le nombre de retouches par jour.
- **Comptes proches du plafond et courbe calculés en mémoire.** Prisma ne
  filtre pas sur un compteur de relation et ne tronque pas une date au jour :
  le service remonte des compteurs et des horodatages (jamais le contenu des
  fiches) et applique le seuil ou le découpage en TypeScript. Sans enjeu au
  volume actuel ; à passer en SQL si le nombre de comptes ou d'entrées
  modifiées par mois change d'ordre de grandeur.
- **Abonnement à venir.** Il ajoutera des valeurs à `UserPlan`, écrira
  `planSource = SUBSCRIPTION`, et devra laisser intact tout compte en
  `planSource = MANUAL`. `limitsForPlan` est un `Record` exhaustif : un palier
  ajouté sans limites déclarées casse le typecheck.

## Compétence(s) servie(s)

C2.2.1 (architecture : garde en couches, écritures en service, transaction),
C2.2.3 (sécurité : OWASP A01 contrôle d'accès, A05 non-indexation, A09 journal
des actions d'administration), C2.2.2 (tests unitaires et de bout en bout),
C2.3.1 (scénarios `TST-ADM-001` à `TST-ADM-003`).

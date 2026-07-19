# ADR-0014 — Quotas freemium en couche service + marqueur `World.origin` anticipatoire

- **Statut** : accepté
- **Date** : 2026-07-19
- **Décideur** : Aymeric (MOE)

## Contexte et problème

KAN-18 : limiter le tier gratuit en nombre de mondes et d'entités par monde,
**sans Stripe** (P2, hors périmètre — spec §2.9). Deux questions à trancher :
où appliquer la limite (couche service ou couche action), et comment anticiper
le futur monde d'introduction "Atheraus" (KAN-35, cloné à l'inscription,
référence LegendKeeper) ainsi qu'un futur compte de démonstration jury —
deux catégories de mondes distinctes qui doivent rester **hors quota** sur les
deux axes (mondes ET entités) sans qu'il faille retoucher la logique de
comptage une seconde fois quand KAN-35 sera construit.

## Options envisagées

**Où appliquer la limite :**
- **A — Vérification dans l'action** (`src/actions`), à l'image de la borne de
  taille `MAX_CONTENT_JSON_BYTES` (`entity-content.ts`) : simple, mais
  contournable par un futur appelant du service hors UI (API, script admin) —
  la limite ne serait alors qu'une convention de l'action, pas une garantie du
  domaine.
- **B — Exception typée levée par le service** (`WorldQuotaExceededError`,
  `EntityQuotaExceededError`), même forme que `WorldNotFoundError`/
  `EntityNotFoundError` — retenue.

**Marqueur d'origine du monde :**
- **A — Booléen `isIntroWorld`** : suffisant pour distinguer "monde normal" de
  "monde d'intro", mais ne représente pas le compte de démonstration jury (une
  troisième catégorie, distincte du monde d'intro par utilisateur) — écartée
  en cours de cadrage (19/07) au profit d'un enum couvrant les trois cas.
- **B — `enum WorldOrigin { USER, INTRO, DEMO }`** — retenue : `INTRO` (monde
  d'introduction cloné à l'inscription) et `DEMO` (monde du compte de
  démonstration jury) sont tous deux hors quota, sans confondre les deux
  concepts dans un seul booléen.

## Décision

**Application en service** : `createWorld` (`world-service.ts`) et
`createEntity` (`entity-service.ts`) vérifient le quota et lèvent une
exception typée **avant** toute écriture Prisma. Spec §7 place explicitement
les quotas dans `src/services`, testés aux côtés de l'authz/CRUD ; spec §5
(OWASP A04) les cadre comme mesure anti-abus — une mesure de sécurité ne doit
pas dépendre de la discipline de l'appelant. `createWorldAction`/
`createEntityAction` attrapent la nouvelle exception et réutilisent
l'affichage `formError`/`role="alert"` déjà en place (aucune UI nouvelle).

**Marqueur anticipatoire** : `World.origin WorldOrigin @default(USER)` posé
dès ce ticket. `createWorld` compte
`prisma.world.count({ where: { ownerId, origin: WorldOrigin.USER } })`
(3 max) ; `createEntity` saute entièrement le contrôle si
`world.origin !== WorldOrigin.USER` (0 requête `count` supplémentaire —
`getWorld` a déjà renvoyé l'objet complet), sinon compte
`prisma.entity.count({ where: { worldId } })` (50 max). Quand KAN-35 posera
`origin: INTRO` au clonage (ou qu'un compte `DEMO` sera provisionné), aucune
ligne de `world-service.ts`/`entity-service.ts` n'aura à changer.

**Chiffres retenus** (Aymeric, 2026-07-19, aucune valeur dans la spec) : 3
mondes gratuits par compte, 50 entités gratuites par monde
(`src/lib/quotas.ts`).

## Conséquences

- **Positives** : quota infranchissable même par un futur appel direct au
  service (API, script) ; l'enum couvre les deux catégories hors-quota (intro
  ET démo) sans les confondre dans un seul booléen ; ne coûte qu'une migration
  additive aujourd'hui plutôt qu'une réouverture de `world-service.ts`/
  `entity-service.ts` en KAN-35 ; zéro nouveau composant UI (réutilise
  `formError`/`role="alert"` existant, RGAA déjà satisfait).
- **Négatives / à surveiller** : les chiffres (3, 50) sont arbitraires
  (aucune donnée d'usage) — à ajuster si l'expérience réelle le justifie,
  centralisés dans `src/lib/quotas.ts` pour un changement à un seul endroit.
  `origin: INTRO`/`DEMO` restent des valeurs mortes tant que KAN-35 n'existe
  pas et qu'aucun compte démo n'est provisionné — attendu, documenté, pas un
  bug.

## Compétence(s) servie(s)

C2.2.1 (architecture — logique métier en service, pas dans l'action) ; C2.2.3
(sécurité — OWASP A04, mesure anti-abus non contournable) ; C2.4.1
(traçabilité — anticipation documentée de KAN-35).

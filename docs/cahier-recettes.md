# Cahier de recettes — C2.3.1 (ÉLIMINATOIRE)

> Scénarios dérivés des user stories MoSCoW du Bloc 1. Nomenclature `TST-<CAT>-<NNN>`
> (AUT/MND/ENT/LNK/GRF/SEC/QOT). 6 champs par scénario (Description, Objectif,
> Préconditions, Étapes, Résultat attendu, Critères d'acceptation). Cas passants ET
> cas d'échec. Statut : ⬜ à faire / ✅ OK / ❌ KO (→ `plan-correction-bogues.md`).
>
> État au 2026-07-13 : scénarios **AUT**, **SEC** et **MND** (mondes) exécutés en
> conditions réelles (base Postgres réelle, deux comptes réels via l'API Better
> Auth) — pas encore exécutés sur staging (pas de staging à ce stade). Autres
> catégories (ENT/LNK/GRF/QOT) : pas encore de scénario, les features
> correspondantes n'existent pas.

## TST-AUT-001 — Inscription avec des identifiants valides

- **Description** : un visiteur crée un compte avec nom, e-mail et mot de passe valides.
- **Objectif** : vérifier que l'inscription crée l'utilisateur, hache le mot de passe et ouvre une session.
- **Préconditions** : aucun compte existant avec cette adresse e-mail.
- **Étapes** : 1) Aller sur `/register`. 2) Renseigner nom, e-mail, mot de passe (≥8 caractères). 3) Soumettre.
- **Résultat attendu** : redirection vers `/`, cookie de session posé (`HttpOnly`, `SameSite=Lax`).
- **Critères d'acceptation** : une ligne `User`/`Session`/`Account` créée en base ; `account.password` est un hash, jamais en clair.
- **Type** : fonctionnel · **Statut** : ✅ (vérifié via `POST /api/auth/sign-up/email` + inspection `psql`)

## TST-AUT-002 — Connexion avec des identifiants valides

- **Description** : un utilisateur déjà inscrit se connecte avec le bon e-mail/mot de passe.
- **Objectif** : vérifier l'ouverture de session pour un compte existant.
- **Préconditions** : un compte existe avec cet e-mail/mot de passe.
- **Étapes** : 1) Aller sur `/login`. 2) Renseigner e-mail et mot de passe corrects. 3) Soumettre.
- **Résultat attendu** : redirection vers `/`, nouvelle session posée.
- **Critères d'acceptation** : une nouvelle ligne `Session` créée, liée au bon `userId`.
- **Type** : fonctionnel · **Statut** : ✅ (vérifié via `POST /api/auth/sign-in/email` + testé manuellement par Aymeric)

## TST-AUT-003 — Connexion avec un mauvais mot de passe

- **Description** : un utilisateur saisit un e-mail valide mais un mauvais mot de passe.
- **Objectif** : vérifier qu'aucune information ne permet de déduire si l'e-mail existe (anti-énumération, OWASP A07).
- **Préconditions** : un compte existe avec cet e-mail.
- **Étapes** : 1) Aller sur `/login`. 2) Renseigner l'e-mail valide et un mot de passe incorrect. 3) Soumettre.
- **Résultat attendu** : message générique affiché : « E-mail ou mot de passe incorrect. »
- **Critères d'acceptation** : le message ne distingue jamais « e-mail inconnu » de « mot de passe faux » ; aucune nouvelle session créée.
- **Type** : cas d'échec / sécurité · **Statut** : ✅ (API : `401 INVALID_EMAIL_OR_PASSWORD` ; testé manuellement par Aymeric)

## TST-AUT-004 — Inscription avec un e-mail déjà utilisé

- **Description** : un visiteur tente de créer un compte avec un e-mail déjà enregistré.
- **Objectif** : vérifier le rejet propre du doublon, sans dupliquer d'utilisateur.
- **Préconditions** : un compte existe déjà avec cet e-mail.
- **Étapes** : 1) Aller sur `/register`. 2) Renseigner un e-mail déjà utilisé. 3) Soumettre.
- **Résultat attendu** : erreur affichée sous le champ e-mail : « Un compte existe déjà avec cette adresse e-mail. »
- **Critères d'acceptation** : aucune nouvelle ligne `User` créée ; nom et e-mail saisis restent affichés (pas le mot de passe).
- **Type** : cas d'échec · **Statut** : ✅ (API : `422 USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` ; testé manuellement par Aymeric)

## TST-AUT-005 — Champ requis manquant (inscription ou connexion)

- **Description** : un champ obligatoire (nom, e-mail ou mot de passe) est laissé vide ou invalide.
- **Objectif** : vérifier la validation Zod côté serveur et l'affichage de l'erreur au bon champ.
- **Préconditions** : aucune.
- **Étapes** : 1) Aller sur `/register` ou `/login`. 2) Laisser un champ vide ou saisir un e-mail invalide. 3) Soumettre.
- **Résultat attendu** : erreur affichée sous le champ concerné, reliée via `aria-describedby`.
- **Critères d'acceptation** : aucun appel à Better Auth déclenché (rejet avant l'appel `auth.api.*`) ; formulaire non soumis en base.
- **Type** : cas d'échec · **Statut** : ✅ (testé manuellement par Aymeric)

## TST-AUT-006 — Accès à /login ou /register avec une session active

- **Description** : un utilisateur déjà connecté visite directement `/login` ou `/register`.
- **Objectif** : vérifier qu'on ne présente pas de formulaire d'auth à un utilisateur déjà authentifié.
- **Préconditions** : une session valide est active.
- **Étapes** : 1) Se connecter. 2) Naviguer directement vers `/login` (ou `/register`).
- **Résultat attendu** : redirection immédiate vers `/`.
- **Critères d'acceptation** : redirection HTTP 307, aucun contenu du formulaire renvoyé.
- **Type** : fonctionnel · **Statut** : ✅ (vérifié via curl avec cookie de session : `307` → `location: /`)

## TST-AUT-007 — Champs conservés après une erreur (non-régression)

- **Description** : après une erreur de soumission (mauvais mot de passe, e-mail déjà pris, champ manquant), le formulaire ne doit pas se vider entièrement.
- **Objectif** : garantir que nom/e-mail restent saisis, et que le mot de passe est systématiquement vidé (jamais ré-affiché).
- **Préconditions** : aucune.
- **Étapes** : 1) Remplir le formulaire. 2) Provoquer une erreur (ex. mauvais mot de passe). 3) Observer les champs après le retour d'erreur.
- **Résultat attendu** : nom et e-mail affichent toujours la valeur saisie ; le champ mot de passe est vide.
- **Critères d'acceptation** : couvert par un test de non-régression automatisé (`login-form.test.tsx`) + validé manuellement par Aymeric.
- **Type** : cas d'échec / régression · **Statut** : ✅ — cf. `plan-correction-bogues.md` BUG-001

## TST-SEC-001 — Le mot de passe n'est jamais stocké en clair

- **Description** : vérifier qu'aucun mot de passe utilisateur n'apparaît en clair en base de données.
- **Objectif** : garde-fou OWASP A02 (Cryptographic Failures).
- **Préconditions** : au moins un compte créé.
- **Étapes** : 1) Créer un compte. 2) Inspecter la table `account` en base (`psql`).
- **Résultat attendu** : la colonne `password` contient un hash au format `salt:hash` (scrypt), jamais la valeur saisie.
- **Critères d'acceptation** : aucune occurrence du mot de passe en clair dans `account.password` ni dans les logs serveur.
- **Type** : sécurité · **Statut** : ✅ (vérifié via `psql` après `TST-AUT-001`)

## TST-MND-001 — Création d'un monde avec un nom valide

- **Description** : un utilisateur connecté crée un nouveau monde.
- **Objectif** : vérifier la création du monde, l'appartenance au bon propriétaire et la dérivation automatique du slug.
- **Préconditions** : une session valide est active.
- **Étapes** : 1) Aller sur `/worlds`. 2) Renseigner un nom dans « Nouveau monde ». 3) Soumettre.
- **Résultat attendu** : le monde apparaît dans la liste, redirection vers `/worlds/<slug>`.
- **Critères d'acceptation** : `World.ownerId` = l'utilisateur courant ; `World.slug` dérivé du nom (minuscules, sans accents, tirets).
- **Type** : fonctionnel · **Statut** : ✅ (vérifié via `world-service.ts` en conditions réelles : création + apparition dans `GET /worlds`)

## TST-MND-002 — Création d'un monde avec un nom déjà utilisé par le même propriétaire

- **Description** : un utilisateur crée un second monde dont le nom produit le même slug qu'un monde existant.
- **Objectif** : vérifier qu'aucune collision de slug ne se produit (contrainte `@@unique([ownerId, slug])`).
- **Préconditions** : un monde existe déjà pour ce propriétaire avec ce nom.
- **Étapes** : 1) Créer un monde « Eldoria ». 2) Créer un second monde « Eldoria ».
- **Résultat attendu** : les deux mondes coexistent, le second reçoit un slug suffixé (`eldoria-2`).
- **Critères d'acceptation** : aucune erreur de contrainte unique remontée à l'utilisateur ; les deux mondes restent distincts et accessibles.
- **Type** : fonctionnel · **Statut** : ✅ (vérifié en conditions réelles : `eldoria` puis `eldoria-2`)

## TST-MND-003 — Création d'un monde avec un nom vide

- **Description** : un utilisateur soumet le formulaire de création sans renseigner de nom.
- **Objectif** : vérifier le rejet côté serveur (Zod) avant tout appel au service.
- **Préconditions** : aucune.
- **Étapes** : 1) Aller sur `/worlds`. 2) Laisser le champ nom vide. 3) Soumettre.
- **Résultat attendu** : erreur affichée sous le champ, reliée via `aria-describedby` : « Le nom est requis. »
- **Critères d'acceptation** : aucun `World` créé en base.
- **Type** : cas d'échec · **Statut** : ✅ (couvert par `world-schemas.test.ts` + `create-world-form.test.tsx`)

## TST-MND-004 — Renommer un monde

- **Description** : le propriétaire d'un monde modifie son nom depuis la page « Paramètres ».
- **Objectif** : vérifier que le nom et le slug sont mis à jour, sans casser l'appartenance.
- **Préconditions** : un monde existe pour ce propriétaire.
- **Étapes** : 1) Aller sur `/worlds/<slug>`. 2) Modifier le nom dans « Renommer ». 3) Soumettre.
- **Résultat attendu** : redirection vers la nouvelle URL `/worlds/<nouveau-slug>`, nom mis à jour dans la liste.
- **Critères d'acceptation** : le renommage vers le slug déjà occupé par le monde lui-même ne déclenche pas de suffixe inutile.
- **Type** : fonctionnel · **Statut** : ✅ (vérifié en conditions réelles + `world-service.test.ts`)

## TST-MND-005 — Suppression d'un monde

- **Description** : le propriétaire supprime un monde après une confirmation en deux étapes.
- **Objectif** : vérifier que la suppression est bien confirmée avant d'être irréversible, et entièrement au clavier.
- **Préconditions** : un monde existe pour ce propriétaire.
- **Étapes** : 1) Aller sur `/worlds/<slug>`. 2) Cliquer « Supprimer ce monde ». 3) Confirmer.
- **Résultat attendu** : le monde disparaît de la liste, redirection vers `/worlds`.
- **Critères d'acceptation** : navigable sans souris (boutons natifs, pas de `window.confirm` bloquant) ; un clic sur « Annuler » n'entraîne aucune suppression.
- **Type** : fonctionnel · **Statut** : ✅ (vérifié en conditions réelles : `deleteWorld` + `listWorlds` après suppression)

## TST-SEC-002 — Accès à un monde d'autrui via URL directe

- **Description** : un utilisateur connecté saisit directement l'URL `/worlds/<slug>` d'un monde qui ne lui appartient pas.
- **Objectif** : vérifier l'autorisation en couche service (OWASP A01) et l'absence de fuite d'existence.
- **Préconditions** : deux comptes existent ; le monde ciblé appartient au second compte.
- **Étapes** : 1) Se connecter avec le premier compte. 2) Naviguer vers l'URL du monde du second compte.
- **Résultat attendu** : page 404 (`notFound()`), identique à celle d'un monde réellement inexistant.
- **Critères d'acceptation** : aucune information ne permet de distinguer « monde inexistant » de « monde d'autrui » ; `getWorldBySlug` filtre systématiquement sur `ownerId`.
- **Type** : sécurité · **Statut** : ✅ (vérifié en conditions réelles : deux comptes créés via l'API Better Auth, `GET /worlds/<slug-d-autrui>` → `404`)

# Cahier de recettes — C2.3.1 (ÉLIMINATOIRE)

> Scénarios dérivés des user stories MoSCoW du Bloc 1. Nomenclature `TST-<CAT>-<NNN>`
> (AUT/MND/ENT/LNK/GRF/SEC/QOT). 6 champs par scénario (Description, Objectif,
> Préconditions, Étapes, Résultat attendu, Critères d'acceptation). Cas passants ET
> cas d'échec. Statut : ⬜ à faire / ✅ OK / ❌ KO (→ `plan-correction-bogues.md`).
>
> État au 2026-07-11 : premiers scénarios **AUT** (authentification) et **SEC**,
> exécutés manuellement (Aymeric) et via l'API Better Auth (curl) — pas encore
> exécutés sur staging (pas de staging à ce stade). Autres catégories (MND/ENT/LNK/
> GRF/QOT) : pas encore de scénario, les features correspondantes n'existent pas.

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

<!-- TODO : scénarios MND (mondes), ENT (entités/éditeur), LNK (liaison auto/backlinks),
GRF (graphe), QOT (quotas freemium) — features pas encore construites. -->

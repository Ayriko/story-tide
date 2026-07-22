# Cahier de recettes — C2.3.1 (ÉLIMINATOIRE)

> Scénarios dérivés des user stories MoSCoW du Bloc 1. Nomenclature `TST-<CAT>-<NNN>`
> (AUT/MND/ENT/LNK/GRF/SEC/QOT). 6 champs par scénario (Description, Objectif,
> Préconditions, Étapes, Résultat attendu, Critères d'acceptation). Cas passants ET
> cas d'échec. Statut : ⬜ à faire / ✅ OK / ❌ KO (→ `plan-correction-bogues.md`).
>
> État au 2026-07-19 : scénarios **AUT**, **SEC**, **MND** (mondes), **ENT**
> (entités), **LNK** (liaison/graphe), **GRF** (graphe) et **QOT** (quotas
> freemium, KAN-18) exécutés en conditions réelles (base Postgres réelle,
> comptes réels via l'API Better Auth) — pas encore exécutés sur staging au
> sens recette officielle (staging existe depuis KAN-10, la recette staging
> planifiée se tient du 20 au 23/07). `TST-QOT-003` (exemption du monde
> d'introduction) reste vérifié uniquement par test unitaire tant que KAN-35
> (le monde d'introduction lui-même) n'est pas construit.

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

## TST-AUT-008 — Déconnexion

- **Description** : un utilisateur connecté clique sur « Se déconnecter » dans le header de l'application (`logoutAction`, `src/actions/auth.ts`).
- **Objectif** : vérifier que la session est effacée (cookie + enregistrement en base) et que l'accès aux pages `(app)` redevient impossible sans se reconnecter.
- **Préconditions** : une session valide est active, une page du groupe `(app)` (ex. `/worlds`) est affichée.
- **Étapes** : 1) Cliquer sur « Se déconnecter ». 2) Observer la redirection. 3) Tenter de naviguer directement vers `/worlds`.
- **Résultat attendu** : redirection vers `/login` ; une nouvelle tentative d'accès à `/worlds` redirige aussi vers `/login` (session bien effacée, pas seulement un état client). Cas d'échec (garde) : si `signOut` échoue côté serveur (ex. session déjà expirée), l'utilisateur est quand même redirigé vers `/login` (jamais bloqué sur une action qui échoue silencieusement).
- **Critères d'acceptation** : couvert par `auth.test.ts` (`logoutAction` : appelle `signOut` puis redirige ; redirige aussi si `signOut` rejette, avec l'erreur réelle logguée) ; bouton natif (`<button type="submit">` dans un `<form>`), navigable au clavier, focus visible cohérent avec le reste du header (RGAA).
- **Type** : fonctionnel + sécurité (OWASP A07) · **Statut** : ✅ (`auth.test.ts`)

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

## TST-MND-006 — Dashboard de monde : dernières entrées, panneau Constellation, actions rapides (KAN-36 P3)

- **Description** : la page d'accueil d'un monde (`/worlds/[slug]`) affiche les fiches (entrées) les plus récemment modifiées, un panneau Constellation permanent (aperçu du même graphe que `/worlds/[slug]/graph`), des chips d'action rapide (« Nouvelle entrée », « Rechercher ») et des compteurs (entrées par catégorie, dernière modification).
- **Objectif** : vérifier que l'ordre des dernières entrées suit bien la date de modification (pas de création), que le panneau Constellation reflète les entités/relations réelles avec un accès « Explorer la constellation » vers la vue complète, et que les actions rapides fonctionnent sans dupliquer de logique existante.
- **Préconditions** : un monde contient plusieurs entrées, dont certaines modifiées après leur création (ordre `createdAt` et `updatedAt` divergents).
- **Étapes** : 1) Ouvrir `/worlds/[slug]`. 2) Modifier une entrée ancienne puis revenir à l'accueil. 3) Vérifier son rang dans « Dernières entrées ». 4) Cliquer « Explorer la constellation » sur le panneau. 5) Cliquer la chip « Nouvelle entrée », puis « Rechercher ».
- **Résultat attendu** : l'entrée modifiée remonte en tête de « Dernières entrées » (tri `updatedAt` décroissant) ; « Explorer la constellation » navigue vers `/worlds/[slug]/graph` (filtres + liste accessible complets) ; « Nouvelle entrée » ouvre le Dialog de création ; « Rechercher » déplie la sidebar si repliée et place le focus dans son champ de recherche existant.
- **Critères d'acceptation** : tri de lecture uniquement, aucun service modifié (`listEntities` reste trié par `createdAt`, inchangé pour la sidebar/la Constellation) ; le panneau miniature n'expose aucun filtre clavier dupliqué (l'équivalent accessible complet reste sur `/graph`) ; vérifié en conditions réelles (`e2e/smoke.spec.ts`, `e2e/graph.spec.ts`, `e2e/entity-search.spec.ts` — parcours passant par `/worlds/[slug]` inchangés après l'ajout du dashboard) + vérification manuelle Aymeric.
- **Type** : fonctionnel · **Statut** : ✅ (gates automatisés : lint, `tsc`, 310/310 tests unitaires à 98,74 % de couverture, build, 9/9 e2e) — vérification manuelle Aymeric en attente.

## TST-MND-007 — Dashboard de monde : monde sans entrée (état vide)

- **Description** : un monde nouvellement créé, sans aucune fiche (entrée), affiche son dashboard.
- **Objectif** : vérifier qu'aucune erreur ne survient et qu'un état vide explicite est affiché plutôt qu'une liste ou une Constellation silencieusement absente.
- **Préconditions** : un monde vient d'être créé, aucune entrée n'existe encore.
- **Étapes** : 1) Créer un monde. 2) Observer sa page d'accueil sans créer d'entrée.
- **Résultat attendu** : « Dernières entrées » affiche « Aucune entrée pour le moment. » ; le panneau Constellation se monte sans erreur (0 nœud, 0 arête) ; les compteurs par catégorie n'affichent que celles ayant au moins une entrée (aucune ligne à 0) ; aucune ligne « Dernière modification » (aucune date disponible).
- **Critères d'acceptation** : pas d'exception serveur ni client sur un tableau d'entités vide (`buildGraphElements([], [])`, déjà couvert par `graph-elements.test.ts`) ; vérification manuelle Aymeric.
- **Type** : fonctionnel (cas limite) · **Statut** : ✅ (couvert par construction : mêmes fonctions que TST-MND-006 sur un tableau vide, `graph-elements.test.ts`) — vérification manuelle Aymeric en attente.

## TST-MND-008 — Sidebar à jour après une création d'entrée depuis le dashboard (BUG-004)

- **Description** : créer une entrée via le bouton « Nouvelle entrée » **du dashboard** (`/worlds/[slug]`), puis revenir au dashboard depuis la fiche créée — la Sidebar doit refléter la nouvelle entrée sans rechargement manuel, au même titre qu'une création lancée depuis la Sidebar elle-même.
- **Objectif** : vérifier que la Sidebar (`entity-search.tsx`, portée par `(app)/worlds/[slug]/layout.tsx`) affiche toujours la liste à jour quel que soit le déclencheur du Dialog de création, sans copie d'état qui pourrait figer ; vérifier aussi que l'état plié/déplié des groupes et la recherche active ne régressent pas.
- **Préconditions** : un monde existe, avec ou sans entrées.
- **Étapes** : 1) Ouvrir `/worlds/[slug]`. 2) Créer une entrée via « Nouvelle entrée » du dashboard, revenir au dashboard (clic sur le nom du monde). 3) Créer une seconde entrée via le bouton de la Sidebar, revenir au dashboard. 4) Replier un groupe de la Sidebar, créer une troisième entrée, revenir au dashboard. 5) Lancer une recherche puis l'effacer.
- **Résultat attendu** : les trois entrées apparaissent dans la Sidebar dès le retour au dashboard, sans rechargement de page (`F5`) ; le groupe replié à l'étape 4 reste replié après la création ; la recherche filtre correctement puis, une fois effacée, réaffiche la liste complète à jour.
- **Critères d'acceptation** : cause réelle prouvée par log (pas par hypothèse) — `entity-search.tsx:36` copiait `initialEntities` dans un `useState` au premier montage, jamais resynchronisé ; corrigé par dérivation directe des props hors recherche active (`const results = isSearching ? (searchResults ?? []) : initialEntities`). Vérifié en conditions réelles bout en bout (`e2e/dashboard-create-entity.spec.ts` : création dashboard **et** sidebar, repli de groupe conservé, recherche active puis effacée) ; `e2e/entity-search.spec.ts` existant (champ vide réaffiche la liste initiale) inchangé et toujours vert ; vérification manuelle Aymeric sur staging (bug initialement détecté là ; deux tentatives serveur précédentes s'étaient révélées sans effet au retest, cf. `docs/plan-correction-bogues.md` BUG-004).
- **Type** : fonctionnel · **Statut** : ✅ gates automatisés (lint, `tsc`, 341/341 tests, coverage, 10/10 e2e, build) — vérification manuelle Aymeric en attente (retest sur staging après déploiement du correctif v3).

## TST-SEC-002 — Accès à un monde d'autrui via URL directe

- **Description** : un utilisateur connecté saisit directement l'URL `/worlds/<slug>` d'un monde qui ne lui appartient pas.
- **Objectif** : vérifier l'autorisation en couche service (OWASP A01) et l'absence de fuite d'existence.
- **Préconditions** : deux comptes existent ; le monde ciblé appartient au second compte.
- **Étapes** : 1) Se connecter avec le premier compte. 2) Naviguer vers l'URL du monde du second compte.
- **Résultat attendu** : page 404 (`notFound()`), identique à celle d'un monde réellement inexistant.
- **Critères d'acceptation** : aucune information ne permet de distinguer « monde inexistant » de « monde d'autrui » ; `getWorldBySlug` filtre systématiquement sur `ownerId`.
- **Type** : sécurité · **Statut** : ✅ (vérifié en conditions réelles : deux comptes créés via l'API Better Auth, `GET /worlds/<slug-d-autrui>` → `404`)

## TST-ENT-001 — Création d'une entrée avec type et alias

- **Description** : le propriétaire d'un monde crée une fiche (entrée) — personnage, lieu, faction, objet ou événement — avec des alias.
- **Objectif** : vérifier la création, le type libre (donnée, pas schéma) et le nettoyage des alias.
- **Préconditions** : un monde existe pour ce propriétaire.
- **Étapes** : 1) Aller sur `/worlds/<slug>`. 2) Renseigner nom, type, alias (un par ligne) dans « Nouvelle entrée ». 3) Soumettre.
- **Résultat attendu** : redirection vers `/worlds/<slug>/entities/<id>`, entrée visible dans la liste avec son type.
- **Critères d'acceptation** : `Entity.worldId` correct ; alias vidés des doublons/entrées vides ; `content`/`plainText` initialisés vides (éditeur pas encore branché).
- **Type** : fonctionnel · **Statut** : ✅ (vérifié en conditions réelles : `entity-service.ts` + `GET /worlds/<slug>` et `GET /worlds/<slug>/entities/<id>`)

## TST-ENT-002 — Modification du nom, du type et des alias d'une entrée

- **Description** : le propriétaire modifie une fiche (entrée) existante depuis le dialog « Paramètres de l'entrée » (KAN-36 P2 — remplace l'ancienne page « Paramètres »).
- **Objectif** : vérifier la mise à jour complète (nom, type, alias) sans casser l'appartenance au monde.
- **Préconditions** : une entrée existe dans un monde de ce propriétaire.
- **Étapes** : 1) Aller sur `/worlds/<slug>/entities/<id>`. 2) Ouvrir « Paramètres de l'entrée » (icône engrenage) et modifier nom/type/alias. 3) Cliquer « Enregistrer ».
- **Résultat attendu** : le dialog reste ouvert le temps de la soumission, puis les valeurs mises à jour s'affichent (nom/badge de type/alias du header).
- **Critères d'acceptation** : les trois champs sont bien persistés ; `worldId` inchangé.
- **Type** : fonctionnel · **Statut** : ✅ (vérifié en conditions réelles)

## TST-ENT-003 — Création d'une entrée avec un nom vide ou un type inconnu

- **Description** : un utilisateur soumet le formulaire de création sans nom, ou avec un type hors liste.
- **Objectif** : vérifier le rejet côté serveur (Zod) avant tout appel au service.
- **Préconditions** : aucune.
- **Étapes** : 1) Aller sur `/worlds/<slug>`. 2) Laisser le nom vide (ou forcer un type invalide). 3) Soumettre.
- **Résultat attendu** : erreur affichée sous le champ concerné, reliée via `aria-describedby`.
- **Critères d'acceptation** : aucune `Entity` créée en base.
- **Type** : cas d'échec · **Statut** : ✅ (couvert par `entity-schemas.test.ts` + `create-entity-form.test.tsx`)

## TST-ENT-004 — Suppression d'une entrée

- **Description** : le propriétaire supprime une fiche (entrée) après confirmation en deux étapes, depuis la « Zone de danger » du dialog « Paramètres de l'entrée » (KAN-36 P2).
- **Objectif** : vérifier la confirmation avant suppression irréversible, entièrement au clavier.
- **Préconditions** : une entrée existe dans un monde de ce propriétaire.
- **Étapes** : 1) Aller sur `/worlds/<slug>/entities/<id>`. 2) Ouvrir « Paramètres de l'entrée », cliquer « Supprimer cette entrée » dans la Zone de danger. 3) Confirmer.
- **Résultat attendu** : l'entrée disparaît de la liste, redirection vers `/worlds/<slug>`.
- **Critères d'acceptation** : navigable sans souris ; « Annuler » n'entraîne aucune suppression.
- **Type** : fonctionnel · **Statut** : ✅ (vérifié en conditions réelles : `deleteEntity` + `listEntities` après suppression)

## TST-SEC-003 — Accès à une entrée via un monde qui ne vous appartient pas ou un mauvais monde

- **Description** : un utilisateur connecté tente d'atteindre l'URL `/worlds/<slug-d-autrui>/entities/<id>` d'une fiche (entrée) appartenant à un monde qu'il ne possède pas.
- **Objectif** : vérifier que l'autorisation en cascade (monde → entrée) ne fuit aucune existence, y compris quand l'`entityId` est valide.
- **Préconditions** : deux comptes existent, chacun avec son propre monde ; une entrée existe dans le monde du premier compte.
- **Étapes** : 1) Se connecter avec le second compte. 2) Naviguer vers l'URL de l'entrée du premier compte.
- **Résultat attendu** : page 404, identique à une entrée réellement inexistante.
- **Critères d'acceptation** : `entity-service.ts` vérifie systématiquement l'appartenance du monde (`getWorld`) avant de chercher l'entrée ; un `worldId` correct mais non possédé par l'appelant lève `WorldNotFoundError`, jamais `EntityNotFoundError` (pas de distinction exploitable).
- **Type** : sécurité · **Statut** : ✅ (vérifié en conditions réelles : deux comptes, `GET /worlds/<slug-d-autrui>/entities/<id>` → `404` ; cas mauvais `worldId` du même propriétaire testé au service)

## TST-ENT-005 — Édition du contenu d'une entrée avec sauvegarde automatique

- **Description** : le propriétaire écrit dans l'éditeur d'une fiche (entrée) — titres, gras/italique, listes, citation, lien, image — et le contenu se sauvegarde seul.
- **Objectif** : vérifier la sauvegarde debouncée, l'extraction du texte brut et l'indicateur d'état accessible.
- **Préconditions** : une entrée existe dans un monde de ce propriétaire.
- **Étapes** : 1) Aller sur `/worlds/<slug>/entities/<id>`. 2) Écrire du contenu dans l'éditeur. 3) Attendre la fin du debounce.
- **Résultat attendu** : `Entity.content` (JSON ProseMirror) et `Entity.plainText` (texte extrait) mis à jour en base ; indicateur « Enregistré. » annoncé via `aria-live="polite"`.
- **Critères d'acceptation** : le contenu est rechargé correctement à la prochaine visite de la page ; `plainText` ne contient aucune balise, uniquement le texte.
- **Type** : fonctionnel · **Statut** : ✅ (vérifié en conditions réelles : round-trip complet titre+gras+citation → validation → extraction → persistance → relecture)

## TST-ENT-006 — Parcours bout en bout : inscription → monde → entrée → éditeur → rechargement

- **Description** : un nouvel utilisateur s'inscrit, crée un monde, crée une fiche (entrée), écrit dans l'éditeur en le mettant en forme, puis recharge la page — smoke Playwright (`e2e/smoke.spec.ts`) sur un vrai navigateur, isolé sur une base Postgres dédiée (`story_tide_e2e`, remise à zéro avant chaque exécution).
- **Objectif** : couvrir en une seule fois trois classes de bugs invisibles à un test unitaire ou un script `curl`/`tsx` : React StrictMode (montage/démontage de l'éditeur en dev), sérialisation Next.js Flight (le contenu Tiptap traverse la frontière RSC → Client au rechargement), Tailwind Preflight (styles de contenu riche).
- **Préconditions** : conteneur Postgres dev démarré (`docker-compose.dev.yml`) ; `.env.e2e` configuré (copie de `.env.e2e.example`).
- **Étapes** : 1) `/register`, créer un compte (auto-connexion). 2) Créer un monde. 3) Créer une entrée. 4) Écrire du texte dans l'éditeur, le sélectionner, cliquer « Gras ». 5) Attendre l'indicateur « Enregistré. ». 6) Recharger la page.
- **Résultat attendu** : à chaque étape, redirection vers la bonne URL ; le bouton « Gras » reflète `aria-pressed="true"` immédiatement après le clic (synchro toolbar `useEditorState`) ; après rechargement, le texte tapé est toujours visible dans l'éditeur (persistance à travers la frontière RSC → Client).
- **Critères d'acceptation** : `npm run test:e2e` vert ; la base de dev (`story_tide`) reste inchangée pendant et après l'exécution (vérifié par comptage de lignes avant/après) ; la base e2e est repartie de zéro à chaque run (pas d'accumulation de données entre exécutions).
- **Type** : fonctionnel (bout en bout) · **Statut** : ✅ (`e2e/smoke.spec.ts`, vérifié en conditions réelles contre un vrai navigateur Chromium et une vraie base Postgres)

## TST-ENT-007 — Recherche basique par nom et par alias (KAN-17)

- **Description** : dans la page d'un monde, un champ de recherche filtre en direct la liste des fiches (entrées) par nom ou par alias, insensible à la casse et aux accents.
- **Objectif** : vérifier que la recherche trouve une entrée par son nom même avec une casse différente, trouve une entrée par un alias qui ne correspond pas à son nom, et que la recherche reste scopée au monde courant (patron d'autorisation `getWorld`).
- **Préconditions** : un monde contient au moins deux entrées, l'une avec un alias distinct de son nom.
- **Étapes** : 1) Ouvrir la page du monde. 2) Saisir le nom d'une entrée (casse différente) dans le champ « Rechercher une entrée ». 3) Effacer et saisir l'alias d'une autre entrée.
- **Résultat attendu** : à l'étape 2, seule l'entrée dont le nom correspond apparaît ; à l'étape 3, seule l'entrée dont l'alias correspond apparaît (par l'entrée dont le nom ne correspond pas).
- **Critères d'acceptation** : `searchEntities` (`entity-service.test.ts`) couvre nom/alias/casse/accents ; `e2e/entity-search.spec.ts` vérifié en conditions réelles (vrai navigateur, debounce, Server Action).
- **Type** : fonctionnel · **Statut** : ⬜ à faire (exécuté sur staging)

## TST-ENT-008 — Recherche sans correspondance et scope par monde (KAN-17)

- **Description** : une recherche qui ne correspond à aucune fiche (entrée) du monde courant.
- **Objectif** : vérifier l'état vide explicite (pas un tableau vide silencieux côté UI) et que la recherche ne remonte jamais une entrée d'un autre monde.
- **Préconditions** : un monde avec au moins une entrée.
- **Étapes** : 1) Saisir une requête ne correspondant à aucune entrée. 2) Vérifier que le message « Aucune entité trouvée. » s'affiche.
- **Résultat attendu** : message d'état vide explicite ; aucune entrée d'un autre monde ne peut jamais apparaître (la cascade d'autorisation `getWorld` revalide le `worldId` à chaque appel, `WorldNotFoundError` sinon — même garde-fou que le reste des fonctions de `entity-service.ts`, OWASP A01).
- **Critères d'acceptation** : `searchEntities` renvoie `[]` sans erreur ; `e2e/entity-search.spec.ts` vérifie l'affichage du message vide.
- **Type** : fonctionnel · **Statut** : ⬜ à faire (exécuté sur staging)

## TST-ENT-009 — Sélecteur de type cherchable et groupé (KAN-18)

- **Description** : à la création/modification d'une fiche (entrée), le champ Type est un combobox cherchable (26 types répartis en 8 familles) plutôt qu'un `<select>` plat — filtrage au fil de la frappe, groupes visibles, navigation clavier complète.
- **Objectif** : vérifier que les 5 types historiques restent sélectionnables à l'identique, que la recherche filtre correctement par libellé, et que le clavier (flèches, Entrée, Échap) permet une sélection complète sans souris.
- **Préconditions** : aucune (page de création d'entrée).
- **Étapes** : 1) Ouvrir le combobox Type. 2) Taper un fragment de libellé (ex. « arme »). 3) Sélectionner un résultat au clavier (flèches + Entrée).
- **Résultat attendu** : la liste affiche les types groupés par famille (8 en-têtes) ; la frappe filtre en direct ; le type sélectionné apparaît dans le champ et est bien celui soumis au formulaire ; `Échap` ferme la liste sans changer la sélection.
- **Critères d'acceptation** : `entity-type-combobox.test.tsx` (filtrage, sélection souris/clavier, état vide « Aucun type trouvé. », `Échap`, retour au dernier type valide au blur) ; `entity-schemas.test.ts` (26 types, 8 groupes, 5 ids historiques conservés) ; vérifié en conditions réelles dans `e2e/graph.spec.ts` (création d'une entrée de type « Lieu » via le combobox).
- **Type** : fonctionnel + accessibilité (clavier complet, RGAA) · **Statut** : ✅ (`entity-type-combobox.test.tsx`, `entity-schemas.test.ts`, `e2e/graph.spec.ts`)

## TST-SEC-004 — Rejet d'un contenu hors du schéma strict de l'éditeur

- **Description** : une requête de sauvegarde envoie un JSON contenant un node désactivé (ex. `codeBlock`) ou structurellement invalide, en contournant l'éditeur réel.
- **Objectif** : vérifier que la validation serveur (pas seulement la configuration du client Tiptap) applique le schéma strict — OWASP A03.
- **Préconditions** : une entrée existe dans un monde de ce propriétaire.
- **Étapes** : 1) Appeler l'action de sauvegarde avec un JSON contenant un `codeBlock` (désactivé) ou un type de node inconnu.
- **Résultat attendu** : la sauvegarde est refusée (« Contenu invalide. »), rien n'est persisté.
- **Critères d'acceptation** : `parseContent()` lève `InvalidContentError` pour tout node/mark hors de l'allowlist (`Node.fromJSON` + `check()` contre le schéma ProseMirror réel) ; testé avec un payload `codeBlock` réel, pas seulement une chaîne de caractères.
- **Type** : sécurité · **Statut** : ✅ (`tiptap-content.test.ts`, `entity-content.test.ts`, vérifié en conditions réelles avec un payload malveillant)

## TST-SEC-005 — Rejet d'un contenu d'entrée surdimensionné (mitigation DoS)

- **Description** : une requête de sauvegarde envoie une chaîne JSON de plus de 1 Mo.
- **Objectif** : vérifier que la taille est bornée **avant** tout `JSON.parse`, pas seulement après validation du contenu (OWASP A04).
- **Préconditions** : une entrée existe dans un monde de ce propriétaire.
- **Étapes** : 1) Appeler `saveEntityContentAction` avec une chaîne JSON de plus de 1 000 000 octets.
- **Résultat attendu** : rejet immédiat (« Contenu trop volumineux. »), sans tentative de `JSON.parse` ni appel au service de persistance.
- **Critères d'acceptation** : `Buffer.byteLength(rawContentJson, "utf8")` vérifié avant tout `JSON.parse` ; aucun appel à `updateEntityContent`.
- **Type** : sécurité · **Statut** : ✅ (`entity-content.test.ts`)

## TST-SEC-006 — Rejet d'une image dont le `src` n'est pas une URL http(s)

- **Description** : une requête de sauvegarde envoie un contenu structurellement valide mais dont un node `image` porte un `src` en `javascript:`, `data:`, ou une chaîne qui n'est pas une URL.
- **Objectif** : vérifier que les valeurs d'attributs sont aussi validées côté serveur, pas seulement la structure (OWASP A03) — un contenu peut passer `Node.fromJSON`/`check()` et rester dangereux.
- **Préconditions** : une entrée existe dans un monde de ce propriétaire.
- **Étapes** : 1) Appeler l'action de sauvegarde avec un `image.src` en `javascript:alert(1)` (ou `data:`, ou une chaîne non-URL).
- **Résultat attendu** : la sauvegarde est refusée (« Contenu invalide. »), rien n'est persisté.
- **Critères d'acceptation** : `parseContent()` lève `InvalidContentError` via `assertSafeAttributes`/`isSafeHttpUrl` pour tout `src` dont le protocole n'est pas `http:`/`https:`, ou qui n'est pas une URL syntaxiquement valide.
- **Type** : sécurité · **Statut** : ✅ (`tiptap-content.test.ts`)

## TST-SEC-007 — Rejet d'une image sans texte alternatif (contournement RGAA)

- **Description** : une requête de sauvegarde envoie un node `image` avec un `alt` vide, en contournant le champ obligatoire de l'UI.
- **Objectif** : vérifier que l'exigence RGAA de texte alternatif est aussi imposée côté serveur, pas seulement côté formulaire.
- **Préconditions** : une entrée existe dans un monde de ce propriétaire.
- **Étapes** : 1) Appeler l'action de sauvegarde avec un node `image` dont `attrs.alt` est une chaîne vide.
- **Résultat attendu** : la sauvegarde est refusée (« Contenu invalide. »), rien n'est persisté.
- **Critères d'acceptation** : `parseContent()` lève `InvalidContentError` si `alt` est absent, non-chaîne, ou vide après `trim()`.
- **Type** : sécurité / accessibilité · **Statut** : ✅ (`tiptap-content.test.ts`)

## TST-SEC-008 — Rejet d'un lien dont le `href` n'est pas une URL http(s)

- **Description** : une requête de sauvegarde envoie un mark `link` avec un `href` en `javascript:`.
- **Objectif** : vérifier que la même règle de validation d'URL s'applique au mark `link`, pas seulement au node `image`.
- **Préconditions** : une entrée existe dans un monde de ce propriétaire.
- **Étapes** : 1) Appeler l'action de sauvegarde avec un mark `link` dont `attrs.href` est `javascript:alert(1)`.
- **Résultat attendu** : la sauvegarde est refusée (« Contenu invalide. »), rien n'est persisté.
- **Critères d'acceptation** : `parseContent()` lève `InvalidContentError` pour tout `href` dont le protocole n'est pas `http:`/`https:`.
- **Type** : sécurité · **Statut** : ✅ (`tiptap-content.test.ts`)

## TST-SEC-009 — Redirection HTTP→HTTPS et certificat TLS valide (KAN-10)

- **Description** : une requête HTTP simple (port 80) est envoyée à `staging.storytide.fr` puis à `storytide.fr`.
- **Objectif** : vérifier que Traefik redirige systématiquement vers HTTPS et sert un certificat Let's Encrypt valide (pas d'avertissement navigateur, pas de certificat auto-signé).
- **Préconditions** : Traefik démarré sur le VPS, résolveur Let's Encrypt basculé en production (endpoint prod, après validation sur l'endpoint staging LE), DNS `storytide.fr`/`staging.storytide.fr` résolus vers le VPS.
- **Étapes** : 1) `curl -I http://storytide.fr` (et `staging.`). 2) `curl -vI https://storytide.fr` (et `staging.`).
- **Résultat attendu** : l'appel HTTP répond `301`/`308` vers `https://` ; l'appel HTTPS répond `200` avec un certificat émis par Let's Encrypt, chaîne de confiance valide.
- **Critères d'acceptation** : `deploy/traefik/traefik.yml` — `entryPoints.web.http.redirections` vers `websecure` ; `certificatesResolvers.le.acme.caServer` pointe l'endpoint **prod** (pas staging LE) au moment du test.
- **Type** : sécurité · **Statut** : ✅ Validé le 18-07-2026 (exécuté sur prod & staging: v1.0.1)

## TST-SEC-010 — En-têtes de sécurité présents sur les réponses de l'app (KAN-10)

- **Description** : les réponses HTTP de l'app en staging/prod portent les en-têtes de sécurité configurés au niveau Traefik.
- **Objectif** : vérifier que `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options` et `Referrer-Policy` sont bien présents (OWASP A05).
- **Préconditions** : Traefik + app démarrés, middleware `secure-headers` attaché au routeur de l'app.
- **Étapes** : 1) `curl -sI https://staging.storytide.fr` (ou `storytide.fr`).
- **Résultat attendu** : les 4 en-têtes sont présents dans la réponse, avec les valeurs attendues (`Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`).
- **Critères d'acceptation** : `deploy/traefik/dynamic/middlewares.yml` (`secure-headers`) référencé par les labels Traefik de `deploy/compose.prod.yml`/`compose.staging.yml`.
- **Type** : sécurité · **Statut** : ✅ Validé le 18-07-2026 (exécuté sur staging: v1.0.0-rc.2)

## TST-SEC-011 — PostgreSQL et MinIO injoignables depuis Internet (KAN-10)

- **Description** : tentative de connexion directe aux ports internes (5432, 9000, 9001) depuis une machine externe au VPS.
- **Objectif** : vérifier le garde-fou « Docker contourne ufw » — seul Traefik doit publier un port, PostgreSQL/MinIO ne doivent jamais être joignables depuis Internet même si ufw autorise 80/443/22 uniquement.
- **Préconditions** : stack prod (ou staging) démarrée sur le VPS.
- **Étapes** : 1) Depuis une machine externe, `nc -zv <IP_VPS> 5432` puis `nc -zv <IP_VPS> 9000` et `9001`. 2) `docker compose -p storytide-prod ... ps` sur le VPS pour confirmer l'absence de `ports:` publiés sur ces services.
- **Résultat attendu** : les 3 connexions échouent (timeout/refused) depuis l'extérieur ; `docker compose ps` ne montre aucun port publié pour `postgres`/`minio` autre que via le réseau interne.
- **Critères d'acceptation** : `deploy/compose.prod.yml`/`compose.staging.yml` — aucun `ports:` sur `postgres`/`minio`/`worker`/`migrate`/`backup`, seul `traefik` publie 80/443.
- **Type** : sécurité · **Statut** : ✅ Validé le 18-07-2026 (exécuté sur staging: v1.0.0-rc.2)

## TST-SEC-012 — Déploiement complet déclenché par tag, sans intervention manuelle sur le VPS (KAN-10)

- **Description** : un tag git `vX.Y.Z-rc.N` (staging) puis `vX.Y.Z` (prod, après approbation de l'environment GitHub) déclenche la chaîne CD de bout en bout.
- **Objectif** : vérifier que le déploiement est entièrement piloté par CI/CD (build → push ghcr → SSH → pull/up) sans commande tapée à la main sur le VPS.
- **Préconditions** : secrets GitHub (`VPS_HOST`/`VPS_USER`/`VPS_SSH_KEY`) posés, `.env.staging`/`.env.prod` réels présents sur le VPS, Environments GitHub `staging`/`production` configurés (reviewer requis sur `production` uniquement).
- **Étapes** : 1) Pousser un tag `vX.Y.Z-rc.N`. 2) Observer le run GitHub Actions (`cd.yml`) jusqu'au job `deploy`. 3) Sur le VPS, `docker compose -p storytide-staging ... ps`. 4) Répéter avec un tag `vX.Y.Z` (approuver l'environment `production` dans l'onglet Actions).
- **Résultat attendu** : les 4 images sont poussées sur ghcr, le job `deploy` réussit (`--wait` healthchecks OK), `docker compose ps` montre tous les services `healthy`/`running`, sans commande manuelle sur le VPS en dehors de l'approbation GitHub pour la prod.
- **Critères d'acceptation** : `.github/workflows/cd.yml` (jobs `build-push`/`deploy`) ; capture du run + de `docker compose ps` versées en preuve (`docs/cd.md`).
- **Type** : sécurité / fonctionnel · **Statut** : ✅ Validé le 18-07-2026 (exécuté sur prod & staging: v1.0.1)

## TST-SEC-013 — Upload d'image : rejet d'un faux MIME (magic bytes) et d'une taille excessive (KAN-16)

- **Description** : un fichier dont l'extension/le `Content-Type` déclaré prétend être une image, mais dont le contenu réel n'en est pas une (ou dépasse la taille maximale), est uploadé depuis l'éditeur.
- **Objectif** : vérifier que la validation MIME repose sur les octets réels (magic bytes), pas sur le `Content-Type` déclaré par le navigateur (falsifiable — OWASP A10), et que la borne de taille (5 Mo) est appliquée avant tout envoi vers MinIO.
- **Préconditions** : une entrée existe, l'éditeur est ouvert.
- **Étapes** : 1) Ouvrir le dialog « Image », choisir un fichier texte renommé en `.png`. 2) Renseigner l'alt, cliquer « Insérer ». 3) Répéter avec un fichier image valide mais supérieur à 5 Mo.
- **Résultat attendu** : les deux tentatives sont rejetées avec un message clair (« Type de fichier non pris en charge. » / « Image trop volumineuse (5 Mo maximum). ») ; aucun objet n'est créé dans MinIO, aucune ligne `Image` en base.
- **Critères d'acceptation** : `image-validation.test.ts` (signatures PNG/JPEG/GIF/WebP acceptées, texte brut rejeté) ; `image-service.test.ts` (`uploadImage` : MIME invalide et taille dépassée rejetés avant `storage.upload`/`prisma.image.create`).
- **Type** : sécurité · **Statut** : ✅ (`image-validation.test.ts`, `image-service.test.ts`)

## TST-SEC-014 — Ancre `javascript:` collée dans l'éditeur, neutralisée dès le collage (KAN-39, BUG-002)

- **Description** : un texte externe (ex. copié depuis un outil tiers) contient un lien HTML `<a href="javascript:alert(1)">` collé dans l'éditeur d'une entrée.
- **Objectif** : vérifier que l'assainissement du lien a lieu **dès le parsing du collage**, pas seulement lors de la validation serveur (défense en profondeur, OWASP A03) — le texte de l'ancre reste, la mark `link` et l'attribut dangereux n'apparaissent nulle part dans le contenu persisté.
- **Préconditions** : une entrée existe, l'éditeur est ouvert.
- **Étapes** : 1) Coller un extrait HTML contenant `<a href="javascript:alert(1)">Cliquez ici</a>` dans l'éditeur. 2) Attendre l'indicateur « Enregistré. ». 3) Recharger la page.
- **Résultat attendu** : le texte « Cliquez ici » est présent, sans aucun lien cliquable ; après rechargement, le contenu relu ne contient ni mark `link` ni la chaîne `javascript:`.
- **Critères d'acceptation** : `tiptap-extensions.test.ts` (`SafeLink` : `href` en `javascript:` rejeté dès `parseHTML`, `JSON.stringify` du document ne contient jamais `javascript:`) ; `tiptap-content.test.ts` (garde-fou serveur existant, `assertSafeAttributes`, inchangé — double barrière).
- **Type** : sécurité · **Statut** : ✅ (gates automatisés : lint, `tsc`, 322/322 tests unitaires, build, 9/9 e2e) — vérification manuelle Aymeric en attente.

## TST-SEC-015 — Endpoint `/api/health` : statut nominal, base coupée, aucune fuite d'information (supervision v1, C4.1.2)

- **Description** : la sonde externe de supervision (Better Stack) interroge `GET /api/health`. Cas nominal (base saine), cas d'échec (base injoignable/coupée), et vérification qu'aucun détail d'erreur brut (message d'exception, DSN) ne fuite dans la réponse HTTP.
- **Objectif** : vérifier que l'endpoint permet une détection externe fiable de l'état de l'app (200 = vivante et connectée à la base, 503 sinon) sans exposer d'information sensible (OWASP A05) — le SHA de commit, seule donnée un peu plus précise, n'apparaît **jamais** en production.
- **Préconditions** : stack (dev ou staging) démarrée, base de données accessible.
- **Étapes** : 1) `curl -i http://localhost:3000/api/health` base saine. 2) Couper la base (`docker compose stop postgres` ou équivalent). 3) `curl -i http://localhost:3000/api/health` à nouveau. 4) Inspecter le corps de la réponse d'échec pour toute trace de message d'erreur brut/DSN.
- **Résultat attendu** : (1) `200`, corps `{"status":"ok","version":"…","uptime":…,"checks":{"db":"ok"}}`, en-tête `Cache-Control: no-store`, pas de champ `commit` si `NODE_ENV=production`. (3) `503`, corps `{"status":"degraded","checks":{"db":"error"}}`. (4) aucune chaîne d'erreur d'origine, de DSN ni de stack trace dans le corps — la trace réelle part uniquement en log serveur (`console.error`).
- **Critères d'acceptation** : `src/app/api/health/route.test.ts` (200 nominal, 503 base KO, 503 timeout 2 s, non-fuite du message d'erreur d'origine, SHA masqué en production/affiché hors production) ; vérifié en conditions réelles (stack dev, base coupée — sorties 200 puis 503 montrées, pas supposées).
- **Type** : sécurité · **Statut** : ✅ `src/app/api/health/route.test.ts`

## TST-ENT-010 — Upload d'image depuis l'éditeur : insertion et persistance (KAN-16)

- **Description** : depuis le dialog « Insérer une image » de l'éditeur (KAN-39, remplace l'ancienne popover maison), un utilisateur importe un fichier (au lieu de saisir une URL), l'insère avec une légende (texte alternatif RGAA), sauvegarde, puis recharge la page.
- **Objectif** : vérifier le round-trip complet — upload vers MinIO, référence stable persistée (`/api/media/<imageId>`, jamais une URL MinIO présignée directe), résolution en URL signée fraîche à chaque lecture, et survie de l'image après rechargement (frontière RSC → Client).
- **Préconditions** : une entrée existe, un fichier image valide (PNG/JPEG/GIF/WebP, ≤ 5 Mo) est disponible.
- **Étapes** : 1) Ouvrir le dialog « Image ». 2) Choisir le fichier via « Importer une image ». 3) Renseigner la « Légende » (obligatoire). 4) Cliquer « Insérer ». 5) Attendre l'indicateur « Enregistré. ». 6) Recharger la page.
- **Résultat attendu** : l'image est visible immédiatement après insertion (`src` = `/api/media/<imageId>`, jamais une URL MinIO directe) ; après rechargement, l'image reste visible et chargée (round-trip signé revalidé à chaque lecture).
- **Critères d'acceptation** : vérifié en conditions réelles bout en bout (`e2e/image-upload.spec.ts`, vrai navigateur Chromium, vrai MinIO, `naturalWidth > 0` après chargement — pas seulement la présence DOM, l'image est `loading="lazy"`).
- **Type** : fonctionnel (bout en bout) + accessibilité (alt obligatoire, RGAA) · **Statut** : ✅ (`e2e/image-upload.spec.ts`)

## TST-ENT-011 — Collage d'un texte externe (lien relatif + retours à la ligne) dans l'éditeur, enregistrement réussi (KAN-39, BUG-002)

- **Description** : un texte copié depuis un outil tiers (ex. Obsidian) contient un wikilien converti en `<a href="…">` avec un `href` relatif (parfois avec espaces) et des retours à la ligne rendus en `<br>` plutôt qu'en paragraphes distincts.
- **Objectif** : vérifier que ce collage n'échoue plus la sauvegarde (bogue P1 du 2026-07-21 : le document entier était rejeté avec « Contenu invalide. » à cause d'un seul attribut de lien invalide) et que la mise en forme du texte source (une ligne = un paragraphe) est respectée après collage.
- **Préconditions** : une entrée existe, l'éditeur est ouvert.
- **Étapes** : 1) Coller un extrait HTML avec un lien à `href` relatif (ex. `<a href="Cultistes des souterrains">Cultistes des souterrains</a>`) suivi d'un `<br>` puis d'un second texte (« Sous-titre ») dans le même bloc. 2) Attendre l'indicateur « Enregistré. ». 3) Recharger la page.
- **Résultat attendu** : la sauvegarde réussit (pas de message d'erreur) ; « Cultistes des souterrains » et « Sous-titre » sont tous deux lisibles, dans deux paragraphes distincts ; aucun lien cliquable sur le premier texte.
- **Critères d'acceptation** : `tiptap-extensions.test.ts` (`SafeLink` : href relatif/espaces rejeté, texte conservé ; `splitParagraphsOnBreaks` : `<br>` scindé en paragraphes distincts, pas de paragraphe vide ; cas d'intégration combinant les deux sur un collage réaliste).
- **Type** : fonctionnel · **Statut** : ✅ (gates automatisés : lint, `tsc`, 322/322 tests unitaires, build, 9/9 e2e) — vérification manuelle Aymeric en attente.

## TST-ENT-012 — Redimensionnement d'une image par poignée de drag, avec équivalent clavier (KAN-39 volet 5)

- **Description** : une image insérée dans l'éditeur se redimensionne via une poignée sur son bord droit (souris) ou via les flèches gauche/droite une fois sélectionnée (clavier) ; la largeur est persistée en pourcentage de la largeur du contenu (`width`, borné 10–100, défaut 100), le ratio hauteur/largeur est toujours conservé.
- **Objectif** : vérifier que le drag redimensionne fluidement en direct, que le clavier seul permet le même réglage (RGAA — le drag n'est jamais le seul chemin), et que la taille choisie survit à la sauvegarde et au rechargement.
- **Préconditions** : une entrée existe, une image y est déjà insérée.
- **Étapes** : 1) Cliquer l'image pour la sélectionner (cadre + poignée visibles). 2) Glisser la poignée horizontalement. 3) Attendre l'indicateur « Enregistré. », recharger la page — la taille doit être conservée. 4) Re-sélectionner l'image (souris, ou clavier via la sélection native de nœud de l'éditeur), puis utiliser les flèches gauche/droite pour ajuster la largeur par pas de 5 %.
- **Résultat attendu** : le drag ajuste la largeur en direct sans à-coups, dans les bornes [10, 100] ; le clavier seul (sans souris) permet le même réglage, chaque pas annoncé via `aria-valuenow` (poignée `role="slider"`) ; la largeur choisie est identique avant/après rechargement.
- **Critères d'acceptation** : `tiptap-content.test.ts` (`assertSafeAttributes` : accepte width valide et l'absence de `width` — défaut 100, rétrocompat — rejette hors bornes/mauvais type/non fini) ; `tiptap-extensions.test.ts` (round-trip HTML du style `width:%` via `generateJSON`) ; `resizable-image-view.test.tsx` (poignée présente uniquement si l'image est sélectionnée, commit clavier ±5 % borné aux limites) — pas de simulation de drag en unitaire, vérifiée manuellement.
- **Type** : fonctionnel + accessibilité (clavier complet, RGAA) · **Statut** : ✅ (gates automatisés : lint, `tsc`, 335/335 tests unitaires, build, 9/9 e2e ; validé manuellement par Aymeric).

## TST-LNK-001 — Une mention détectée crée une Relation origin=AUTO

- **Description** : le texte d'une fiche (entrée) mentionne le nom (ou un alias) d'une autre entité du même monde.
- **Objectif** : vérifier que la sauvegarde déclenche un job de liaison, que le moteur Aho-Corasick détecte la mention, et qu'une `Relation origin=AUTO` est créée entre les deux entrées.
- **Préconditions** : un monde contient au moins deux entités ; l'une mentionne l'autre dans son contenu.
- **Étapes** : 1) Sauvegarder le contenu de l'entrée mentionnant l'autre entité. 2) Laisser le worker traiter le job de liaison (`entity-linking`, `singletonKey=entityId`).
- **Résultat attendu** : une `Relation origin=AUTO` apparaît en base entre l'entrée source et l'entité mentionnée.
- **Critères d'acceptation** : `scanAndLinkEntity` crée la relation ; vérifié en conditions réelles (vraie base Postgres, vrai adaptateur pg-boss, vrai worker) — la mention disparaît du texte → la relation `AUTO` correspondante est supprimée au re-scan suivant.
- **Type** : fonctionnel · **Statut** : ✅ (`linker-service.test.ts`, vérifié en conditions réelles)

## TST-LNK-002 — Une Relation origin=MANUAL n'est jamais écrasée par un re-scan automatique

- **Description** : une relation créée manuellement entre deux entités existe, alors que le texte de la fiche (entrée) source ne mentionne plus (ou n'a jamais mentionné) la cible.
- **Objectif** : garantir la règle dure du projet — un re-scan automatique ne supprime et ne modifie jamais une `Relation origin=MANUAL`, quel que soit le contenu du texte.
- **Préconditions** : une `Relation origin=MANUAL` existe entre deux entités d'un même monde ; le texte de l'entrée source ne mentionne pas la cible.
- **Étapes** : 1) Déclencher un re-scan de l'entrée source (sauvegarde de contenu). 2) Laisser le worker traiter le job.
- **Résultat attendu** : la `Relation origin=MANUAL` est toujours présente et inchangée après le re-scan.
- **Critères d'acceptation** : `scanAndLinkEntity` ne lit et n'écrit que des relations `origin=AUTO` (filtre explicite sur toutes les requêtes) ; vérifié en conditions réelles.
- **Type** : fonctionnel · **Statut** : ✅ (`linker-service.test.ts`, vérifié en conditions réelles)

## TST-LNK-003 — Garde-fous du scan : auto-mention, `LinkIgnore`, occurrences ambiguës

- **Description** : trois cas où une mention textuelle ne doit **pas** produire de `Relation origin=AUTO` : une fiche (entrée) qui mentionne son propre nom, une cible explicitement ignorée (`LinkIgnore`), et une occurrence matchant plusieurs entités homonymes aux mêmes bornes.
- **Objectif** : vérifier qu'aucun lien silencieux n'est créé dans ces trois cas (auto-lien absurde, contournement d'un garde-fou utilisateur, ambiguïté non résolue).
- **Préconditions** : selon le cas — une entité dont le nom apparaît dans son propre texte ; une paire `(entityId, targetId)` présente dans `LinkIgnore` ; deux entités de même nom dans le même monde.
- **Étapes** : 1) Sauvegarder un contenu correspondant à l'un des trois cas. 2) Laisser le worker traiter le job.
- **Résultat attendu** : aucune `Relation origin=AUTO` n'est créée pour l'occurrence concernée dans les trois cas.
- **Critères d'acceptation** : couvert par `linker-service.test.ts` (auto-mention exclue, `LinkIgnore` respecté, occurrence ambiguë sans lien). Le marquage « ambigu » cliquable pour trancher (spec §4.4 point 6) reste hors périmètre — backlog KAN-19, nécessite un modèle de données dédié.
- **Type** : fonctionnel · **Statut** : ✅ (`linker-service.test.ts`)

## TST-LNK-004 — Surlignage live des mentions dans l'éditeur, navigation par Ctrl/Cmd+clic et par la liste accessible

- **Description** : pendant la frappe, une mention d'entité existante est soulignée en direct dans l'éditeur (décoration ProseMirror, jamais persistée). Deux chemins de navigation vers la fiche (entrée) liée : Ctrl/Cmd+clic sur la mention surlignée (clic simple = édition normale, ne navigue jamais), ou la liste « Renvois » sous l'éditeur (vrais `<Link>`, navigable au clavier/lecteur d'écran).
- **Objectif** : vérifier que le surlignage apparaît sans attendre le worker (scan client), que les deux modes de clic se comportent comme prévu, et que la liste persistée (alimentée par le vrai worker) reflète la relation créée.
- **Préconditions** : un monde contient une entité cible (ex. « Aldric ») ; une autre entrée (source) est en cours d'édition.
- **Étapes** : 1) Taper un texte mentionnant l'entité cible dans l'éditeur de l'entrée source. 2) Vérifier que le mot porte la classe `entity-mention` et l'attribut `data-target-id` correspondant. 3) Cliquer simplement sur la mention (sans modificateur). 4) Ctrl/Cmd+cliquer sur la mention. 5) Attendre l'autosave, laisser le worker traiter le job, recharger la page et consulter la liste « Renvois ». 6) Suivre le lien de la liste.
- **Résultat attendu** : le surlignage apparaît immédiatement (avant tout traitement du worker) ; le clic simple ne change pas d'URL (édition normale) ; le Ctrl/Cmd+clic navigue vers l'entrée cible ; la liste « Renvois » affiche un lien vers la cible une fois le job traité, et ce lien navigue vers la même entrée.
- **Critères d'acceptation** : `tiptap-positions.test.ts` (alignement caractère-exact `plainText` ↔ ProseMirror), `tiptap-link-highlight.test.ts` (décorations correctes : mention connue, ambiguïté/auto-mention/`LinkIgnore` sans décoration, re-scan sur changement de doc), `relation-service.test.ts` (`listOutgoingLinks`) ; vérifié en conditions réelles bout en bout (`e2e/link-highlight.spec.ts`, vrai navigateur Chromium, vrai worker, vraie base Postgres isolée).
- **Type** : fonctionnel (bout en bout) + accessibilité · **Statut** : ✅ (`tiptap-positions.test.ts`, `tiptap-link-highlight.test.ts`, `relation-service.test.ts`, `e2e/link-highlight.spec.ts`)

## TST-LNK-005 — Backlinks : liste « Échos » sur chaque entrée d'entité

- **Description** : sous la liste « Renvois » (liens sortants), une seconde liste accessible « Échos » affiche toutes les fiches (entrées) qui mentionnent l'entité courante (relations entrantes, AUTO et MANUAL confondues), symétrique de `listOutgoingLinks`.
- **Objectif** : vérifier que le sens entrant de la relation est résolu et affiché correctement, indépendamment du sens sortant déjà couvert par TST-LNK-004, avec le même niveau d'accessibilité (HTML sémantique, navigation clavier).
- **Préconditions** : deux entités existent dans un monde (A mentionne B) et la relation `AUTO` ou `MANUAL` a été créée entre elles.
- **Étapes** : 1) Ouvrir l'entrée B (la cible mentionnée). 2) Consulter la section « Échos ». 3) Vérifier le lien vers A. 4) Ouvrir une entrée sans aucune mention entrante.
- **Résultat attendu** : l'entrée B affiche un lien accessible vers A dans « Échos » ; l'entrée sans mention entrante affiche l'état vide dédié (« Aucune entrée ne mentionne cette entité pour l'instant. ») plutôt qu'une liste vide silencieuse ; les deux sections (« Renvois » / « Échos ») ont chacune un `aria-label` distinct pour les lecteurs d'écran.
- **Critères d'acceptation** : `relation-service.test.ts` (`listIncomingLinks` : vide sans requêter les entités, tri par nom, source introuvable omise silencieusement) ; `LinkedEntities` généralisé (`linked-entities.tsx`) couvert par le même rendu que TST-LNK-004 (composant partagé, pas de duplication de markup).
- **Type** : fonctionnel + accessibilité · **Statut** : ✅ (`relation-service.test.ts`)

## TST-LNK-006 — Mentions manuelles @ : popup, insertion, relation MANUAL bidirectionnelle

- **Description** : dans l'éditeur, taper `@` ouvre une popup de suggestion filtrant les entités du monde (accents/casse ignorés) ; sélectionner une entité insère une mention persistée (jamais de texte `@` résiduel), qui se traduit en `Relation origin=MANUAL` à la sauvegarde, visible depuis les deux sens (« Renvois » et « Échos »).
- **Objectif** : vérifier la popup (ouverture, filtrage, navigation clavier ↑/↓/Entrée/Échap), l'insertion du node, la réconciliation synchrone des `Relation MANUAL` (sans attendre le worker AUTO), et la navigation (clic simple = édition, Ctrl/Cmd+clic = navigation, cohérente avec le surlignage AUTO).
- **Préconditions** : un monde contient une entité cible (nom composé, ex. « Aldric le Vaillant ») ; une autre fiche (entrée source) est en cours d'édition.
- **Étapes** : 1) Taper `@` puis le nom (même composé, espaces compris) de l'entité cible dans l'éditeur de l'entrée source. 2) Vérifier la popup filtrée puis valider par Entrée (ou clic). 3) Vérifier le rendu de la mention (classe, `data-target-id`, aucun `@` affiché). 4) Attendre l'autosave. 5) Clic simple sur la mention, puis Ctrl/Cmd+clic. 6) Recharger l'entrée source et consulter « Renvois ». 7) Ouvrir l'entrée cible et consulter « Échos ».
- **Résultat attendu** : la popup reste ouverte et filtrée même après un espace dans la requête (`allowSpaces`, cf. ADR-0011) ; la mention insérée est visible immédiatement, sans attendre le worker ; le clic simple ne navigue jamais, le Ctrl/Cmd+clic navigue vers l'entrée cible ; « Renvois » (entrée source) et « Échos » (entrée cible) affichent la relation dès le premier rechargement après l'autosave (réconciliation synchrone, pas de délai comme pour l'AUTO).
- **Critères d'acceptation** : `tiptap-content.test.ts` (`extractMentionedEntityIds`), `relation-service.test.ts` (`reconcileManualMentions` : ajout/suppression, id hors monde ignoré, auto-mention exclue, jamais de lecture/écriture des lignes AUTO), `entity-content.test.ts` (câblage dans `saveEntityContentAction`, échec non-fatal loggué), `tiptap-extensions.test.ts` (`filterMentionSuggestions`), `mention-list.test.tsx` (popup : rendu, navigation clavier, clic) ; vérifié en conditions réelles bout en bout (`e2e/manual-mention.spec.ts`, vrai navigateur Chromium, vraie base Postgres isolée — a révélé le bug `allowSpaces` avant toute mise en recette manuelle).
- **Type** : fonctionnel (bout en bout) + accessibilité + sécurité (revalidation serveur des id mentionnés, OWASP A01) · **Statut** : ✅ (`tiptap-content.test.ts`, `relation-service.test.ts`, `entity-content.test.ts`, `tiptap-extensions.test.ts`, `mention-list.test.tsx`, `e2e/manual-mention.spec.ts`)

## TST-LNK-007 — Garde-fou « Ignorer ce lien » : suppression immédiate et blocage de la recréation

- **Description** : sur la liste « Renvois » (liens sortants), chaque relation `origin=AUTO` porte un bouton « Ignorer ce lien » ; l'action supprime immédiatement la `Relation AUTO` correspondante et empêche sa recréation par un futur scan, tant que l'utilisateur n'a pas cliqué « Ne plus ignorer » dans la nouvelle section « Liens ignorés ».
- **Objectif** : vérifier que l'utilisateur garde le contrôle sur la liaison automatique (anti-faux-positifs, spec §2.5) sans attendre un nouveau passage du worker pour la suppression, et sans qu'un simple retrait du garde-fou recrée la relation de son propre chef (seul un nouveau scan la recrée).
- **Préconditions** : une `Relation origin=AUTO` existe entre une fiche (entrée) source et une entrée cible (mention textuelle détectée par le worker).
- **Étapes** : 1) Ouvrir l'entrée source, repérer la cible dans « Renvois ». 2) Cliquer « Ignorer ce lien ». 3) Vérifier la disparition de « Renvois » et l'apparition dans « Liens ignorés ». 4) Cliquer « Ne plus ignorer ». 5) Vérifier la disparition de « Liens ignorés » et l'ABSENCE de recréation immédiate dans « Renvois ». 6) Déclencher un nouvel autosave (re-sauvegarde du contenu inchangé) et laisser le worker retraiter le job. 7) Recharger et vérifier la réapparition dans « Renvois ».
- **Résultat attendu** : l'étape 2 supprime la relation sans attendre le worker ; l'étape 4 ne fait que lever le garde-fou (aucune relation recréée tant qu'aucun scan n'a eu lieu) ; l'étape 7 confirme qu'un nouveau scan redétecte normalement la mention une fois le garde-fou levé.
- **Critères d'acceptation** : `relation-service.test.ts` (`ignoreLink` : authz via `getEntity`, revalidation du `targetId` contre le monde réel avant écriture — OWASP A01 —, transaction upsert `LinkIgnore` + suppression `Relation AUTO`, jamais `MANUAL` ; `unignoreLink` : suppression du `LinkIgnore`, no-op silencieux si absent ; `listIgnoredTargets` : noms résolus, cible supprimée omise silencieusement) ; `link-ignore.test.ts` (session expirée, entrée introuvable, échec générique loggué jamais avalé, succès + `revalidatePath`) ; vérifié en conditions réelles bout en bout (`e2e/link-ignore.spec.ts`, vrai navigateur Chromium, vrai worker, vraie base Postgres isolée).
- **Type** : fonctionnel (bout en bout) + sécurité (revalidation serveur du `targetId`, OWASP A01) · **Statut** : ✅ (`relation-service.test.ts`, `link-ignore.test.ts`, `e2e/link-ignore.spec.ts`)

## TST-LNK-008 — Normalisation Unicode NFC : un texte collé en forme décomposée (NFD) ne fait jamais disparaître un lien (ADR-0020)

- **Description** : un texte externe collé dans l'éditeur (ou un nom/alias saisi) peut arriver en forme Unicode **décomposée** (NFD — un accent est alors un caractère combinant séparé, ex. copier-coller depuis macOS ou un export d'app de notes) plutôt qu'en forme précomposée (NFC). Un diagnostic (session normalisation Unicode) a établi qu'un texte NFD non normalisé peut faire disparaître **silencieusement**, dans le moteur de liaison (`AhoCorasick.search()`), non seulement le lien de l'entité accentuée mais aussi celui de **toute autre entité mentionnée plus loin dans le même texte** (décalage d'index qui fausse la vérification de frontière de mot).
- **Objectif** : vérifier que la mitigation retenue (normalisation NFC à **la frontière applicative** — persistance du nom/alias en service, normalisation des nœuds texte du corps Tiptap au moment de l'extraction du `plainText` — plutôt que dans `normalize.ts`/`aho-corasick.ts`, ADR-0020) élimine réellement le cas observé, sans qu'aucune modification du moteur de liaison lui-même n'ait été nécessaire.
- **Préconditions** : une entité cible existe ; une fiche source mentionne cette entité en forme NFD **suivie** d'une autre entité valide plus loin dans le même paragraphe (le cas qui faisait disparaître le second lien).
- **Étapes** : 1) Créer l'entité cible avec un nom accentué. 2) Dans une autre fiche, écrire un texte mentionnant l'entité cible en forme NFD (ex. collé depuis une source qui décompose les accents) puis, plus loin dans la même phrase, mentionner une seconde entité valide sans aucun accent. 3) Sauvegarder, attendre le worker. 4) Consulter « Renvois » sur la fiche source.
- **Résultat attendu** : les deux liens apparaissent dans « Renvois » — ni l'entité accentuée (forme NFD à l'origine) ni la seconde entité (mentionnée après, sans accent) ne sont perdues. Le nom/alias de l'entité créée en forme NFD est persisté en forme NFC (`Entity.name`/`Alias.value`), et le corps Tiptap sauvegardé (`Entity.content`, `Entity.plainText`) reflète la même forme NFC — jamais l'un normalisé et l'autre non.
- **Critères d'acceptation** : `src/lib/linker/aho-corasick.test.ts` (le moteur pur, isolé, conserve la limite connue face à du texte non normalisé — pin explicite — **et** un test de non-régression dédié prouve qu'avec un texte déjà NFC, garanti par la frontière applicative, aucun match n'est perdu) ; `entity-service.test.ts` (`createEntity`/`updateEntity` : nom et alias persistés en NFC même saisis en NFD) ; `tiptap-content.test.ts` (`normalizeContentText` : nœuds texte normalisés en NFC à toute profondeur, structure/marks/attrs préservés, fonction pure) ; `entity-content.test.ts` (`saveEntityContentAction` : body persisté et `plainText` extrait alignés sur la même forme NFC). Vérification manuelle : aucune donnée existante en base de développement n'était en forme non-NFC au moment du diagnostic (contrôle ponctuel, pas de migration nécessaire) — à revérifier sur staging/production avant bascule si des données antérieures à ce correctif y existent.
- **Type** : fonctionnel + sécurité/robustesse (fiabilité du différenciateur produit, faux négatif silencieux) · **Statut** : ✅ (`aho-corasick.test.ts`, `entity-service.test.ts`, `tiptap-content.test.ts`, `entity-content.test.ts`)

## TST-GRF-001 — Constellation : rendu Cytoscape + navigation cliquable

- **Description** : la page `/worlds/[slug]/graph` affiche la Constellation (graphe interactif, canvas Cytoscape.js) des entités (nœuds) et de leurs relations (arêtes, AUTO et MANUAL confondues) ; cliquer sur un nœud navigue vers la fiche (entrée) correspondante.
- **Objectif** : vérifier que la Constellation se construit correctement à partir des entités/relations réelles du monde, et que le clic sur un nœud navigue vers la bonne entrée.
- **Préconditions** : un monde contient au moins deux entités liées par une `Relation` (AUTO ou MANUAL).
- **Étapes** : 1) Ouvrir `/worlds/[slug]/graph`. 2) Vérifier la présence du canvas rendu. 3) Cliquer sur un nœud.
- **Résultat attendu** : le canvas Cytoscape est monté (élément `<canvas>` réel, pas seulement le conteneur) ; le clic sur un nœud navigue vers `/worlds/[slug]/entities/[entityId]` de l'entité cliquée.
- **Critères d'acceptation** : `graph-elements.test.ts` (`buildGraphElements` : nœuds/arêtes corrects, arêtes AUTO/MANUAL distinguées par id, arête omise silencieusement si une extrémité a disparu), `relation-service.test.ts` (`listWorldRelations`) ; vérifié en conditions réelles bout en bout (`e2e/graph.spec.ts`, vrai navigateur Chromium, vraie base Postgres isolée).
- **Type** : fonctionnel (bout en bout) · **Statut** : ✅ (`graph-elements.test.ts`, `relation-service.test.ts`, `e2e/graph.spec.ts`)

## TST-GRF-002 — Constellation : filtrage par type (chips repliables, KAN-36 P5b)

- **Description** : un panneau flottant en overlay, à droite du canvas de la Constellation, replié/déplié via un bouton d'en-tête (`aria-expanded`), regroupe des chips à état (`<button aria-pressed>`, un par type d'entité) permettant de masquer/afficher les nœuds d'un type donné, sans recréer le graphe (zoom/pan conservés). Remplace les cases à cocher du MVP KAN-25.
- **Objectif** : vérifier que chaque type d'entité a bien une chip dédiée, pressée par défaut (tout visible), que la basculer ne casse pas la page, et que le panneau reste entièrement clavier (chips = vrais boutons, focus MINT visible).
- **Préconditions** : un monde contient au moins une entité de chaque type visé par le test.
- **Étapes** : 1) Ouvrir `/worlds/[slug]/graph`. 2) Vérifier qu'une chip existe pour chaque type présent, pressée. 3) Cliquer une chip.
- **Résultat attendu** : chaque chip est pressée (`aria-pressed="true"`) par défaut ; cliquer la fait passer à `aria-pressed="false"` sans erreur ni rechargement de page.
- **Critères d'acceptation** : vérifié en conditions réelles (`e2e/graph.spec.ts` : chip « Lieu » présente, pressée, puis dépressée après clic — `getByRole("button", { name, exact: true, pressed })`).
- **Type** : fonctionnel + accessibilité (boutons natifs, focus visible) · **Statut** : ✅ (`e2e/graph.spec.ts`)

## TST-GRF-003 — Constellation : liste accessible derrière « Observer les fils » (clavier/lecteur d'écran)

- **Description** : sous la Constellation, un disclosure « Observer les fils » (`<button aria-expanded>`, FERMÉ par défaut, KAN-36 P5, retour Aymeric) révèle une liste accessible (`<nav>` + vrais `<Link>`) énumérant chaque entité ayant au moins une relation sortante et ses cibles — chemin de navigation clavier/lecteur d'écran équivalent au canvas (affordance souris uniquement, cf. ADR-0012). Une paire d'entités qui se mentionnent **mutuellement** (relation dans les deux sens) n'apparaît qu'**une seule fois** (lien « ↔ », jamais deux lignes distinctes pour la même paire) ; de même une cible reliée à la fois par AUTO et MANUEL (même sens) n'apparaît qu'une fois.
- **Objectif** : vérifier que le disclosure masque la liste par défaut sans la retirer du DOM une fois ouvert, que la liste reflète fidèlement les relations réelles du monde sans jamais dupliquer une paire, et permet une navigation clavier complète vers les entrées liées.
- **Préconditions** : un monde contient au moins une entité avec une relation sortante.
- **Étapes** : 1) Ouvrir `/worlds/[slug]/graph`. 2) Cliquer « Observer les fils ». 3) Localiser la région « Liste des liens de la constellation ». 4) Suivre un lien vers une entité cible.
- **Résultat attendu** : la liste est absente du DOM tant que le disclosure n'est pas ouvert ; une fois ouverte, elle affiche l'entité source et un lien vers chaque cible (une seule fois par paire, même en cas de mention mutuelle ou de double origine AUTO+MANUEL) ; suivre le lien navigue vers la bonne entrée (`<h1>` de l'entrée cible).
- **Critères d'acceptation** : `graph-elements.test.ts` (`buildAccessibleGraphEntries` : regroupement par source, tri, entité sans relation sortante absente de la liste mais atteignable comme cible, extrémité disparue omise silencieusement, dédoublonnage AUTO+MANUEL même sens, dédoublonnage d'une paire mutuelle rangée sous l'entité canonique, départage déterministe par id si noms identiques) ; vérifié en conditions réelles bout en bout (`e2e/graph.spec.ts`, ouverture du disclosure puis navigation clavier/lecteur d'écran).
- **Type** : accessibilité (élim.) · **Statut** : ✅ gates automatisés (`graph-elements.test.ts`, `e2e/graph.spec.ts`) — vérif manuelle Aymeric en attente (disclosure, rendu « ↔ » d'une paire mutuelle réelle)

## TST-GRF-004 — Constellation : couleur et filtre par famille de types (KAN-18, chips KAN-36 P5b)

- **Description** : avec 26 types d'entités désormais regroupés en 8 familles, les nœuds de la Constellation sont colorés par famille (pas par type individuel, illisible à 26 teintes) et les chips de filtre sont regroupées par famille (`<fieldset>` imbriqué par groupe, en-tête « Tout »/« Rien » par famille) plutôt qu'en 26 chips à plat.
- **Objectif** : vérifier que le filtre par type reste fonctionnel pendant la coexistence des 26 types, que chaque famille a bien sa propre teinte, que « Tout »/« Rien » bascule bien tous les types d'une famille d'un coup, et que la couleur n'est jamais le seul moyen de distinguer un type (libellés textuels toujours présents).
- **Préconditions** : un monde contient des entités d'au moins deux types de familles différentes.
- **Étapes** : 1) Ouvrir `/worlds/[slug]/graph`. 2) Vérifier qu'une chip existe pour chaque type, regroupée sous l'en-tête de sa famille. 3) Cliquer une chip, puis « Rien » sur une famille.
- **Résultat attendu** : chaque famille a son propre en-tête (`<legend>`) regroupant ses chips et ses boutons « Tout »/« Rien » ; cliquer une chip masque bien les nœuds de ce type précis (pas toute la famille) ; « Rien » dépresse toutes les chips de la famille d'un coup ; le libellé texte du type reste visible au clic/survol d'un nœud (couleur = famille, hover MINT, jamais l'unique moyen d'identifier le type précis).
- **Critères d'acceptation** : palette à 8 teintes validée par le skill `dataviz` du projet (`node scripts/validate_palette.js`, bande de luminosité/chroma/CVD/contraste, toutes passantes en mode sombre) ; vérifié en conditions réelles (`e2e/graph.spec.ts` : chip « Lieu » présente, pressée, dépressée après clic, entrée créée via le combobox de type KAN-18) ; vérification manuelle Aymeric du « Tout »/« Rien » par famille et du hover MINT (non couvert par e2e).
- **Type** : fonctionnel + accessibilité (couleur jamais seule, C2.2.3) · **Statut** : ✅ gates automatisés — vérif manuelle Aymeric en attente (Tout/Rien, hover MINT, plein cadre)

## TST-QOT-001 — Quota de mondes : blocage au-delà de 3 mondes gratuits

- **Description** : l'offre gratuite limite un compte à 3 mondes (hors futur monde d'introduction, KAN-35) ; une tentative de création d'un 4ᵉ monde est refusée avec un message clair.
- **Objectif** : vérifier que la limite est appliquée en couche service (non contournable), que la création juste sous la limite réussit, et que le message d'erreur est visible et accessible (`role="alert"`).
- **Préconditions** : le compte possède déjà 3 mondes (`origin: USER`).
- **Étapes** : 1) Créer 3 mondes successivement (chacun doit réussir). 2) Tenter la création d'un 4ᵉ monde.
- **Résultat attendu** : les 3 premières créations réussissent et redirigent vers le monde créé ; la 4ᵉ tentative reste sur `/worlds` et affiche « Limite de mondes atteinte pour l'offre gratuite (3 maximum). ».
- **Critères d'acceptation** : `world-service.test.ts` (`createWorld` : sous la limite, à la limite → `WorldQuotaExceededError`, `world.create` jamais appelé) ; vérifié en conditions réelles bout en bout (`e2e/quota.spec.ts`, vrai navigateur Chromium, vraie base Postgres isolée).
- **Type** : fonctionnel (bout en bout) + sécurité (OWASP A04, anti-abus) · **Statut** : ✅ (`world-service.test.ts`, `e2e/quota.spec.ts`)

## TST-QOT-002 — Quota d'entités : blocage au-delà de 50 entrées gratuites par monde

- **Description** : l'offre gratuite limite un monde (`origin: USER`) à 50 entités ; une tentative de création d'une 51ᵉ fiche (entrée) est refusée avec un message clair.
- **Objectif** : vérifier que la limite est appliquée en couche service, que la création juste sous la limite réussit, et que le message d'erreur est visible.
- **Préconditions** : un monde du compte contient déjà 49 entrées.
- **Étapes** : 1) Créer la 50ᵉ entrée du monde (doit réussir). 2) Tenter la création d'une 51ᵉ entrée.
- **Résultat attendu** : la 50ᵉ création réussit et redirige vers l'entrée créée ; la 51ᵉ tentative affiche « Limite d'entrées atteinte pour ce monde (offre gratuite : 50 maximum). ».
- **Critères d'acceptation** : `entity-service.test.ts` (`createEntity` : sous la limite, à la limite → `EntityQuotaExceededError`, `entity.create` jamais appelé) ; vérifié en conditions réelles bout en bout (`e2e/quota.spec.ts`, seed direct des 49 premières entrées via `pg.Client`, les 2 entrées déterminantes créées via la vraie UI).
- **Type** : fonctionnel (bout en bout) + sécurité (OWASP A04, anti-abus) · **Statut** : ✅ (`entity-service.test.ts`, `e2e/quota.spec.ts`)

## TST-QOT-003 — Exemption de quota pour les mondes `origin` INTRO/DEMO

- **Description** : un monde marqué `origin: INTRO` (KAN-35, monde d'introduction "Atheraus" cloné à l'inscription — pas encore construit) ou `origin: DEMO` (compte de démonstration jury) n'est jamais compté parmi les 3 mondes gratuits, et ses entités ne sont jamais plafonnées à 50.
- **Objectif** : vérifier dès maintenant (anticipation KAN-18, avant que KAN-35 n'existe et qu'un compte démo soit provisionné) que la logique de comptage exclut correctement les deux valeurs `origin != USER`, pour qu'aucune ligne de `world-service.ts`/`entity-service.ts` n'ait à être retouchée par la suite.
- **Préconditions** : un monde `origin: INTRO` (ou `DEMO`) contient déjà 50 entités (ou plus) ; le compte possède déjà 3 mondes `origin: USER`.
- **Étapes** : 1) Créer une entité supplémentaire dans le monde `origin: INTRO`/`DEMO`. 2) (Hypothétique tant que KAN-35 n'existe pas) Créer un monde `origin: USER` alors que 3 mondes `USER` existent déjà en plus du monde INTRO/DEMO.
- **Résultat attendu** : la création d'entité réussit sans jamais interroger le compteur (`entity.count` non appelé) ; un monde `origin: INTRO`/`DEMO` ne fait jamais échouer une création de monde par ailleurs légitime.
- **Critères d'acceptation** : `entity-service.test.ts` (« saute le contrôle de quota pour un monde origin=INTRO/DEMO, même au-delà de la limite ») ; `world-service.test.ts` (le comptage `createWorld` filtre explicitement `origin: WorldOrigin.USER`).
- **Type** : fonctionnel · **Statut** : ✅ vérifié par test unitaire uniquement — aucun monde réel n'a encore `origin: INTRO`/`DEMO` tant que KAN-35 n'est pas construit et qu'aucun compte démo n'est provisionné, pas de vérification e2e/staging possible avant cette date (pas de sur-déclaration).

# Cahier de recettes — C2.3.1 (ÉLIMINATOIRE)

> Scénarios dérivés des user stories MoSCoW du Bloc 1. Nomenclature `TST-<CAT>-<NNN>`
> (AUT/MND/ENT/LNK/GRF/SEC/QOT). 6 champs par scénario (Description, Objectif,
> Préconditions, Étapes, Résultat attendu, Critères d'acceptation). Cas passants ET
> cas d'échec. Statut : ⬜ à faire / ✅ OK / ❌ KO (→ `plan-correction-bogues.md`).
>
> État au 2026-07-14 : scénarios **AUT**, **SEC**, **MND** (mondes) et **ENT**
> (entités) exécutés en conditions réelles (base Postgres réelle, deux comptes
> réels via l'API Better Auth) — pas encore exécutés sur staging (pas de staging
> à ce stade). Autres catégories (LNK/GRF/QOT) : pas encore de scénario, les
> features correspondantes n'existent pas.

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

## TST-SEC-002 — Accès à un monde d'autrui via URL directe

- **Description** : un utilisateur connecté saisit directement l'URL `/worlds/<slug>` d'un monde qui ne lui appartient pas.
- **Objectif** : vérifier l'autorisation en couche service (OWASP A01) et l'absence de fuite d'existence.
- **Préconditions** : deux comptes existent ; le monde ciblé appartient au second compte.
- **Étapes** : 1) Se connecter avec le premier compte. 2) Naviguer vers l'URL du monde du second compte.
- **Résultat attendu** : page 404 (`notFound()`), identique à celle d'un monde réellement inexistant.
- **Critères d'acceptation** : aucune information ne permet de distinguer « monde inexistant » de « monde d'autrui » ; `getWorldBySlug` filtre systématiquement sur `ownerId`.
- **Type** : sécurité · **Statut** : ✅ (vérifié en conditions réelles : deux comptes créés via l'API Better Auth, `GET /worlds/<slug-d-autrui>` → `404`)

## TST-ENT-001 — Création d'une fiche (entité) avec type et alias

- **Description** : le propriétaire d'un monde crée une fiche (personnage, lieu, faction, objet ou événement) avec des alias.
- **Objectif** : vérifier la création, le type libre (donnée, pas schéma) et le nettoyage des alias.
- **Préconditions** : un monde existe pour ce propriétaire.
- **Étapes** : 1) Aller sur `/worlds/<slug>`. 2) Renseigner nom, type, alias (un par ligne) dans « Nouvelle fiche ». 3) Soumettre.
- **Résultat attendu** : redirection vers `/worlds/<slug>/entities/<id>`, fiche visible dans la liste avec son type.
- **Critères d'acceptation** : `Entity.worldId` correct ; alias vidés des doublons/entrées vides ; `content`/`plainText` initialisés vides (éditeur pas encore branché).
- **Type** : fonctionnel · **Statut** : ✅ (vérifié en conditions réelles : `entity-service.ts` + `GET /worlds/<slug>` et `GET /worlds/<slug>/entities/<id>`)

## TST-ENT-002 — Modification du nom, du type et des alias d'une fiche

- **Description** : le propriétaire modifie une fiche existante depuis sa page « Paramètres ».
- **Objectif** : vérifier la mise à jour complète (nom, type, alias) sans casser l'appartenance au monde.
- **Préconditions** : une fiche existe dans un monde de ce propriétaire.
- **Étapes** : 1) Aller sur `/worlds/<slug>/entities/<id>`. 2) Modifier nom/type/alias dans « Modifier la fiche ». 3) Soumettre.
- **Résultat attendu** : redirection vers la même page, valeurs mises à jour affichées.
- **Critères d'acceptation** : les trois champs sont bien persistés ; `worldId` inchangé.
- **Type** : fonctionnel · **Statut** : ✅ (vérifié en conditions réelles)

## TST-ENT-003 — Création d'une fiche avec un nom vide ou un type inconnu

- **Description** : un utilisateur soumet le formulaire de création sans nom, ou avec un type hors liste.
- **Objectif** : vérifier le rejet côté serveur (Zod) avant tout appel au service.
- **Préconditions** : aucune.
- **Étapes** : 1) Aller sur `/worlds/<slug>`. 2) Laisser le nom vide (ou forcer un type invalide). 3) Soumettre.
- **Résultat attendu** : erreur affichée sous le champ concerné, reliée via `aria-describedby`.
- **Critères d'acceptation** : aucune `Entity` créée en base.
- **Type** : cas d'échec · **Statut** : ✅ (couvert par `entity-schemas.test.ts` + `create-entity-form.test.tsx`)

## TST-ENT-004 — Suppression d'une fiche

- **Description** : le propriétaire supprime une fiche après confirmation en deux étapes.
- **Objectif** : vérifier la confirmation avant suppression irréversible, entièrement au clavier.
- **Préconditions** : une fiche existe dans un monde de ce propriétaire.
- **Étapes** : 1) Aller sur `/worlds/<slug>/entities/<id>`. 2) Cliquer « Supprimer cette fiche ». 3) Confirmer.
- **Résultat attendu** : la fiche disparaît de la liste, redirection vers `/worlds/<slug>`.
- **Critères d'acceptation** : navigable sans souris ; « Annuler » n'entraîne aucune suppression.
- **Type** : fonctionnel · **Statut** : ✅ (vérifié en conditions réelles : `deleteEntity` + `listEntities` après suppression)

## TST-SEC-003 — Accès à une fiche via un monde qui ne vous appartient pas ou un mauvais monde

- **Description** : un utilisateur connecté tente d'atteindre l'URL `/worlds/<slug-d-autrui>/entities/<id>` d'une fiche appartenant à un monde qu'il ne possède pas.
- **Objectif** : vérifier que l'autorisation en cascade (monde → fiche) ne fuit aucune existence, y compris quand l'`entityId` est valide.
- **Préconditions** : deux comptes existent, chacun avec son propre monde ; une fiche existe dans le monde du premier compte.
- **Étapes** : 1) Se connecter avec le second compte. 2) Naviguer vers l'URL de la fiche du premier compte.
- **Résultat attendu** : page 404, identique à une fiche réellement inexistante.
- **Critères d'acceptation** : `entity-service.ts` vérifie systématiquement l'appartenance du monde (`getWorld`) avant de chercher la fiche ; un `worldId` correct mais non possédé par l'appelant lève `WorldNotFoundError`, jamais `EntityNotFoundError` (pas de distinction exploitable).
- **Type** : sécurité · **Statut** : ✅ (vérifié en conditions réelles : deux comptes, `GET /worlds/<slug-d-autrui>/entities/<id>` → `404` ; cas mauvais `worldId` du même propriétaire testé au service)

## TST-ENT-005 — Édition du contenu d'une fiche avec sauvegarde automatique

- **Description** : le propriétaire écrit dans l'éditeur (titres, gras/italique, listes, citation, lien, image) et le contenu se sauvegarde seul.
- **Objectif** : vérifier la sauvegarde debouncée, l'extraction du texte brut et l'indicateur d'état accessible.
- **Préconditions** : une fiche existe dans un monde de ce propriétaire.
- **Étapes** : 1) Aller sur `/worlds/<slug>/entities/<id>`. 2) Écrire du contenu dans l'éditeur. 3) Attendre la fin du debounce.
- **Résultat attendu** : `Entity.content` (JSON ProseMirror) et `Entity.plainText` (texte extrait) mis à jour en base ; indicateur « Enregistré. » annoncé via `aria-live="polite"`.
- **Critères d'acceptation** : le contenu est rechargé correctement à la prochaine visite de la page ; `plainText` ne contient aucune balise, uniquement le texte.
- **Type** : fonctionnel · **Statut** : ✅ (vérifié en conditions réelles : round-trip complet titre+gras+citation → validation → extraction → persistance → relecture)

## TST-ENT-006 — Parcours bout en bout : inscription → monde → fiche → éditeur → rechargement

- **Description** : un nouvel utilisateur s'inscrit, crée un monde, crée une fiche, écrit dans l'éditeur en le mettant en forme, puis recharge la page — smoke Playwright (`e2e/smoke.spec.ts`) sur un vrai navigateur, isolé sur une base Postgres dédiée (`story_tide_e2e`, remise à zéro avant chaque exécution).
- **Objectif** : couvrir en une seule fois trois classes de bugs invisibles à un test unitaire ou un script `curl`/`tsx` : React StrictMode (montage/démontage de l'éditeur en dev), sérialisation Next.js Flight (le contenu Tiptap traverse la frontière RSC → Client au rechargement), Tailwind Preflight (styles de contenu riche).
- **Préconditions** : conteneur Postgres dev démarré (`docker-compose.dev.yml`) ; `.env.e2e` configuré (copie de `.env.e2e.example`).
- **Étapes** : 1) `/register`, créer un compte (auto-connexion). 2) Créer un monde. 3) Créer une fiche. 4) Écrire du texte dans l'éditeur, le sélectionner, cliquer « Gras ». 5) Attendre l'indicateur « Enregistré. ». 6) Recharger la page.
- **Résultat attendu** : à chaque étape, redirection vers la bonne URL ; le bouton « Gras » reflète `aria-pressed="true"` immédiatement après le clic (synchro toolbar `useEditorState`) ; après rechargement, le texte tapé est toujours visible dans l'éditeur (persistance à travers la frontière RSC → Client).
- **Critères d'acceptation** : `npm run test:e2e` vert ; la base de dev (`story_tide`) reste inchangée pendant et après l'exécution (vérifié par comptage de lignes avant/après) ; la base e2e est repartie de zéro à chaque run (pas d'accumulation de données entre exécutions).
- **Type** : fonctionnel (bout en bout) · **Statut** : ✅ (`e2e/smoke.spec.ts`, vérifié en conditions réelles contre un vrai navigateur Chromium et une vraie base Postgres)

## TST-SEC-004 — Rejet d'un contenu hors du schéma strict de l'éditeur

- **Description** : une requête de sauvegarde envoie un JSON contenant un node désactivé (ex. `codeBlock`) ou structurellement invalide, en contournant l'éditeur réel.
- **Objectif** : vérifier que la validation serveur (pas seulement la configuration du client Tiptap) applique le schéma strict — OWASP A03.
- **Préconditions** : une fiche existe dans un monde de ce propriétaire.
- **Étapes** : 1) Appeler l'action de sauvegarde avec un JSON contenant un `codeBlock` (désactivé) ou un type de node inconnu.
- **Résultat attendu** : la sauvegarde est refusée (« Contenu invalide. »), rien n'est persisté.
- **Critères d'acceptation** : `parseContent()` lève `InvalidContentError` pour tout node/mark hors de l'allowlist (`Node.fromJSON` + `check()` contre le schéma ProseMirror réel) ; testé avec un payload `codeBlock` réel, pas seulement une chaîne de caractères.
- **Type** : sécurité · **Statut** : ✅ (`tiptap-content.test.ts`, `entity-content.test.ts`, vérifié en conditions réelles avec un payload malveillant)

## TST-SEC-005 — Rejet d'un contenu de fiche surdimensionné (mitigation DoS)

- **Description** : une requête de sauvegarde envoie une chaîne JSON de plus de 1 Mo.
- **Objectif** : vérifier que la taille est bornée **avant** tout `JSON.parse`, pas seulement après validation du contenu (OWASP A04).
- **Préconditions** : une fiche existe dans un monde de ce propriétaire.
- **Étapes** : 1) Appeler `saveEntityContentAction` avec une chaîne JSON de plus de 1 000 000 octets.
- **Résultat attendu** : rejet immédiat (« Contenu trop volumineux. »), sans tentative de `JSON.parse` ni appel au service de persistance.
- **Critères d'acceptation** : `Buffer.byteLength(rawContentJson, "utf8")` vérifié avant tout `JSON.parse` ; aucun appel à `updateEntityContent`.
- **Type** : sécurité · **Statut** : ✅ (`entity-content.test.ts`)

## TST-SEC-006 — Rejet d'une image dont le `src` n'est pas une URL http(s)

- **Description** : une requête de sauvegarde envoie un contenu structurellement valide mais dont un node `image` porte un `src` en `javascript:`, `data:`, ou une chaîne qui n'est pas une URL.
- **Objectif** : vérifier que les valeurs d'attributs sont aussi validées côté serveur, pas seulement la structure (OWASP A03) — un contenu peut passer `Node.fromJSON`/`check()` et rester dangereux.
- **Préconditions** : une fiche existe dans un monde de ce propriétaire.
- **Étapes** : 1) Appeler l'action de sauvegarde avec un `image.src` en `javascript:alert(1)` (ou `data:`, ou une chaîne non-URL).
- **Résultat attendu** : la sauvegarde est refusée (« Contenu invalide. »), rien n'est persisté.
- **Critères d'acceptation** : `parseContent()` lève `InvalidContentError` via `assertSafeAttributes`/`isSafeHttpUrl` pour tout `src` dont le protocole n'est pas `http:`/`https:`, ou qui n'est pas une URL syntaxiquement valide.
- **Type** : sécurité · **Statut** : ✅ (`tiptap-content.test.ts`)

## TST-SEC-007 — Rejet d'une image sans texte alternatif (contournement RGAA)

- **Description** : une requête de sauvegarde envoie un node `image` avec un `alt` vide, en contournant le champ obligatoire de l'UI.
- **Objectif** : vérifier que l'exigence RGAA de texte alternatif est aussi imposée côté serveur, pas seulement côté formulaire.
- **Préconditions** : une fiche existe dans un monde de ce propriétaire.
- **Étapes** : 1) Appeler l'action de sauvegarde avec un node `image` dont `attrs.alt` est une chaîne vide.
- **Résultat attendu** : la sauvegarde est refusée (« Contenu invalide. »), rien n'est persisté.
- **Critères d'acceptation** : `parseContent()` lève `InvalidContentError` si `alt` est absent, non-chaîne, ou vide après `trim()`.
- **Type** : sécurité / accessibilité · **Statut** : ✅ (`tiptap-content.test.ts`)

## TST-SEC-008 — Rejet d'un lien dont le `href` n'est pas une URL http(s)

- **Description** : une requête de sauvegarde envoie un mark `link` avec un `href` en `javascript:`.
- **Objectif** : vérifier que la même règle de validation d'URL s'applique au mark `link`, pas seulement au node `image`.
- **Préconditions** : une fiche existe dans un monde de ce propriétaire.
- **Étapes** : 1) Appeler l'action de sauvegarde avec un mark `link` dont `attrs.href` est `javascript:alert(1)`.
- **Résultat attendu** : la sauvegarde est refusée (« Contenu invalide. »), rien n'est persisté.
- **Critères d'acceptation** : `parseContent()` lève `InvalidContentError` pour tout `href` dont le protocole n'est pas `http:`/`https:`.
- **Type** : sécurité · **Statut** : ✅ (`tiptap-content.test.ts`)

## TST-LNK-001 — Une mention détectée crée une Relation origin=AUTO

- **Description** : le texte d'une fiche mentionne le nom (ou un alias) d'une autre entité du même monde.
- **Objectif** : vérifier que la sauvegarde déclenche un job de liaison, que le moteur Aho-Corasick détecte la mention, et qu'une `Relation origin=AUTO` est créée entre les deux fiches.
- **Préconditions** : un monde contient au moins deux entités ; l'une mentionne l'autre dans son contenu.
- **Étapes** : 1) Sauvegarder le contenu de la fiche mentionnant l'autre entité. 2) Laisser le worker traiter le job de liaison (`entity-linking`, `singletonKey=entityId`).
- **Résultat attendu** : une `Relation origin=AUTO` apparaît en base entre la fiche source et l'entité mentionnée.
- **Critères d'acceptation** : `scanAndLinkEntity` crée la relation ; vérifié en conditions réelles (vraie base Postgres, vrai adaptateur pg-boss, vrai worker) — la mention disparaît du texte → la relation `AUTO` correspondante est supprimée au re-scan suivant.
- **Type** : fonctionnel · **Statut** : ✅ (`linker-service.test.ts`, vérifié en conditions réelles)

## TST-LNK-002 — Une Relation origin=MANUAL n'est jamais écrasée par un re-scan automatique

- **Description** : une relation créée manuellement entre deux entités existe, alors que le texte de la fiche source ne mentionne plus (ou n'a jamais mentionné) la cible.
- **Objectif** : garantir la règle dure du projet — un re-scan automatique ne supprime et ne modifie jamais une `Relation origin=MANUAL`, quel que soit le contenu du texte.
- **Préconditions** : une `Relation origin=MANUAL` existe entre deux entités d'un même monde ; le texte de la fiche source ne mentionne pas la cible.
- **Étapes** : 1) Déclencher un re-scan de la fiche source (sauvegarde de contenu). 2) Laisser le worker traiter le job.
- **Résultat attendu** : la `Relation origin=MANUAL` est toujours présente et inchangée après le re-scan.
- **Critères d'acceptation** : `scanAndLinkEntity` ne lit et n'écrit que des relations `origin=AUTO` (filtre explicite sur toutes les requêtes) ; vérifié en conditions réelles.
- **Type** : fonctionnel · **Statut** : ✅ (`linker-service.test.ts`, vérifié en conditions réelles)

## TST-LNK-003 — Garde-fous du scan : auto-mention, `LinkIgnore`, occurrences ambiguës

- **Description** : trois cas où une mention textuelle ne doit **pas** produire de `Relation origin=AUTO` : une fiche qui mentionne son propre nom, une cible explicitement ignorée (`LinkIgnore`), et une occurrence matchant plusieurs entités homonymes aux mêmes bornes.
- **Objectif** : vérifier qu'aucun lien silencieux n'est créé dans ces trois cas (auto-lien absurde, contournement d'un garde-fou utilisateur, ambiguïté non résolue).
- **Préconditions** : selon le cas — une entité dont le nom apparaît dans son propre texte ; une paire `(entityId, targetId)` présente dans `LinkIgnore` ; deux entités de même nom dans le même monde.
- **Étapes** : 1) Sauvegarder un contenu correspondant à l'un des trois cas. 2) Laisser le worker traiter le job.
- **Résultat attendu** : aucune `Relation origin=AUTO` n'est créée pour l'occurrence concernée dans les trois cas.
- **Critères d'acceptation** : couvert par `linker-service.test.ts` (auto-mention exclue, `LinkIgnore` respecté, occurrence ambiguë sans lien). Le marquage « ambigu » cliquable pour trancher (spec §4.4 point 6) reste hors périmètre — backlog KAN-19, nécessite un modèle de données dédié.
- **Type** : fonctionnel · **Statut** : ✅ (`linker-service.test.ts`)

## TST-LNK-004 — Surlignage live des mentions dans l'éditeur, navigation par Ctrl/Cmd+clic et par la liste accessible

- **Description** : pendant la frappe, une mention d'entité existante est soulignée en direct dans l'éditeur (décoration ProseMirror, jamais persistée). Deux chemins de navigation vers la fiche liée : Ctrl/Cmd+clic sur la mention surlignée (clic simple = édition normale, ne navigue jamais), ou la liste « Entités liées » sous l'éditeur (vrais `<Link>`, navigable au clavier/lecteur d'écran).
- **Objectif** : vérifier que le surlignage apparaît sans attendre le worker (scan client), que les deux modes de clic se comportent comme prévu, et que la liste persistée (alimentée par le vrai worker) reflète la relation créée.
- **Préconditions** : un monde contient une entité cible (ex. « Aldric ») ; une autre fiche (source) est en cours d'édition.
- **Étapes** : 1) Taper un texte mentionnant l'entité cible dans l'éditeur de la fiche source. 2) Vérifier que le mot porte la classe `entity-mention` et l'attribut `data-target-id` correspondant. 3) Cliquer simplement sur la mention (sans modificateur). 4) Ctrl/Cmd+cliquer sur la mention. 5) Attendre l'autosave, laisser le worker traiter le job, recharger la page et consulter la liste « Entités liées ». 6) Suivre le lien de la liste.
- **Résultat attendu** : le surlignage apparaît immédiatement (avant tout traitement du worker) ; le clic simple ne change pas d'URL (édition normale) ; le Ctrl/Cmd+clic navigue vers la fiche cible ; la liste « Entités liées » affiche un lien vers la cible une fois le job traité, et ce lien navigue vers la même fiche.
- **Critères d'acceptation** : `tiptap-positions.test.ts` (alignement caractère-exact `plainText` ↔ ProseMirror), `tiptap-link-highlight.test.ts` (décorations correctes : mention connue, ambiguïté/auto-mention/`LinkIgnore` sans décoration, re-scan sur changement de doc), `relation-service.test.ts` (`listOutgoingLinks`) ; vérifié en conditions réelles bout en bout (`e2e/link-highlight.spec.ts`, vrai navigateur Chromium, vrai worker, vraie base Postgres isolée).
- **Type** : fonctionnel (bout en bout) + accessibilité · **Statut** : ✅ (`tiptap-positions.test.ts`, `tiptap-link-highlight.test.ts`, `relation-service.test.ts`, `e2e/link-highlight.spec.ts`)

## TST-LNK-005 — Backlinks : liste « Mentionné par » sur chaque fiche d'entité

- **Description** : sous la liste « Entités liées » (liens sortants), une seconde liste accessible « Mentionné par » affiche toutes les fiches qui mentionnent l'entité courante (relations entrantes, AUTO et MANUAL confondues), symétrique de `listOutgoingLinks`.
- **Objectif** : vérifier que le sens entrant de la relation est résolu et affiché correctement, indépendamment du sens sortant déjà couvert par TST-LNK-004, avec le même niveau d'accessibilité (HTML sémantique, navigation clavier).
- **Préconditions** : deux entités existent dans un monde (A mentionne B) et la relation `AUTO` ou `MANUAL` a été créée entre elles.
- **Étapes** : 1) Ouvrir la fiche B (la cible mentionnée). 2) Consulter la section « Mentionné par ». 3) Vérifier le lien vers A. 4) Ouvrir une fiche sans aucune mention entrante.
- **Résultat attendu** : la fiche B affiche un lien accessible vers A dans « Mentionné par » ; la fiche sans mention entrante affiche l'état vide dédié (« Aucune fiche ne mentionne cette entité pour l'instant. ») plutôt qu'une liste vide silencieuse ; les deux sections (« Entités liées » / « Mentionné par ») ont chacune un `aria-label` distinct pour les lecteurs d'écran.
- **Critères d'acceptation** : `relation-service.test.ts` (`listIncomingLinks` : vide sans requêter les entités, tri par nom, source introuvable omise silencieusement) ; `LinkedEntities` généralisé (`linked-entities.tsx`) couvert par le même rendu que TST-LNK-004 (composant partagé, pas de duplication de markup).
- **Type** : fonctionnel + accessibilité · **Statut** : ✅ (`relation-service.test.ts`)

## TST-LNK-006 — Mentions manuelles @ : popup, insertion, relation MANUAL bidirectionnelle

- **Description** : dans l'éditeur, taper `@` ouvre une popup de suggestion filtrant les entités du monde (accents/casse ignorés) ; sélectionner une entité insère une mention persistée (jamais de texte `@` résiduel), qui se traduit en `Relation origin=MANUAL` à la sauvegarde, visible depuis les deux sens (« Entités liées » et « Mentionné par »).
- **Objectif** : vérifier la popup (ouverture, filtrage, navigation clavier ↑/↓/Entrée/Échap), l'insertion du node, la réconciliation synchrone des `Relation MANUAL` (sans attendre le worker AUTO), et la navigation (clic simple = édition, Ctrl/Cmd+clic = navigation, cohérente avec le surlignage AUTO).
- **Préconditions** : un monde contient une entité cible (nom composé, ex. « Aldric le Vaillant ») ; une autre fiche (source) est en cours d'édition.
- **Étapes** : 1) Taper `@` puis le nom (même composé, espaces compris) de l'entité cible dans l'éditeur de la fiche source. 2) Vérifier la popup filtrée puis valider par Entrée (ou clic). 3) Vérifier le rendu de la mention (classe, `data-target-id`, aucun `@` affiché). 4) Attendre l'autosave. 5) Clic simple sur la mention, puis Ctrl/Cmd+clic. 6) Recharger la fiche source et consulter « Entités liées ». 7) Ouvrir la fiche cible et consulter « Mentionné par ».
- **Résultat attendu** : la popup reste ouverte et filtrée même après un espace dans la requête (`allowSpaces`, cf. ADR-0011) ; la mention insérée est visible immédiatement, sans attendre le worker ; le clic simple ne navigue jamais, le Ctrl/Cmd+clic navigue vers la fiche cible ; « Entités liées » (fiche source) et « Mentionné par » (fiche cible) affichent la relation dès le premier rechargement après l'autosave (réconciliation synchrone, pas de délai comme pour l'AUTO).
- **Critères d'acceptation** : `tiptap-content.test.ts` (`extractMentionedEntityIds`), `relation-service.test.ts` (`reconcileManualMentions` : ajout/suppression, id hors monde ignoré, auto-mention exclue, jamais de lecture/écriture des lignes AUTO), `entity-content.test.ts` (câblage dans `saveEntityContentAction`, échec non-fatal loggué), `tiptap-extensions.test.ts` (`filterMentionSuggestions`), `mention-list.test.tsx` (popup : rendu, navigation clavier, clic) ; vérifié en conditions réelles bout en bout (`e2e/manual-mention.spec.ts`, vrai navigateur Chromium, vraie base Postgres isolée — a révélé le bug `allowSpaces` avant toute mise en recette manuelle).
- **Type** : fonctionnel (bout en bout) + accessibilité + sécurité (revalidation serveur des id mentionnés, OWASP A01) · **Statut** : ✅ (`tiptap-content.test.ts`, `relation-service.test.ts`, `entity-content.test.ts`, `tiptap-extensions.test.ts`, `mention-list.test.tsx`, `e2e/manual-mention.spec.ts`)

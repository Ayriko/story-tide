# Accessibilité — Dossier RGAA — C2.2.3 (ÉLIMINATOIRE)

> Référentiel présenté ET justifié (RGAA retenu). Audit tracé (contrôle manuel Ara/NVDA à planifier ; axe-core automatisé tenté puis reporté, voir ci-dessous).
> État au 2026-07-14 : actions vérifiées manuellement sur les pages existantes
> (login/register/mondes/entités). Audit outillé pas encore en place.

## Référentiel retenu & périmètre

**RGAA** retenu (vs OPQUAST) : référentiel officiel français, aligné WCAG, déjà
introduit au Bloc 1 — continuité assumée plutôt que de changer de référentiel en
cours de route. Pages/écrans audités à ce jour : `/login`, `/register`, `/worlds`,
`/worlds/[slug]`, `/worlds/[slug]/entities/[entityId]`.

## Actions mises en œuvre

Sur le groupe `(app)` (`/worlds`, `/worlds/[slug]`, `/worlds/[slug]/entities/[entityId]`) :

- **Landmarks** : `<header><nav aria-label="Navigation principale">`, `<main
  id="main-content">`, sections `<section aria-labelledby="...">` pour les
  entités, les paramètres du monde et d'une fiche.
- **Lien d'évitement** (« Aller au contenu principal ») visible au focus clavier,
  premier élément atteignable au Tab.
- **Formulaires** (création, renommage, édition d'entité) : mêmes conventions que
  `(auth)` — labels natifs (y compris `<select>` et `<textarea>` pour le type et
  les alias), `aria-invalid`/`aria-describedby`, erreurs dans une région
  `role="alert"`.
- **Suppression** : confirmation en deux étapes avec des `<button type="button">`
  natifs (« Supprimer ce monde »/« Supprimer cette fiche » → « Confirmer la
  suppression » / « Annuler »), jamais de `window.confirm` bloquant — entièrement
  navigable au clavier.
- **Éditeur Tiptap** (`EntityEditor`) : barre d'outils `role="toolbar"
  aria-label="Mise en forme"`, boutons natifs avec `aria-pressed` reflétant l'état
  actif (gras/italique/titre/liste/citation), panneaux lien/image révélés par un
  bouton (pas de `<div>` cliquable), texte alternatif **requis** pour insérer une
  image (bouton désactivé tant que l'alt est vide). État de sauvegarde annoncé via
  `aria-live="polite"` (« Enregistrement… » / « Enregistré. » / erreur), pas de
  changement visuel silencieux pour les lecteurs d'écran.

Sur `LoginForm` / `RegisterForm` (`src/app/(auth)/{login,register}/`) :

- **Éléments natifs** : `<label htmlFor>` / `<input id>`, `<button type="submit">` —
  jamais de `<div>` cliquable.
- **Labels explicites** sur tous les champs (nom, e-mail, mot de passe).
- **Erreurs reliées au champ** : `aria-invalid="true"` + `aria-describedby` pointant
  vers l'id du message d'erreur ; erreur de formulaire dans une région `role="alert"`.
- **`autoComplete`** correct par champ (`email`, `name`, `current-password` /
  `new-password`) — aide les gestionnaires de mots de passe et lecteurs d'écran.
- **Focus visible** : anneau `focus-visible:outline` sur tous les champs/boutons
  (pas de suppression du focus natif).
- **Navigation clavier complète** : Tab/Shift-Tab dans l'ordre logique, soumission
  au clavier — **vérifié manuellement par Aymeric** (pas encore d'audit NVDA).
  - Correction non-régression associée : les champs (hors mot de passe) conservent
    leur valeur saisie après une erreur de soumission — cf.
    `plan-correction-bogues.md` BUG-001.
- **Redirection annoncée** : `/login` et `/register` redirigent immédiatement vers
  `/` si une session est déjà active (pas de contenu inutile affiché puis retiré).

Pas encore construit (n'existe pas dans le code) : alternatives textuelles sur
images **uploadées** (l'insertion se fait par URL en attendant le service d'upload,
étape suivante — l'alt reste déjà obligatoire), navigation clavier du graphe (pas codé).

**Non vérifié cette session (gap assumé, pas silencieux)** : l'éditeur Tiptap n'a
pas été testé au clavier dans un vrai navigateur — l'extension Chrome de pilotage
a de nouveau timeout (voir dev-log). Vérifié à la place : logique de données 100 %
testée (validation, extraction), build de production réussi, chargement réel du
bundle client confirmé par requête HTTP. La navigation clavier réelle de la
toolbar/l'éditeur reste à confirmer manuellement ou via le smoke Playwright
(`e2e/smoke.spec.ts`, fait le 2026-07-15 — parcours fonctionnel, pas encore
d'assertion a11y dédiée, voir ci-dessous).

## Audit & résultats

- **Axe automatisé au niveau composant** : tenté (`jest-axe` dans le job test
  Vitest) à l'étape CI du 2026-07-12, **abandonné** — le matcher
  `toHaveNoViolations` échoue sous Vitest 4 (`expectAssertion.call is not a
  function`, dépendance à des internals Jest non fournis par le package). Pas de
  fix jugé utile d'insister à ce stade (voir `ci.md`).
- **Audit pleine-page à outiller** : le harnais Playwright existe désormais
  (`e2e/smoke.spec.ts`, 2026-07-15 — login → monde → fiche → éditeur, base e2e
  isolée) et lève le blocage Vitest/jsdom (axe fonctionne nativement avec un
  vrai navigateur). L'injection d'`@axe-core/playwright` et l'assertion
  `toHaveNoViolations` sur chaque page du parcours restent
  <!-- TODO, pas encore fait -->. Note : jsdom ne calcule de toute façon pas les
  contrastes (axe les ignore en environnement jsdom), donc le contrôle contraste
  restera de toute façon manuel ou Playwright.
- **Passage manuel Ara + NVDA** : à planifier avant la recette sur staging
  (spec §6) — <!-- TODO, pas encore fait -->.

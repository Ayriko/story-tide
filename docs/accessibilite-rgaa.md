# Accessibilité — Dossier RGAA — C2.2.3 (ÉLIMINATOIRE)

> Référentiel présenté ET justifié (RGAA retenu). Audit tracé (contrôle manuel Ara/NVDA à planifier ; axe-core automatisé tenté puis reporté, voir ci-dessous).
> État au 2026-07-13 : actions vérifiées manuellement sur les pages existantes
> (login/register/mondes). Audit outillé pas encore en place.

## Référentiel retenu & périmètre

**RGAA** retenu (vs OPQUAST) : référentiel officiel français, aligné WCAG, déjà
introduit au Bloc 1 — continuité assumée plutôt que de changer de référentiel en
cours de route. Pages/écrans audités à ce jour : `/login`, `/register`, `/worlds`,
`/worlds/[slug]`.

## Actions mises en œuvre

Sur le groupe `(app)` (`/worlds`, `/worlds/[slug]`) :

- **Landmarks** : `<header><nav aria-label="Navigation principale">`, `<main
  id="main-content">`, sections `<section aria-labelledby="...">` pour les
  paramètres du monde.
- **Lien d'évitement** (« Aller au contenu principal ») visible au focus clavier,
  premier élément atteignable au Tab.
- **Formulaires** (création, renommage) : mêmes conventions que `(auth)` — labels
  natifs, `aria-invalid`/`aria-describedby`, erreurs dans une région `role="alert"`.
- **Suppression** : confirmation en deux étapes avec des `<button type="button">`
  natifs (« Supprimer ce monde » → « Confirmer la suppression » / « Annuler »),
  jamais de `window.confirm` bloquant — entièrement navigable au clavier.

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
images utilisateur (pas de feature d'upload), rendu sémantique du contenu Tiptap
(éditeur pas codé), navigation clavier du graphe (pas codé).

## Audit & résultats

- **Axe automatisé au niveau composant** : tenté (`jest-axe` dans le job test
  Vitest) à l'étape CI du 2026-07-12, **abandonné** — le matcher
  `toHaveNoViolations` échoue sous Vitest 4 (`expectAssertion.call is not a
  function`, dépendance à des internals Jest non fournis par le package). Pas de
  fix jugé utile d'insister à ce stade (voir `ci.md`).
- **Audit pleine-page à outiller** : probablement via le futur job Playwright
  smoke (axe fonctionne nativement avec un vrai navigateur, contourne le souci
  Vitest/jsdom) — <!-- TODO, pas encore construit -->. Note : jsdom ne calcule de
  toute façon pas les contrastes (axe les ignore en environnement jsdom), donc le
  contrôle contraste restera de toute façon manuel ou Playwright.
- **Passage manuel Ara + NVDA** : à planifier avant la recette sur staging
  (spec §6) — <!-- TODO, pas encore fait -->.

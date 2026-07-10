# Accessibilité — Dossier RGAA — C2.2.3 (ÉLIMINATOIRE)

> Référentiel présenté ET justifié (RGAA retenu). Audit tracé (axe-core en CI + contrôle manuel Ara/NVDA).
> État au 2026-07-11 : actions vérifiées manuellement sur les pages existantes (login/register). Audit outillé pas encore en place.

## Référentiel retenu & périmètre

**RGAA** retenu (vs OPQUAST) : référentiel officiel français, aligné WCAG, déjà
introduit au Bloc 1 — continuité assumée plutôt que de changer de référentiel en
cours de route. Pages/écrans audités à ce jour : `/login`, `/register` (les deux
seules pages fonctionnelles existantes).

## Actions mises en œuvre

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

Pas encore construit (n'existe pas dans le code) : structure de landmarks sur
l'ensemble de l'app (une seule page `(auth)` layout existe), alternatives textuelles
sur images utilisateur (pas de feature d'upload), rendu sémantique du contenu Tiptap
(éditeur pas codé), navigation clavier du graphe (pas codé).

## Audit & résultats

<!-- TODO : axe-core arrivera avec la CI (job dédié, cf. ci.md — pas encore construit).
Passage manuel Ara + NVDA à planifier avant la recette sur staging (spec §6). -->

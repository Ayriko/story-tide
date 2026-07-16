# ADR-0010 — Surlignage des liaisons : re-scan côté client plutôt que positions serveur persistées

- **Statut** : accepté
- **Date** : 2026-07-16
- **Décideur** : Aymeric (MOE)

## Contexte et problème

KAN-19 (liaison automatique) écrivait déjà les `Relation origin=AUTO` en base, mais
rien n'était visible côté utilisateur : le différenciateur produit tournait « dans
le noir ». Il fallait (spec §4.4 point 5) surligner les mentions détectées
directement dans l'éditeur, en direct pendant la frappe, et permettre de naviguer
vers la fiche liée.

## Options envisagées

- **Positions calculées et persistées côté serveur** (à chaque scan du worker,
  stocker les bornes `[start,end)` de chaque occurrence en base) puis renvoyées au
  client au chargement de la page. Cohérent avec ce que le worker a réellement
  écrit, mais **jamais à jour pendant la frappe** (il faut attendre le prochain
  scan du worker, asynchrone) — inadapté à un retour visuel « en direct ».
- **Marquage par un mark ProseMirror persisté** (écrire une marque dans le contenu
  Tiptap lui-même à chaque mention détectée). Rejeté d'emblée : modifierait le
  schéma de contenu partagé serveur/client (`getSchema`, `parseContent` — validation
  stricte OWASP A03) pour une information dérivée, pas un fait éditorial ; ferait
  aussi diverger le contenu réellement tapé par l'utilisateur de ce qui est
  persisté.
- **Re-scan LIVE côté client** : réutiliser le moteur `AhoCorasick` (TS pur, zéro
  dépendance, déjà 100 % testé) directement dans le navigateur, à chaque
  transaction qui modifie le document, et convertir les positions en décorations
  ProseMirror (jamais persistées).

## Décision

Re-scan live côté client, avec décorations ProseMirror non persistées :

- Le dictionnaire du monde (`buildDictionary`) est chargé une fois par la page
  serveur et figé à la création de l'extension d'éditeur (mêmes règles StrictMode
  que le reste de l'éditeur — une fabrique par montage, jamais un singleton
  partagé).
- Un module pur (`src/lib/tiptap-positions.ts`, `buildTextWithPositions`) reproduit
  **exactement** le parcours de `generateText`/`getTextBetween` (`@tiptap/core`) —
  même séparateur de bloc synthétique `"\n\n"` — pour garantir que le texte scanné
  est identique caractère-à-caractère à `plainText`, et pour remapper chaque
  position `[start,end)` de l'automate vers une position ProseMirror réelle
  (`occurrenceToRange`). Testé par une identité stricte contre `extractPlainText`
  sur plusieurs formes de documents (multi-blocs, listes imbriquées, marks
  partiels).
- La logique de résolution des cibles (ambiguïté, auto-mention, `LinkIgnore`) est
  extraite dans un module partagé (`resolveLinks`, ADR implicite de l'étape 1 de
  cette session) entre le worker (écrit les `Relation`) et le surlignage (affiche
  les décorations) — ce qui est surligné est donc **exactement** ce qui deviendrait
  une relation au prochain scan serveur, par construction, sans dupliquer la règle.
- Le test de passage à l'échelle déjà écrit pour l'automate (200 entités × ~100 000
  caractères, ~15 ms) prouve que re-scanner à chaque transaction reste largement
  dans le budget perf, même sur un document volumineux.

## Conséquences

- **Positives** : retour visuel instantané, sans dépendre du worker ni d'un
  round-trip serveur ; aucun impact sur le schéma de contenu partagé (les
  décorations ne sont pas persistées, `getSchema`/`parseContent` inchangés) ;
  logique de résolution des cibles partagée avec le worker, zéro divergence
  possible entre « ce qui est surligné » et « ce qui devient un lien ».
- **Négatives (dette assumée)** : léger décalage possible entre le surlignage live
  (instantané) et la liste « Entités liées » persistée (dépend du worker) tant que
  le job de liaison n'a pas été traité — assumé et documenté, les deux convergent
  au repos. Angle mort hérité de `normalizeForMatch` (ADR-0001) : un `toLowerCase()`
  à expansion de longueur (ex. `İ`, `ẞ`) casserait l'alignement caractère-exact ;
  non pertinent pour le français courant, non corrigé ici.

## Compétence(s) servie(s)

C2.2.1 (réutilisation d'un module `src/lib` pur côté client sans dupliquer sa
logique) ; C2.2.3 (le chemin de navigation clavier/lecteur d'écran passe par la
liste accessible « Entités liées », jamais par le surlignage seul — voir
`docs/accessibilite-rgaa.md`) ; C2.4.1 (traçabilité de la décision).

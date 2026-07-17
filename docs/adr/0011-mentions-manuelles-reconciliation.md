# ADR-0011 — Mentions manuelles @ : réconciliation synchrone, coexistence avec AUTO

- **Statut** : accepté
- **Date** : 2026-07-17
- **Décideur** : Aymeric (MOE)

## Contexte et problème

KAN-22 restait à moitié fait après le surlignage (ADR-0010) : la liaison
automatique détecte les mentions déjà écrites, mais rien ne permet à
l'utilisateur de créer une liaison explicite (ex. une entité qui n'existe pas
encore textuellement dans la fiche, ou un surnom non couvert par les alias).
Il fallait une saisie assistée `@`, l'insertion d'un node persisté, et sa
traduction en `Relation` — sans jamais entrer en conflit avec les `Relation
origin=AUTO` déjà écrites par le worker (KAN-19).

## Décisions

- **Node `mention` dans le schéma partagé** (`src/lib/tiptap-extensions.ts`,
  `@tiptap/extension-mention`, officiel Tiptap) : même classe/attribut DOM que
  le surlignage live (`tiptap-mention-attrs.ts`), pour réutiliser le
  gestionnaire Ctrl/Cmd+clic existant sans dupliquer de logique de navigation.
  Rendu **sans préfixe `@` visible** (retour utilisateur en session : le `@`
  n'est qu'un déclencheur de saisie, pas une partie du texte — le rendu reste
  ainsi visuellement identique au surlignage AUTO, qui n'ajoute jamais de
  caractère).
- **`renderText: () => ""`** : le comportement par défaut de l'extension
  (`"@Label"`) serait inclus par `extractPlainText` (`generateText` invoque le
  `renderText` de chaque node atome), et le nom de l'entité mentionnée
  réapparaîtrait alors dans le `plainText` scanné par le worker AUTO — la
  mention manuelle se re-matcherait elle-même comme une fausse nouvelle
  occurrence. Le surlignage live côté client (`buildTextWithPositions`) ignore
  déjà nativement les nodes non textuels ; ce choix aligne `extractPlainText`
  sur le même comportement plutôt que de laisser les deux mécanismes diverger.
- **Coexistence AUTO/MANUAL, jamais de collision** : la contrainte
  `@@unique([sourceId, targetId, origin])` (déjà en place) fait cohabiter une
  ligne AUTO et une ligne MANUAL pour le même couple source/cible comme deux
  lignes distinctes — aucun risque d'écraser l'une avec l'autre, par
  construction du schéma, sans logique de garde supplémentaire à écrire.
- **Réconciliation SYNCHRONE à la sauvegarde** (`reconcileManualMentions`,
  `src/services/relation-service.ts`, appelée depuis
  `saveEntityContentAction`), contrairement au scan AUTO (asynchrone, via le
  worker) : une mention manuelle est une intention explicite de l'utilisateur,
  peu nombreuses par fiche — le diff ajout/suppression (même patron que
  `scanAndLinkEntity`) reste largement dans le budget perf en le faisant dans
  la requête de sauvegarde elle-même. Un échec est loggué (jamais avalé) mais
  ne fait pas échouer la sauvegarde du contenu, déjà persisté à ce stade (même
  traitement que l'échec d'enfilage du job AUTO).
- **Jamais de confiance dans les id envoyés par le client** : les id de
  mentions extraits du contenu sont revalidés contre une vraie requête
  (`entity.findMany({ where: { id: { in }, worldId } })`) avant toute écriture
  de `Relation` — un id d'une autre fiche/monde ne peut jamais créer de lien
  (OWASP A01). L'auto-mention est filtrée défensivement côté service, même si
  l'UI l'exclut déjà de la liste de suggestion.
- **`allowSpaces: true`** sur la configuration `@tiptap/suggestion` : trouvé en
  écrivant le test e2e (`manual-mention.spec.ts`), pas reproduit manuellement
  (l'utilisateur avait sélectionné sans taper d'espace). Sans cette option, la
  popup de suggestion se ferme dès le premier espace tapé dans la requête (son
  regex de correspondance exclut `\s` par défaut) — inutilisable pour la
  plupart des noms d'entités, qui contiennent des espaces.

## Conséquences

- **Positives** : aucune divergence possible entre surlignage live et
  `plainText` persisté ; navigation/rendu de la mention manuelle entièrement
  réutilisés (zéro nouveau code de clic/affichage) ; la réconciliation
  synchrone rend « Entités liées »/« Mentionné par » à jour dès l'enregistrement
  (pas de délai comme pour l'AUTO, qui dépend du worker) ; le module
  d'extraction (`extractMentionedEntityIds`) est pur et testé isolément.
- **Négatives (dette assumée)** : le node `mention` porte un `label`
  dénormalisé (recopié à l'insertion) — si l'entité est renommée ensuite, la
  mention affichée garde l'ancien nom jusqu'à sa prochaine réécriture par
  l'utilisateur (pas de mise à jour rétroactive du contenu ; hors périmètre
  S30, à noter si le besoin remonte).

## Compétence(s) servie(s)

C2.2.1 (réutilisation de `resolveLinks`/du gestionnaire de clic existants,
patron diff déjà établi par `scanAndLinkEntity`) ; C2.2.3 (revalidation
serveur des id, jamais de confiance dans l'input client — OWASP A01) ;
C2.3.1 (bug trouvé et corrigé par le test e2e avant livraison, plutôt qu'en
recette manuelle) ; C2.4.1 (traçabilité de la décision).

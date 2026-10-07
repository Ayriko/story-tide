---
name: unicode-normalize-index-remap
description: >
  Lien automatique manquant ou surlignage décalé sur des textes accentués,
  soupçon Unicode NFC/NFD dans le moteur de liaison. Déclencheurs : NFC, NFD,
  normalize(), accents décomposés, marques combinantes, positions décalées,
  index calculés sur texte normalisé, normalizeForMatch, Aho-Corasick,
  isWordChar, frontière de mot, surlignage décalé, longueur différente après
  normalisation, ADR-0020, normaliser à la frontière.
---

# Positions calculées sur un texte normalisé, réutilisées sur l'original

## Le symptôme

Une mention **non accentuée** disparaît silencieusement des résultats (pas de
`Relation AUTO`, pas de surlignage) quand un texte en forme décomposée (NFD,
ex. collé depuis macOS) apparaît **plus tôt** dans le même document. La
détection NFC/NFD croisée, elle, fonctionne : l'hypothèse « l'accent n'est pas
reconnu » est fausse.

## La cause (ADR-0020, 22/07/2026)

`normalizeForMatch` fait `.normalize("NFD").replace(/\p{M}/gu, "")` sur la
chaîne **entière**. Pour un texte déjà en NFD, les marques combinantes
autonomes sont retirées : la chaîne normalisée est **plus courte** que
l'original. `AhoCorasick.search()` calcule ses indices dessus puis les
réutilise contre le texte original — y compris pour la frontière de mot
(`isWordChar(text[start-1])`, `text[end]`). Décalage d'un caractère par
accent NFD rencontré, et la mention suivante est rejetée.

**Invariant à tenir** : 1 caractère du texte original ↔ exactement
1 caractère de la chaîne normalisée. Il tient pour du NFC (NFD interne puis
strip recompose à l'identique) et casse dès qu'une marque combinante autonome
entre.

## La solution retenue : normaliser **à la frontière**, pas dans le moteur

- `entity-service.ts` : `name` et `aliases` passés en `.normalize("NFC")` à
  la création et à la mise à jour.
- `tiptap-content.ts` → `normalizeContentText()` : tous les nœuds texte en
  NFC **au même endroit** que `extractPlainText`, juste avant elle, dans
  `saveEntityContentAction`. Le `content` persisté et le `plainText` dérivent
  du même contenu déjà normalisé.

Le moteur (`aho-corasick.ts`, `normalize.ts`) n'est **pas** touché : il ne
reçoit plus jamais de NFD.

## Ce qui a été écarté, et pourquoi

- Un `.normalize("NFC")` **dans** `normalizeForMatch` : change lui aussi la
  longueur par rapport au texte déjà stocké (2 caractères NFD → 1 NFC). Même
  invariant cassé, une étape plus loin : surlignages décalés au lieu d'un
  lien manquant. Pire.
- Une carte d'index normalisé → original : disproportionnée sur un module
  gelé et couvert à 100 %.
- NFKD (ligatures `œ`/`æ` dépliées) : change la longueur, interdit (ADR-0001).

## Règle

Face à un soupçon NFC/NFD, chercher d'abord **où des positions changent de
référentiel**, pas si la détection marche. Toute normalisation qui peut
changer la longueur se fait à l'entrée des données (persistance), jamais dans
un pipeline qui produit des index. Et contrôler les données existantes (dev,
puis staging/prod) avant de conclure qu'aucune migration n'est nécessaire.

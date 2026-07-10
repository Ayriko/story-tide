# ADR-0001 — Ligatures non dépliées dans le moteur de liaison (Aho-Corasick)

- **Statut** : accepté
- **Date** : 2026-07-03
- **Décideur** : Aymeric (MOE)

## Contexte et problème

Le moteur de liaison automatique (`src/lib/linker/`, pas encore codé) doit détecter
des occurrences de noms/alias d'entités dans le `plainText` des fiches, puis renvoyer
des **positions de caractères** au client pour surligner ces occurrences dans
l'éditeur (décorations ProseMirror). Le français utilise des ligatures (`œ`, `æ`) —
se pose la question de les « déplier » (normaliser `œ` → `oe`) avant indexation pour
assouplir le matching (« Cœur » ≈ « Coeur »).

## Options envisagées

- **Déplier les ligatures** avant indexation (normaliser `œ`→`oe`, `æ`→`ae`) : matching
  plus permissif, mais la longueur de la chaîne normalisée diffère de l'original — les
  positions de caractères calculées par l'automate ne correspondent alors plus
  exactement aux positions dans le `plainText` d'origine, cassant l'alignement du
  surlignage.
- **Ne pas déplier** : l'automate travaille sur le texte strictement tel qu'il
  apparaît, sans normalisation de ligatures.

## Décision

Ne pas déplier les ligatures. L'alignement caractère-exact entre les positions
renvoyées par l'automate et le `plainText` source est non négociable (c'est ce qui
permet au client de positionner les décorations de surlignage sans recalcul). Le prix
assumé : « Cœur » et « Coeur » ne matcheront pas automatiquement l'un l'autre —
contournable en ajoutant les deux graphies dans `Entity.aliases[]`.

## Conséquences

- **Positives** : positions caractère-exactes garanties pour le surlignage ; pas de
  table de normalisation à maintenir ni à tester — un module qui doit être couvert à
  100 % reste plus simple.
- **Négatives (dette assumée)** : les variantes orthographiques avec/sans ligature ne
  sont pas reconnues comme équivalentes sans alias explicite.

## Compétence(s) servie(s)

C2.4.1 (traçabilité) ; C2.2.1 (paradigme du module `src/lib/linker`, TS pur, zéro
dépendance).

# ADR-0020 — Normalisation Unicode NFC du moteur de liaison : à la frontière, pas dans le moteur

- **Statut** : accepté
- **Date** : 2026-07-22
- **Décideur** : Aymeric (MOE)

## Contexte et problème

Session de diagnostic (hypothèse initiale : un texte saisi en forme Unicode **décomposée**
NFD — un accent est alors un caractère combinant séparé, ex. copier-coller depuis macOS ou
un export d'app de notes — pourrait échapper silencieusement à la détection automatique si
l'entité correspondante est enregistrée en forme **précomposée** NFC, ou l'inverse).

Le diagnostic (`src/lib/linker/aho-corasick.test.ts`) a établi les faits suivants :
- Le contenu matche correctement dans les deux sens (NFC/NFD croisés) — l'hypothèse
  initiale, dans sa forme littérale, est fausse.
- Mais `normalizeForMatch` (`normalize.ts`) applique `.normalize("NFD").replace(/\p{M}/gu,
  "")` sur **la chaîne entière en un seul appel**, pas caractère par caractère. Pour un
  texte **déjà** en forme NFD, cette opération **réduit** la longueur de la chaîne
  normalisée par rapport au texte original (les marques combinantes déjà présentes sont
  retirées). `AhoCorasick.search()` calcule ses indices sur cette chaîne normalisée puis
  les réutilise tels quels contre le texte **original** — y compris pour la vérification de
  frontière de mot (`isWordChar(text[start-1])`, `text[end]`). Conséquence observée : un
  texte NFD plus tôt dans le document décale la frontière de mot d'une mention **ultérieure
  et non accentuée**, la faisant rejeter et disparaître silencieusement des résultats —
  donc jamais de `Relation origin=AUTO`, ni de surlignage. Pas seulement pour l'entité
  accentuée : pour n'importe quelle autre entité mentionnée plus loin dans le même texte.

**Invariant visé** (ce que `normalizeForMatch` doit garantir pour que l'alignement des
positions reste correct) : **1 caractère du texte original doit toujours correspondre à
exactement 1 caractère de la chaîne normalisée**. Cet invariant est déjà vérifié par les
tests existants (`normalize.test.ts`) pour un texte **déjà en forme NFC** — la NFD interne
décompose puis le strip des marques combinantes recompresse à l'identique, caractère pour
caractère. Il **casse** uniquement si le texte reçu contient déjà des marques combinantes
autonomes (forme NFD), cas non couvert avant ce diagnostic.

## Options envisagées

- **A — Corriger dans le moteur** (`aho-corasick.ts`/`normalize.ts`), par ex. une carte
  d'index explicite entre positions normalisées et positions originales, ou un
  `.normalize("NFC")` ajouté dans `normalizeForMatch` avant l'étape NFD existante —
  écartée. D'une part, ampleur disproportionnée sur un module gelé et déjà couvert à 100 %
  avant la certification. D'autre part — point vérifié, pas supposé — un `.normalize("NFC")`
  ajouté **dans le pipeline de matching** ne résout rien : il change lui aussi la longueur
  de la chaîne scannée par rapport au texte **déjà stocké** (une séquence NFD de 2
  caractères devient 1 caractère NFC), cassant le même invariant d'alignement, juste
  déplacé d'une étape — les surlignages seraient décalés au lieu d'un lien manquant, un
  résultat pire, pas meilleur.
- **B — Corriger à la frontière applicative** (persistance) : normaliser en NFC le nom et
  les alias au moment de leur enregistrement (`entity-service.ts`), et les nœuds texte du
  corps Tiptap au moment de l'extraction du `plainText` (`tiptap-content.ts`,
  `saveEntityContentAction`) — **retenue**. Le moteur ne reçoit alors plus jamais de texte
  en forme NFD : l'invariant caractère-exact, déjà vérifié pour du NFC, tient toujours.
  Aucune modification de `aho-corasick.ts` ni de `normalize.ts`.
- **C — Ne rien faire, documenter comme limite connue** — écartée : le diagnostic a montré
  un impact réel sur le différenciateur produit (lien manquant silencieux), pas seulement
  théorique ; le correctif à la frontière est peu coûteux et sans risque de régression sur
  le moteur.

## Décision

Normaliser en NFC à la frontière applicative (option B) : `entity-service.ts`
(`createEntity`/`updateEntity`, sur `name` et chaque valeur d'alias) et `tiptap-content.ts`
(nouvelle fonction pure `normalizeContentText`, appliquée aux nœuds texte du contenu Tiptap
juste avant `extractPlainText` dans `saveEntityContentAction` — le corps persisté et le
`plainText` qui en est extrait dérivent ainsi du même contenu déjà normalisé, jamais l'un
normalisé et l'autre non). `aho-corasick.ts` et `normalize.ts` restent intouchés : le
moteur continue de recevoir la garantie qu'il a toujours eue (texte déjà NFC), simplement
cette garantie est désormais vraie même quand la donnée d'origine était en NFD.

Le test de diagnostic (`aho-corasick.test.ts`) reste committé : la limite du moteur pur,
isolé, face à du texte non normalisé est conservée comme documentation d'une
caractéristique connue et assumée (pas un bug ouvert), complétée par un test de
non-régression qui prouve, sur le même scénario exact, qu'un texte déjà NFC (ce que la
frontière garantit désormais) ne perd plus aucun match.

**Limite du corollaire ligatures (œ/æ)** : `normalizeForMatch` utilise NFD (décomposition
canonique) et non NFKD (compatibilité), précisément pour ne **pas** déplier les ligatures
— une décision déjà actée et documentée dans **ADR-0001**, non remise en cause ici. Les
deux limites sont liées par le même principe (préserver l'alignement caractère-exact) mais
restent des décisions distinctes : ADR-0001 pour les ligatures (non résolu, dette
assumée), cet ADR pour la forme NFC/NFD (résolu à la frontière).

**Vérification des données existantes** : contrôle ponctuel (script jetable, jamais
committé) sur la base de développement locale — 17 entités, 0 alias, aucune donnée en
forme non-NFC. Aucune migration de rattrapage n'a donc été nécessaire pour cet
environnement. Ce contrôle n'a pas pu être exécuté contre staging/production depuis cette
session (accès non disponible) — à rejouer avant toute bascule si des données antérieures
à ce correctif existent dans ces environnements.

## Conséquences

- **Positives** : élimine le cas réel diagnostiqué (lien manquant en cascade) sans toucher
  au moteur de liaison ni à sa couverture de test existante (100 %, gelée avant
  certification) ; la correction est localisée à deux points d'écriture déjà clairement
  identifiés (service de persistance, pipeline de sauvegarde du contenu) ; le test de
  diagnostic devient un test de non-régression permanent sur exactement le scénario
  observé.
- **Négatives / à surveiller** : la normalisation ne s'applique qu'**à la sauvegarde** —
  le surlignage live côté client (avant tout autosave, texte encore en mémoire dans
  l'éditeur) peut transitoirement afficher le même comportement si un texte NFD vient
  d'être collé et n'a pas encore été sauvegardé ; ce résidu n'a pas été traité dans cette
  session (hors périmètre explicitement fixé : le pipeline client live n'est pas touché) et
  reste une limite connue, à réévaluer si elle s'avère gênante en usage réel. Les données
  déjà persistées avant ce correctif (si elles contenaient du NFD) ne sont pas
  rétroactivement corrigées — vérifié absent en développement, à revérifier ailleurs.

## Compétence(s) servie(s)

C2.2.1 (architecture — frontière service/action vs module `src/lib/linker` gelé) ; C2.2.2
(tests — non-régression sur un bug réellement diagnostiqué) ; C2.4.1 (traçabilité de la
décision et de son lien avec ADR-0001).

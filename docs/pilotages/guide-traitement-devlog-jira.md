# Guide — Traiter une entrée de dev-log & piloter le Jira

But : reproduire, à l'identique et sans dérive, le rituel « une entrée de dev-log
arrive → retour + mise à jour du board Jira ». À suivre pas à pas à chaque fois
qu'Aymeric dit « j'ai redéposé le dev-log, fais comme d'habitude ».

---

## 0. Contexte fixe (à connaître avant de commencer)

**Jira**
- Site / cloudId : `story-tide.atlassian.net` · Projet : **KAN** (team-managed, Kanban).
- Colonnes et **transition IDs** (globaux, valables pour toutes les issues) :

  | Colonne | Transition ID |
  |---|---|
  | Backlog | `11` |
  | À faire | `21` |
  | En cours (WIP 4) | `31` |
  | Revue | `41` |
  | Terminé | `51` |

- **Limite WIP = 4** sur « En cours ». Ne pas la dépasser sans le signaler à Aymeric.
- Champ Story points : `customfield_10016`.
- Épics = lots B1 : KAN-1 (Infra/CI), KAN-2 (Wiki & éditeur), KAN-3 (Liaison auto),
  KAN-4 (Wiki avancé), KAN-5 (Cartes/timelines), KAN-6 (Import/Export/polish/Electron).

**Dev-log**
- Le fichier `dev-log.md` vit dans les **fichiers du projet Claude** (pas dans le repo).
  Il est **volumineux (~90 k tokens)** → **ne jamais le régénérer en entier**.
- Les entrées archivées côté repo sont dans `docs/pilotages/devlogs/`.

**Règle Git (non négociable)**
- Claude **ne fait jamais** `commit` / `push` / `merge` / `tag`. Lecture seule
  (`git status/diff/log`) OK. On prépare, Aymeric exécute.

---

## 1. Traiter la nouvelle entrée de dev-log

1. **Localiser la dernière entrée** : chercher le dernier `^### Session — <date>` dans
   `dev-log.md` (une session peut avoir plusieurs parties « (suite) »). Prendre la plus
   récente non encore traitée.
2. **La lire en entier** (Thèmes, Décisions, Gotchas, Commandes, Livrables, Avancement
   certif, À faire). Ne pas se fier au résumé : le signal est dans les gotchas et les
   commits.
3. **Écrire un retour court** (2-4 paragraphes max, pas de pavé) :
   - 2-3 points forts **concrets** (surtout ce qui sert la certification : preuves
     d'attaque rejetées, tests d'échelle, décisions tracées en ADR, honnêteté sur un gap).
   - Les **candidats skills** que l'entrée signale (« Candidat skill : … ») → proposer
     de les extraire (format court, in-repo `.claude/skills/<nom>/SKILL.md`).
   - 1 **point d'action** réel si l'entrée en révèle un (ex. hook pre-commit manquant).
   - Ton : direct, honnête, pas de flatterie.

---

## 2. Mettre à jour le board Jira

1. **Cartographier** le travail de la session → stories KAN concernées (via les
   références dans l'entrée : features, commits, PR, « Avancement certification »).
2. **Choisir la bonne colonne** selon les règles ci-dessous (§3).
3. **Déplacer** (`transitionJiraIssue`) et **commenter** chaque story touchée. Le
   commentaire doit être **traçable** : date, commit(s), PR#, ce qui est fait, ce qui reste.
4. **Respecter le WIP 4**. Si l'ajout ferait 5, le signaler et proposer de sortir/fermer
   une story, ou demander à Aymeric.
5. **Terminer par une section `Sources:`** avec les liens `https://story-tide.atlassian.net/browse/KAN-XX`.

---

## 3. Règles de décision — dans quelle colonne ?

| Situation réelle | Colonne |
|---|---|
| Pas commencé | Backlog / À faire |
| Socle posé (port, squelette, 1ʳᵉ brique) mais périmètre incomplet | **En cours** |
| Code **complet** et poussé sur une `feat/*`, **PR pas encore mergée** | **Revue** |
| **Mergé sur `main`** / livrable complet et vérifié | **Terminé** |
| Livrable principal mergé mais **reste un résiduel** | Fermer + **reporter le résiduel** sur la story de suite (commentaire sur les deux) |

**Principes**
- **Honnêteté avant tout** : une story partielle **reste** En cours ; ne jamais gonfler
  un statut. Quand c'est un jugement (ex. « le cœur est mergé, le reste relève d'une autre
  story »), **le poser à Aymeric** plutôt que trancher en silence.
- **Poussé direct sur `main`** (sans PR) : pas de Revue → En cours si incomplet, Terminé
  si complet.
- **Ne jamais écraser une décision d'Aymeric** (ex. « l'auth n'est pas finie » → KAN-12
  reste En cours quoi qu'il arrive).
- Une story fermée qui laisse du reste : **commenter la story de suite** pour absorber
  explicitement le périmètre (aucun travail perdu).

---

## 4. Skills candidates

- Si l'entrée signale un « Candidat skill », **proposer** de l'extraire (ne pas le faire
  d'office). Format : court, un seul gotcha, `.claude/skills/<nom>/SKILL.md`, avec une
  `description` riche en déclencheurs (mots-clés) pour le matching.
- Déjà produites : `pgboss-singleton-dedup`, `signals-verify-on-linux`. Candidates
  restantes vues au fil de l'eau : RSC→Client `.toJSON()`, headless-editor/Tailwind
  Preflight, CRLF/`.gitattributes` — à écrire de préférence **en session Claude Code**,
  au moment de toucher le code concerné.

---

## 5. Mettre à jour le dev-log lui-même (si demandé « mets à jour le log »)

- **Ne jamais supprimer / réécrire** l'existant — uniquement **enrichir**.
- **Enrichir les sections thématiques** du haut (Setup, Commandes utiles, Erreurs &
  Solutions, Décisions techniques) : ajouter des **lignes** aux tableaux concernés.
- **Ajouter une entrée datée** dans le « Journal des sessions » (Thèmes / Décisions /
  Gotchas / Commandes / Livrables / Avancement certif / À faire).
- **Le fichier est trop gros pour être régénéré en entier** → livrer un **fichier-patch**
  (entrée + lignes à coller) via `present_files`, pas une réécriture complète.
- Les décisions structurantes → aussi un **ADR** dans `docs/adr/` (contexte, décision,
  alternatives, conséquences) pour C2.4.1.

---

## 6. Garde-fous

- **Git** : ne rien committer/pousser. Préparer les commandes, Aymeric exécute.
- **Ne rien inventer** : si l'état d'une PR n'est pas vérifiable (pas de connecteur GitHub
  autorisé, `gh` absent du bac à sable de l'agent), le **dire** et s'en tenir au vérifiable
  (`git log`, branches mergées).
- **Citations** : toute affirmation tirée du Jira → section `Sources:` avec les liens.
- **Concision** : le retour et les récaps restent courts ; le board et les commentaires
  portent le détail.

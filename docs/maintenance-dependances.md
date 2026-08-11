# Processus de mise à jour des dépendances — C4.1.1

> Créé le 2026-08-11 (KAN-42). Ce document formalise la politique de maintenance
> des dépendances telle qu'elle est réellement pratiquée sur Story Tide, et fixe
> les trois paramètres exigibles d'un processus de mise à jour : **fréquence**,
> **périmètre**, **type**.

## 1. Politique en un tableau

| Paramètre | Politique | Détail |
|---|---|---|
| **Fréquence** | Revue **mensuelle** planifiée + canal **sécurité immédiat** + veille **continue** | Revue groupée le premier lundi du mois (§3). Un avis de sécurité touchant une version présente au lockfile court-circuite la cadence : traitement immédiat (§5). La veille (§4) tourne au fil de l'eau. |
| **Périmètre** | Toute la surface réellement déployée | Packages npm (dependencies **et** devDependencies — la chaîne de build fait partie de la surface d'attaque, cf. §6) ; images Docker de base (`node:24-slim`, `postgres:16-alpine`, `minio/minio`, `postgres:16-alpine` du service backup) ; Traefik ; actions GitHub des workflows CI/CD. |
| **Type** | **Manuel, outillé** | Aucune montée de version automatique. Chaque bump suit le circuit standard du projet : branche → gates complets (lint, typecheck, tests + couverture, e2e) → pull request → merge → livré au tag suivant. Une mise à jour de dépendance est un changement comme un autre : elle est vérifiée comme tel. |

## 2. Le socle : lockfile + `npm ci`

L'invariant qui rend tout le reste fiable : **ce qui tourne est exactement ce que
décrit `package-lock.json`**.

- `package.json` déclare des ranges (majoritairement caret `^`, quelques versions
  exactes pour les couples sensibles : `next`/`eslint-config-next`,
  `react`/`react-dom`, `@tiptap/extension-link`/`@tiptap/html`). Le **lockfile
  committé** fige la résolution : les ranges n'introduisent aucune dérive tant
  qu'aucun `npm install`/`npm update` volontaire n'est lancé.
- La CI et les images Docker installent par **`npm ci`** : installation
  strictement conforme au lockfile, échec sinon. Aucune résolution de version ne
  se produit au build ou au déploiement.
- Conséquence opérationnelle : une montée de version est toujours un **diff de
  lockfile lisible et revu**, jamais un effet de bord silencieux — et vérifier
  une exposition à une vulnérabilité revient à comparer des **versions exactes**
  (§4, la leçon de l'incident Shai-Hulud).

## 3. La revue mensuelle

Premier lundi du mois, timeboxée :

1. `npm outdated` — inventaire des retards (direct + transitif notable).
2. Lecture des notes de version des candidats : breaking changes, correctifs de
   sécurité, changements de comportement. Les majors ne sont **jamais** prises
   « parce qu'elles existent » : une major sans bénéfice identifié attend.
3. Branche `chore/deps-AAAA-MM`, bumps groupés par famille (ex. `@tiptap/*`
   ensemble — leurs versions doivent rester alignées), `npm install` ciblé.
4. Gates complets locaux puis CI (lint `--max-warnings=0`, `tsc --noEmit`,
   tests + seuil de couverture 80 % bloquant, e2e Playwright).
5. Pull request, revue du diff de lockfile, merge. Livraison au tag suivant
   (staging via `-rc.N`, production après approbation — chaîne CD standard).
6. Côté infra, à la même cadence : tags des images de base des Dockerfiles et
   version de Traefik — mêmes règles (notes de version, staging d'abord).

## 4. La veille — exercée en conditions réelles (Shai-Hulud, 04/08/2026)

La veille s'appuie sur les avis de sécurité de l'écosystème (GitHub advisories,
canaux npm, flux spécialisés). Elle a été exercée sur une attaque réelle de la
chaîne d'approvisionnement, documentée au dev-log (session du 2026-08-04) :

- **Contexte** : 2ᵉ vague « Shai-Hulud » — versions malveillantes publiées pour
  `keyv`, `flat-cache`, `file-entry-cache`, `cacheable`… (+ ~400 packages
  contaminés), hook `preinstall` voleur de credentials, auto-propagation via les
  droits de publication volés.
- **Exposition plausible** : la chaîne ESLint du projet dépend de la famille
  visée (`file-entry-cache` → `flat-cache` → `keyv`) — la vérification n'était
  pas théorique.
- **Vérification menée** (résultat : **non exposé**) : versions exactes du
  lockfile comparées aux versions compromises (toutes antérieures) ; recherche
  des marqueurs d'infection dans `node_modules` et des hooks implantés ; fenêtre
  d'infection croisée avec les dates d'installation (aucun install pendant
  l'attaque).
- **Règles retenues** :
  1. Le contrôle d'exposition se fait sur les **versions exactes du lockfile**,
     jamais sur les noms de packages ni les ranges (les tags npm ont bougé
     pendant l'incident).
  2. En période d'attaque active : aucun `npm update` ni nouvel install ; si
     indispensable, `npm ci` (strictement le lockfile) ou `--ignore-scripts`.

## 5. Canal sécurité (hors cadence)

Quand un avis touche une version présente au lockfile : évaluation immédiate de
l'exploitabilité dans le contexte réel du projet (la dépendance est-elle sur un
chemin exposé ?), bump ciblé sur branche dédiée, gates complets, tag correctif
— la chaîne CD standard sait livrer un correctif en production dans la journée
(démontré par BUG-006, cf. `docs/plan-correction-bogues.md`). L'évaluation et la
décision sont tracées (dev-log + `docs/securite-owasp.md`, ligne A06).

## 6. Pourquoi les devDependencies sont dans le périmètre

L'incident Shai-Hulud l'illustre : la compromission visait la **chaîne de
build** (famille ESLint), pas le runtime. Un hook d'installation malveillant
s'exécute sur le poste de développement et dans la CI avec accès aux secrets de
publication. Le périmètre de maintenance couvre donc l'intégralité du lockfile,
sans hiérarchie « prod > dev ».

## 7. Automatisation : écartée à ce stade, critère de bascule posé

**Dependabot / Renovate — écartés (2026-08-11)** : sur un rythme d'équipe
réduite, le flux de pull requests automatiques coûte plus cher en revue réelle
que la revue mensuelle groupée, pour un gain de fraîcheur marginal — la sécurité
étant déjà couverte par le canal immédiat (§5). Un `npm audit` automatisé en CI
reste au backlog (cf. A06) comme complément à faible coût.

**Critère de bascule** (réversible, comme toute décision du projet) : si plus
d'**un avis critique par mois** touche le projet, ou si le volume de dépendances
directes rend la revue mensuelle > ½ journée, **Renovate est activé en mode
groupé** (une PR hebdomadaire agrégée, jamais une PR par package).

---

*Références : `docs/securite-owasp.md` (A06, A08), dev-log session 2026-08-04
(vérification Shai-Hulud), `docs/plan-correction-bogues.md` (BUG-006 — la chaîne
de correctif), manuels de déploiement et de mise à jour (`docs/manuels/`).*

# Plan du dossier écrit — Story Tide (Bloc 2, 30 pages max)

> **Principe** : le dossier n'est pas rédigé d'un bloc — il **assemble et éditorialise** les briques `/docs/`.
> **Structure = la grille** : une section par compétence, **intitulé officiel en titre**, dans l'ordre C2.1.1 → C2.4.1,
> pour que l'évaluateur coche en lisant. (Pattern confirmé par un dossier Bloc 2 validé.)
> Budgets de pages = **indicatifs, à arbitrer par Aymeric** (total ≤ 30 p. hors garde/sommaire).

## Ossature

| # | Section | Source(s) `/docs/` | Élim. | Pages (indic.) |
|---|---|---|---|---|
| — | Page de garde | — | — | — |
| — | Table des matières | — | — | — |
| 0 | **Contexte projet** (MOA Tidemark / MOE · problématique du liage manuel · différenciateur Aho-Corasick) | (dossier B1) | — | ≈ 1 |
| 1 | **C2.1.1** — Mettre en œuvre des environnements de déploiement et de test en y intégrant les outils de suivi de performance et de qualité afin de permettre le bon déroulement de la phase de développement du logiciel | `cd.md`, `qualite-performance.md` | non | ≈ 3 |
| 2 | **C2.1.2** — Configurer le système d'intégration continue dans le cycle de développement du logiciel en fusionnant les codes sources et en testant régulièrement les blocs de code afin d'assurer un développement efficient qui réduit les risques de régression | `ci.md` | non | ≈ 2 |
| 3 | **C2.2.1** — Concevoir un prototype de l'application logicielle en tenant compte des spécificités ergonomiques et des équipements ciblés (ex : web, mobile…) afin de répondre aux fonctionnalités attendues et aux exigences en termes de sécurité | `architecture.md` | **OUI** | ≈ 6 |
| 4 | **C2.2.2** — Développer un harnais de test unitaire en tenant compte des fonctionnalités demandées afin de prévenir les régressions et de s'assurer du bon fonctionnement du logiciel | `tests-unitaires.md` | **OUI** | ≈ 3 |
| 5 | **C2.2.3** — Développer le logiciel en veillant à l'évolutivité et à la sécurisation du code source, aux exigences d'accessibilité et aux spécifications techniques et fonctionnelles définies, pour garantir une exécution conforme aux exigences du client | `securite-owasp.md`, `accessibilite-rgaa.md` | **OUI** | ≈ 5 |
| 6 | **C2.2.4** — Déployer le logiciel à chaque modification de code et de façon progressive en vérifiant la performance fonctionnelle et technique auprès des utilisateurs afin de présenter une solution stable et conforme à l'attendu | `cd.md`, `../CHANGELOG.md` | non | ≈ 2 |
| 7 | **C2.3.1** — Élaborer le cahier de recettes en rédigeant les scénarios de tests et les résultats attendus afin de détecter les anomalies de fonctionnement et les régressions éventuelles | `cahier-recettes.md` | **OUI** | ≈ 3 |
| 8 | **C2.3.2** — Élaborer un plan de correction des bogues à partir de l'analyse des anomalies et des régressions détectées au cours de la recette afin de garantir le fonctionnement du logiciel conformément à l'attendu | `plan-correction-bogues.md` | non | ≈ 2 |
| 9 | **C2.4.1** — Rédiger la documentation technique d'exploitation du logiciel détaillant son fonctionnement afin d'assurer une traçabilité pour le suivi des équipes et des futures évolutions du logiciel | `manuels/`, `adr/` | non | ≈ 3 |

## Fil rouge à glisser (différenciateur, absent du dossier de référence)
<!-- TODO : sobriété / impact environnemental dans C2.2.1 (archi) et dans la justification des choix (ADR/C2.4.1). -->

## Rappel des livrables imposés (règlement spécial) — checklist de complétude
<!-- protocole CD ✓ · critères qualité/perf ✓ · protocole CI ✓ · archi maintenable ✓ · présentation d'un prototype ✓ · framework & paradigmes ✓ · jeu de tests unitaires ✓ · mesures de sécurité ✓ · actions accessibilité ✓ · historique des versions ✓ · dernière version fonctionnelle (kit jury) ✓ · cahier de recettes ✓ · plan de correction des bogues ✓ · manuel de déploiement ✓ · manuel d'utilisation ✓ · manuel de mise à jour ✓ -->

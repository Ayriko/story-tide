# Snapshot de pilotage — Story Tide (projet KAN)

**Date :** 2026-07-24
**Périmètre :** MVP Bloc 1 — chiffrage gelé 168 SP ≈ 84 j/h (1 SP ≈ 0,5 j/h)
**Source :** Jira Cloud `story-tide.atlassian.net`, JQL `project = KAN` (40 items, lecture seule)
**Certification :** RNCP39583 — Bloc 3, C3.2.1 (indicateurs délais / coûts / avancement)

> Note méthodo : les 6 epics (KAN-1 à KAN-6) portent 0 SP (les points vivent sur les stories) et sont exclus des totaux ci-dessous. 40 items au total = 6 epics + 34 items de travail (stories + bugs).

---

## 1. Avancement par statut (items de travail)

| Statut | Tickets | Story points |
|---|---:|---:|
| Terminé | 25 | 116 |
| Backlog | 9 | 52 |
| **Total** | **34** | **168** |

Aucun ticket en « À faire », « En cours » ou « Revue » à la date du snapshot : le flux est binaire (fait / backlog), cohérent avec un gel de périmètre.

## 2. Avancement par epic (SP faits / restants)

| Epic | Libellé | Budget chiffré | SP tickets | Faits | Restants | Statut |
|---|---|---:|---:|---:|---:|---|
| KAN-1 | [P0] Infra, DevOps & CI/CD | 24 | 24 | 24 | 0 | ✅ 100 % |
| KAN-2 | [P0] Wiki & éditeur (Tiptap) | 40 | 40 | 40 | 0 | ✅ 100 % |
| KAN-3 | [P0] Liaison Aho-Corasick + graphe | 52 | 52 | 52 | 0 | ✅ 100 % |
| KAN-4 | [P1] Wiki avancé | 24 | 24 | 0 | 24 | ⏳ Backlog |
| KAN-5 | [P2] Cartes · timelines · whiteboards | 28 | 28 | 0 | 28 | ⏳ Backlog |
| KAN-6 | [P2/3] Import-Export · polish · Electron | 0 | 0 | 0 | 0 | hors chiffrage |

Le chiffrage réel des tickets colle exactement au budget gelé (168 SP), epic par epic.

**Items hors epic (0 SP, non chiffrés — polish / recette / qualité) :** 5 terminés (KAN-34 tests E2E, KAN-35 onboarding, KAN-36 shadcn/ui, KAN-39 bug collage HTML, KAN-40 recette v1.2.0-rc.1) + 1 backlog (KAN-33 design system). N'entrent pas dans le burn-up mais tracent l'effort qualité.

## 3. Répartition par personne assignée

| Personne | Tickets | SP total | SP faits |
|---|---:|---:|---:|
| Fabrice Ervé (dev front) | 11 | 76 | 38 |
| Jean Lelio (dev back) | 8 | 48 | 34 |
| Claire Moreau (DevOps) | 6 | 24 | 24 |
| Stéphane Louis (architecte) | 2 | 20 | 20 |
| Non assigné | 7 | 0 | 0 |

Le reste à faire de Fabrice (76 − 38 = 38 SP) et de Jean (48 − 34 = 14 SP) correspond au backlog P1/P2, non planifié pour le gel du 24.

## 4. Indicateurs de pilotage

| Indicateur | Valeur |
|---|---|
| Avancement MVP | **69 %** (116 / 168 SP) |
| j/h consommés (estim.) | **58 j/h** (116 SP × 0,5) |
| Budget | 84 j/h |
| Écart budget | **−26 j/h** (sous budget, 26 j/h restants pour 52 SP) |
| SP restants | 52 SP (P1 : 24 · P2 : 28) |
| Throughput semaine (updated ≥ 18/07) | **12 tickets · 40 SP** |

**Tickets passés « Terminé » cette semaine :** KAN-10, KAN-23, KAN-25 (18/07), KAN-16, KAN-17, KAN-18 (20/07), KAN-39 (21/07), KAN-19, KAN-35, KAN-36 (22/07), KAN-37, KAN-40 (23/07).

## 5. Points de vigilance

Les **trois lots P0 (KAN-1, KAN-2, KAN-3) sont clôturés à 100 %** à la veille de la deadline du 24 juillet (dépôt Bloc 2) — aucun retard P0 à signaler. Le cœur MVP est livré et la recette v1.2.0-rc.1 (KAN-40) est passée.

Reste au backlog les lots **P1 (KAN-4, 24 SP)** et **P2 (KAN-5, 28 SP)**, non démarrés — conformes au périmètre gelé, ils n'étaient pas attendus pour ce jalon. À planifier post-Bloc 2. Point mineur : 7 items non assignés (surtout des tâches qualité 0 SP), à réaffecter si le suivi de charge doit rester exhaustif.

---
*Snapshot généré automatiquement (lecture seule Jira). Indicateurs C3.2.1 — RNCP39583.*
